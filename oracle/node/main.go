package main

import (
	"context"
	"log"
	"math"
	"math/big"
	"os"
	"os/signal"
	"syscall"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// OracleNode is the main oracle service
type OracleNode struct {
	client     *ethclient.Client
	rpcURL     string
	flipCore   common.Address
	predictor  *Predictor
	relay      *Relay
	monitor    *Monitor
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewOracleNode creates a new oracle node instance
func NewOracleNode(rpcURL string, flipCoreAddr string) (*OracleNode, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())

	predictor, err := NewPredictor()
	if err != nil {
		cancel()
		return nil, err
	}

	relay, err := NewRelay(client, common.HexToAddress(flipCoreAddr))
	if err != nil {
		cancel()
		return nil, err
	}

	monitor := NewMonitor(predictor, relay)

	return &OracleNode{
		client:    client,
		rpcURL:    rpcURL,
		flipCore:  common.HexToAddress(flipCoreAddr),
		predictor: predictor,
		relay:     relay,
		monitor:   monitor,
		ctx:       ctx,
		cancel:    cancel,
	}, nil
}

// Start begins the oracle service
func (on *OracleNode) Start() error {
	log.Println("Starting FLIP Oracle Node...")

	// Start monitoring
	go on.monitor.Start(on.ctx)

	// Subscribe to RedemptionRequested events
	query := ethereum.FilterQuery{
		Addresses: []common.Address{on.flipCore},
		Topics: [][]common.Hash{
			{common.HexToHash("0x...")}, // RedemptionRequested event signature
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
	// Parse event data (simplified)
	redemptionId := logEntry.Topics[1].Big()
	
	log.Printf("Processing redemption request: %s", redemptionId.String())

	// Extract features from on-chain data
	features, err := on.extractFeatures(redemptionId)
	if err != nil {
		log.Printf("Error extracting features: %v", err)
		return
	}

	// Use deterministic scoring (not ML)
	scorer := NewDeterministicScorer()
	
	// Calculate score using deterministic scoring
	scoreResult := scorer.CalculateScore(scoringParams)
	
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
			log.Printf("Submitted prediction for redemption %s: score=%d, conf=[%d, %d], decision=%d",
				redemptionId.String(),
				scoreResult.Score.Uint64(),
				scoreResult.ConfidenceLower.Uint64(),
				scoreResult.ConfidenceUpper.Uint64(),
				scoreResult.Decision,
			)
		}
	}
}

// extractFeatures extracts features from on-chain data
func (on *OracleNode) extractFeatures(redemptionId *big.Int) (map[string]float64, error) {
	features := make(map[string]float64)
	
	// 1. Query FTSO prices for volatility (simplified - would query historical blocks)
	// In production, query last 2000 blocks (~1 hour) and compute std dev
	features["volatility_1h"] = 0.01  // Placeholder - would compute from historical prices
	features["volatility_24h"] = 0.015
	
	// 2. Query recent redemption success rates
	// Would query FLIPCore contract for recent redemptions
	features["redemption_success_rate"] = 0.998
	
	// 3. Query FDC latency stats
	// Would query StateConnector for recent attestations
	features["fdc_latency_mean"] = 240.0
	features["fdc_latency_p95"] = 300.0
	features["fdc_latency_p99"] = 360.0
	
	// 4. Extract time features
	now := time.Now()
	features["hour"] = float64(now.Hour())
	features["hour_sin"] = math.Sin(2 * math.Pi * float64(now.Hour()) / 24)
	features["hour_cos"] = math.Cos(2 * math.Pi * float64(now.Hour()) / 24)
	features["day_of_week"] = float64(now.Weekday())
	features["is_weekend"] = 0.0
	if now.Weekday() >= 5 {
		features["is_weekend"] = 1.0
	}
	
	// 5. Query agent performance (would query from FLIPCore)
	features["agent_success_rate"] = 0.995
	
	// 6. Query mempool metrics (would query from block data)
	features["gas_utilization"] = 0.5
	
	return features, nil
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

	node, err := NewOracleNode(rpcURL, flipCoreAddr)
	if err != nil {
		log.Fatalf("Failed to create oracle node: %v", err)
	}

	if err := node.Start(); err != nil {
		log.Fatalf("Oracle node error: %v", err)
	}
}

