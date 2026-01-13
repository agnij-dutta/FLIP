package main

import (
	"context"
	"log"
	"math/big"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"strings"
)

// OracleNode is the main oracle service
type OracleNode struct {
	client        *ethclient.Client
	rpcURL        string
	flipCore      common.Address
	oracleRelay   common.Address
	scorer        *DeterministicScorer
	relay         *Relay
	monitor       *Monitor
	ctx           context.Context
	cancel        context.CancelFunc
	flipCoreABI   abi.ABI
	oracleRelayABI abi.ABI
}

// NewOracleNode creates a new oracle node instance
func NewOracleNode(rpcURL string, flipCoreAddr string, oracleRelayAddr string) (*OracleNode, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())

	scorer := NewDeterministicScorer()

	relay, err := NewRelay(client, common.HexToAddress(oracleRelayAddr))
	if err != nil {
		cancel()
		return nil, err
	}

	monitor := NewMonitor(scorer, relay)

	// Load contract ABIs (simplified - in production load from JSON files)
	// For now, create minimal ABI for RedemptionRequested event
	flipCoreABI, _ := abi.JSON(strings.NewReader(`[{"anonymous":false,"inputs":[{"indexed":true,"name":"redemptionId","type":"uint256"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"asset","type":"address"},{"name":"amount","type":"uint256"},{"name":"timestamp","type":"uint256"}],"name":"RedemptionRequested","type":"event"}]`))
	oracleRelayABI, _ := abi.JSON(strings.NewReader(`[]`))

	return &OracleNode{
		client:        client,
		rpcURL:        rpcURL,
		flipCore:      common.HexToAddress(flipCoreAddr),
		oracleRelay:   common.HexToAddress(oracleRelayAddr),
		scorer:        scorer,
		relay:         relay,
		monitor:       monitor,
		ctx:           ctx,
		cancel:        cancel,
		flipCoreABI:   flipCoreABI,
		oracleRelayABI: oracleRelayABI,
	}, nil
}

// Start begins the oracle service
func (on *OracleNode) Start() error {
	log.Println("Starting FLIP Oracle Node (Deterministic Scoring)...")
	log.Printf("FLIPCore: %s", on.flipCore.Hex())
	log.Printf("OracleRelay: %s", on.oracleRelay.Hex())

	// Start monitoring
	go on.monitor.Start(on.ctx)

	// Subscribe to RedemptionRequested events
	// Event signature: RedemptionRequested(uint256 indexed redemptionId, address indexed user, address indexed asset, uint256 amount, uint256 timestamp)
	eventSignature := common.HexToHash("0x...") // RedemptionRequested event signature
	
	query := ethereum.FilterQuery{
		Addresses: []common.Address{on.flipCore},
		Topics: [][]common.Hash{
			{eventSignature},
		},
	}

	logs := make(chan types.Log)
	sub, err := on.client.SubscribeFilterLogs(on.ctx, query, logs)
	if err != nil {
		return err
	}

	// Process events
	go on.processEvents(logs, sub.Err())

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down oracle node...")
	on.Stop()
	return nil
}

// processEvents handles incoming blockchain events
func (on *OracleNode) processEvents(logs chan types.Log, errChan <-chan error) {
	for {
		select {
		case err := <-errChan:
			log.Printf("Subscription error: %v", err)
			return
		case logEntry := <-logs:
			on.handleRedemptionRequested(logEntry)
		case <-on.ctx.Done():
			return
		}
	}
}

// handleRedemptionRequested processes a redemption request
func (on *OracleNode) handleRedemptionRequested(logEntry types.Log) {
	// Parse event data
	var event struct {
		RedemptionId *big.Int
		User         common.Address
		Asset        common.Address
		Amount       *big.Int
		Timestamp    *big.Int
	}

	err := on.flipCoreABI.UnpackIntoInterface(&event, "RedemptionRequested", logEntry.Data)
	if err != nil {
		log.Printf("Error parsing event: %v", err)
		return
	}

	redemptionId := logEntry.Topics[1].Big() // First indexed parameter
	
	log.Printf("Processing redemption request: ID=%s, User=%s, Asset=%s, Amount=%s",
		redemptionId.String(),
		event.User.Hex(),
		event.Asset.Hex(),
		event.Amount.String(),
	)

	// Extract on-chain data for scoring
	scoringParams, err := on.extractScoringParams(redemptionId, event.Asset, event.Amount)
	if err != nil {
		log.Printf("Error extracting scoring params: %v", err)
		return
	}

	// Calculate deterministic score
	scoreResult := on.scorer.CalculateScore(scoringParams)
	
	log.Printf("Score calculated: score=%d, confLower=%d, confUpper=%d, canProvisional=%v, decision=%d",
		scoreResult.Score.Uint64(),
		scoreResult.ConfidenceLower.Uint64(),
		scoreResult.ConfidenceUpper.Uint64(),
		scoreResult.CanProvisionalSettle,
		scoreResult.Decision,
	)

	// Submit prediction if confidence is high enough
	if scoreResult.CanProvisionalSettle {
		// Calculate suggested haircut
		suggestedHaircut := calculateSuggestedHaircut(scoreResult)
		
		// Submit to OracleRelay (advisory prediction)
		err = on.relay.SubmitPrediction(
			redemptionId,
			scoreResult.Score,
			suggestedHaircut,
			scoreResult.Decision,
		)
		if err != nil {
			log.Printf("Error submitting prediction: %v", err)
		} else {
			log.Printf("✅ Submitted prediction: redemptionId=%s, score=%d, haircut=%d, decision=%d",
				redemptionId.String(),
				scoreResult.Score.Uint64(),
				suggestedHaircut.Uint64(),
				scoreResult.Decision,
			)
		}
	} else {
		log.Printf("⚠️ Score too low for provisional settlement: confLower=%d < 997000",
			scoreResult.ConfidenceLower.Uint64(),
		)
	}
}

// extractScoringParams extracts on-chain data for deterministic scoring
func (on *OracleNode) extractScoringParams(redemptionId *big.Int, asset common.Address, amount *big.Int) (ScoringParams, error) {
	// 1. Get price volatility from FTSO (query last 10 blocks)
	priceVolatility, err := on.getPriceVolatility(asset)
	if err != nil {
		log.Printf("Warning: Could not get price volatility, using default: %v", err)
		priceVolatility = big.NewInt(10000) // 1% default
	}

	// 2. Get agent info (would query from FLIPCore or FAsset contract)
	agentSuccessRate := big.NewInt(980000) // 98% default
	agentStake := big.NewInt(100000).Mul(big.NewInt(100000), big.NewInt(1e18)) // $100k default

	// 3. Get current hour
	hourOfDay := time.Now().Hour()

	return ScoringParams{
		PriceVolatility: priceVolatility,
		Amount:          amount,
		AgentSuccessRate: agentSuccessRate,
		AgentStake:      agentStake,
		HourOfDay:       hourOfDay,
	}, nil
}

// getPriceVolatility calculates price volatility from recent FTSO prices
func (on *OracleNode) getPriceVolatility(asset common.Address) (*big.Int, error) {
	// In production, query FTSO prices for last 10 blocks and calculate std dev
	// For now, return placeholder
	return big.NewInt(10000), nil // 1% volatility
}

// calculateSuggestedHaircut calculates suggested haircut from score result
func calculateSuggestedHaircut(result ScoreResult) *big.Int {
	// Higher confidence = lower haircut
	// haircut = (1 - confidenceLower) * maxHaircut
	maxHaircut := big.NewInt(50000) // 5% max (scaled)
	oneMillion := big.NewInt(1000000)
	
	confidenceFactor := new(big.Int).Sub(oneMillion, result.ConfidenceLower)
	haircut := new(big.Int).Mul(confidenceFactor, maxHaircut)
	haircut.Div(haircut, oneMillion)
	
	return haircut
}

// Stop stops the oracle service
func (on *OracleNode) Stop() {
	on.cancel()
	on.client.Close()
}

func main() {
	rpcURL := os.Getenv("FLARE_RPC")
	if rpcURL == "" {
		rpcURL = "https://coston2-api.flare.network/ext/C/rpc"
	}

	flipCoreAddr := os.Getenv("FLIP_CORE_ADDRESS")
	if flipCoreAddr == "" {
		log.Fatal("FLIP_CORE_ADDRESS environment variable required")
	}

	oracleRelayAddr := os.Getenv("ORACLE_RELAY_ADDRESS")
	if oracleRelayAddr == "" {
		log.Fatal("ORACLE_RELAY_ADDRESS environment variable required")
	}

	node, err := NewOracleNode(rpcURL, flipCoreAddr, oracleRelayAddr)
	if err != nil {
		log.Fatalf("Failed to create oracle node: %v", err)
	}

	if err := node.Start(); err != nil {
		log.Fatalf("Oracle node error: %v", err)
	}
}

