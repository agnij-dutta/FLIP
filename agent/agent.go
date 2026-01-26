package main

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// Agent represents the FLIP settlement executor
type Agent struct {
	config               *Config
	eventMonitor         *EventMonitor
	paymentProc          *PaymentProcessor
	fdcSubmitter         *FDCSubmitter
	flareClient          *ethclient.Client
	processedRedemptions map[uint64]bool // Track already processed redemptions
	processedMintings    map[uint64]bool // Track already processed mintings
}

// NewAgent creates a new agent instance
func NewAgent(config *Config) (*Agent, error) {
	// Initialize event monitor
	eventMonitor, err := NewEventMonitor(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create event monitor: %w", err)
	}

	// Initialize payment processor
	paymentProc, err := NewPaymentProcessor(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment processor: %w", err)
	}

	// Initialize FDC submitter
	fdcSubmitter, err := NewFDCSubmitter(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create FDC submitter: %w", err)
	}

	// Initialize Flare client for contract calls
	flareClient, err := ethclient.Dial(config.Flare.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Flare RPC: %w", err)
	}

	return &Agent{
		config:               config,
		eventMonitor:         eventMonitor,
		paymentProc:          paymentProc,
		fdcSubmitter:         fdcSubmitter,
		flareClient:          flareClient,
		processedRedemptions: make(map[uint64]bool),
		processedMintings:    make(map[uint64]bool),
	}, nil
}

// Run starts the agent service
func (a *Agent) Run(ctx context.Context) error {
	log.Info().Msg("Agent service started")

	// Recover any failed FDC submissions (XRP sent but not finalized)
	if err := a.recoverFailedFDCSubmissions(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to recover FDC submissions, continuing anyway")
	}

	// Recover any pending escrows from previous runs
	if err := a.recoverPendingEscrows(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to recover pending escrows, continuing anyway")
	}

	// Recover any pending minting requests
	if err := a.recoverPendingMintings(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to recover pending mintings, continuing anyway")
	}

	// Start monitoring EscrowCreated events
	escrowChan := make(chan EscrowCreatedEvent, 10)
	go a.eventMonitor.Monitor(ctx, escrowChan)

	// Start monitoring RedemptionRequested events
	redemptionChan := make(chan RedemptionRequestedEvent, 10)
	go a.eventMonitor.MonitorRedemptionRequests(ctx, redemptionChan)

	// Start monitoring MintingRequested events
	mintingChan := make(chan MintingRequestedEvent, 10)
	go a.eventMonitor.MonitorMintingRequests(ctx, mintingChan)

	// Process events from all channels
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-redemptionChan:
			// Process new redemption requests - call finalizeProvisional
			if err := a.handleRedemptionRequested(ctx, event); err != nil {
				log.Error().
					Err(err).
					Uint64("redemption_id", event.RedemptionID.Uint64()).
					Msg("Failed to handle RedemptionRequested event")
			}
		case event := <-escrowChan:
			// Process escrow created - send XRP payment
			if err := a.handleEscrowCreated(ctx, event); err != nil {
				log.Error().
					Err(err).
					Uint64("redemption_id", event.RedemptionID.Uint64()).
					Msg("Failed to handle EscrowCreated event")
			}
		case event := <-mintingChan:
			// Process minting request - call finalizeMintingProvisional
			if err := a.handleMintingRequested(ctx, event); err != nil {
				log.Error().
					Err(err).
					Uint64("minting_id", event.MintingID.Uint64()).
					Msg("Failed to handle MintingRequested event")
			}
		}
	}
}

// handleRedemptionRequested processes a new redemption request by calling finalizeProvisional
func (a *Agent) handleRedemptionRequested(ctx context.Context, event RedemptionRequestedEvent) error {
	redemptionID := event.RedemptionID.Uint64()

	// Skip if already processed
	if a.processedRedemptions[redemptionID] {
		log.Debug().Uint64("redemption_id", redemptionID).Msg("Redemption already processed, skipping")
		return nil
	}

	log.Info().
		Uint64("redemption_id", redemptionID).
		Str("user", event.User.Hex()).
		Str("xrpl_address", event.XRPLAddress).
		Str("amount", event.Amount.String()).
		Msg("Processing new RedemptionRequested event")

	// Call ownerProcessRedemption to create escrow
	// This requires the agent to have owner/operator privileges on FLIPCore
	err := a.callOwnerProcessRedemption(ctx, event.RedemptionID)
	if err != nil {
		return fmt.Errorf("failed to call ownerProcessRedemption: %w", err)
	}

	a.processedRedemptions[redemptionID] = true
	log.Info().Uint64("redemption_id", redemptionID).Msg("Redemption processed, escrow created")

	return nil
}

// callOwnerProcessRedemption calls FLIPCore.ownerProcessRedemption
func (a *Agent) callOwnerProcessRedemption(ctx context.Context, redemptionID *big.Int) error {
	// ABI for ownerProcessRedemption
	const flipCoreABIJSON = `[{
		"inputs": [
			{"name": "_redemptionId", "type": "uint256"},
			{"name": "_priceVolatility", "type": "uint256"},
			{"name": "_agentSuccessRate", "type": "uint256"},
			{"name": "_agentStake", "type": "uint256"}
		],
		"name": "ownerProcessRedemption",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Default parameters for scoring (high confidence)
	priceVolatility := big.NewInt(10000)    // 1% volatility
	agentSuccessRate := big.NewInt(990000)  // 99% success rate
	agentStake := new(big.Int).Mul(big.NewInt(200000), big.NewInt(1e18)) // 200k tokens

	// Get private key from environment (loaded from .env file)
	privateKeyHex := a.config.Flare.PrivateKey
	if privateKeyHex == "" {
		log.Warn().Msg("No Flare private key configured, cannot process redemptions automatically")
		return fmt.Errorf("no Flare private key configured")
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(privateKeyHex, "0x"))
	if err != nil {
		return fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(int64(a.config.Flare.ChainID))
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return fmt.Errorf("failed to create transactor: %w", err)
	}

	// Get nonce
	nonce, err := a.flareClient.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))

	// Get gas price
	gasPrice, err := a.flareClient.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}
	auth.GasPrice = gasPrice
	auth.GasLimit = uint64(500000) // Set reasonable gas limit

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)

	// Send transaction
	tx, err := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient).Transact(auth, "ownerProcessRedemption", redemptionID, priceVolatility, agentSuccessRate, agentStake)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Msg("Sent ownerProcessRedemption transaction")

	// Wait for confirmation
	receipt, err := bind.WaitMined(ctx, a.flareClient, tx)
	if err != nil {
		return fmt.Errorf("failed to wait for transaction: %w", err)
	}

	if receipt.Status != 1 {
		return fmt.Errorf("transaction failed with status %d", receipt.Status)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("gas_used", receipt.GasUsed).
		Msg("ownerProcessRedemption transaction confirmed")

	return nil
}

// recoverFailedFDCSubmissions checks for redemptions where XRP was sent but FDC finalization failed
func (a *Agent) recoverFailedFDCSubmissions(ctx context.Context) error {
	log.Info().Msg("Checking for failed FDC submissions to recover...")

	const flipCoreABIJSON = `[
		{"inputs":[],"name":"nextRedemptionId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
		{"inputs":[{"name":"_redemptionId","type":"uint256"}],"name":"redemptions","outputs":[{"name":"user","type":"address"},{"name":"asset","type":"address"},{"name":"amount","type":"uint256"},{"name":"requestedAt","type":"uint256"},{"name":"priceLocked","type":"uint256"},{"name":"hedgeId","type":"uint256"},{"name":"status","type":"uint8"},{"name":"fdcRequestId","type":"uint256"},{"name":"provisionalSettled","type":"bool"},{"name":"xrplAddress","type":"string"}],"stateMutability":"view","type":"function"},
		{"inputs":[{"name":"","type":"uint256"}],"name":"redemptionXrplTxHash","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"}
	]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)
	contract := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient)

	var result []interface{}
	err = contract.Call(&bind.CallOpts{Context: ctx}, &result, "nextRedemptionId")
	if err != nil {
		return fmt.Errorf("failed to get nextRedemptionId: %w", err)
	}
	nextID := result[0].(*big.Int).Uint64()

	for i := uint64(0); i < nextID; i++ {
		redemptionID := big.NewInt(int64(i))
		var redemptionResult []interface{}
		err = contract.Call(&bind.CallOpts{Context: ctx}, &redemptionResult, "redemptions", redemptionID)
		if err != nil {
			continue
		}

		status := redemptionResult[6].(uint8)
		// Status 2 = EscrowCreated - check if XRP was sent but FDC not finalized
		if status == 2 {
			var txHashResult []interface{}
			err = contract.Call(&bind.CallOpts{Context: ctx}, &txHashResult, "redemptionXrplTxHash", redemptionID)
			if err != nil || len(txHashResult) == 0 {
				continue
			}

			xrplTxHash := txHashResult[0].(string)
			if xrplTxHash == "" {
				continue // No XRP payment recorded yet
			}

			log.Info().
				Uint64("redemption_id", i).
				Str("xrpl_tx_hash", xrplTxHash).
				Msg("Found redemption needing FDC finalization, retrying...")

			// Get FDC proof and submit
			proof, err := a.fdcSubmitter.GetFDCProof(ctx, xrplTxHash)
			if err != nil {
				log.Warn().Err(err).Uint64("redemption_id", i).Msg("Failed to get FDC proof for recovery")
				continue
			}

			if err := a.fdcSubmitter.SubmitProof(ctx, redemptionID, proof); err != nil {
				log.Warn().Err(err).Uint64("redemption_id", i).Msg("Failed to submit FDC proof in recovery")
			} else {
				log.Info().Uint64("redemption_id", i).Msg("Successfully recovered FDC submission")
			}
		}
	}

	return nil
}

// recoverPendingEscrows checks for existing escrows that need XRP payments
func (a *Agent) recoverPendingEscrows(ctx context.Context) error {
	log.Info().Msg("Checking for pending escrows to recover...")

	// Get the next redemption ID to know how many to check
	const flipCoreABIJSON = `[
		{"inputs":[],"name":"nextRedemptionId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
		{"inputs":[{"name":"_redemptionId","type":"uint256"}],"name":"redemptions","outputs":[{"name":"user","type":"address"},{"name":"asset","type":"address"},{"name":"amount","type":"uint256"},{"name":"requestedAt","type":"uint256"},{"name":"priceLocked","type":"uint256"},{"name":"hedgeId","type":"uint256"},{"name":"status","type":"uint8"},{"name":"fdcRequestId","type":"uint256"},{"name":"provisionalSettled","type":"bool"},{"name":"xrplAddress","type":"string"}],"stateMutability":"view","type":"function"},
		{"inputs":[{"name":"","type":"uint256"}],"name":"redemptionXrplTxHash","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"}
	]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)
	contract := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient)

	// Get next redemption ID
	var result []interface{}
	err = contract.Call(&bind.CallOpts{Context: ctx}, &result, "nextRedemptionId")
	if err != nil {
		return fmt.Errorf("failed to get nextRedemptionId: %w", err)
	}
	nextID := result[0].(*big.Int).Uint64()
	log.Info().Uint64("next_redemption_id", nextID).Msg("Found redemptions to check")

	// Check each redemption
	for i := uint64(0); i < nextID; i++ {
		redemptionID := big.NewInt(int64(i))
		var redemptionResult []interface{}
		err = contract.Call(&bind.CallOpts{Context: ctx}, &redemptionResult, "redemptions", redemptionID)
		if err != nil {
			log.Warn().Err(err).Uint64("redemption_id", i).Msg("Failed to get redemption")
			continue
		}

		// Parse redemption data
		user := redemptionResult[0].(common.Address)
		amount := redemptionResult[2].(*big.Int)
		status := redemptionResult[6].(uint8)
		xrplAddress := redemptionResult[9].(string)

		// Status 2 = EscrowCreated (waiting for XRP payment)
		if status == 2 {
			// Check if payment already recorded on-chain
			var txHashResult []interface{}
			err = contract.Call(&bind.CallOpts{Context: ctx}, &txHashResult, "redemptionXrplTxHash", redemptionID)
			if err == nil && len(txHashResult) > 0 {
				existingTxHash := txHashResult[0].(string)
				if existingTxHash != "" {
					log.Info().
						Uint64("redemption_id", i).
						Str("existing_tx_hash", existingTxHash).
						Msg("Payment already recorded on-chain, skipping")
					continue
				}
			}

			log.Info().
				Uint64("redemption_id", i).
				Str("user", user.Hex()).
				Str("xrpl_address", xrplAddress).
				Str("amount", amount.String()).
				Msg("Found pending escrow, processing...")

			// Create event and process it
			event := EscrowCreatedEvent{
				RedemptionID:     redemptionID,
				User:             user,
				Amount:           amount,
				XRPLAddress:      strings.Trim(xrplAddress, "\x00"),
				PaymentReference: generatePaymentReference(redemptionID),
			}

			if err := a.handleEscrowCreated(ctx, event); err != nil {
				log.Error().Err(err).Uint64("redemption_id", i).Msg("Failed to process pending escrow")
			}
		}
	}

	return nil
}

// handleEscrowCreated processes an EscrowCreated event
func (a *Agent) handleEscrowCreated(ctx context.Context, event EscrowCreatedEvent) error {
	log.Info().
		Uint64("redemption_id", event.RedemptionID.Uint64()).
		Str("user", event.User.Hex()).
		Str("xrpl_address", event.XRPLAddress).
		Msg("Processing EscrowCreated event")

	// Step 1: Send XRP payment to user
	txHash, err := a.paymentProc.SendPayment(
		ctx,
		event.XRPLAddress,
		event.Amount,
		event.PaymentReference,
	)
	if err != nil {
		return fmt.Errorf("failed to send XRP payment: %w", err)
	}

	log.Info().
		Str("xrpl_tx_hash", txHash).
		Msg("XRP payment sent, recording on-chain")

	// Step 2: Record payment on-chain (prevents double-payment on restart)
	if err := a.recordXrplPayment(ctx, event.RedemptionID, txHash); err != nil {
		log.Warn().Err(err).Msg("Failed to record payment on-chain, continuing anyway")
	}

	// Step 3: Wait for XRPL transaction finalization
	time.Sleep(10 * time.Second) // XRPL finalization typically takes 4-5 seconds

	// Step 4: Get FDC proof (cryptographic proof of XRP payment)
	proof, err := a.fdcSubmitter.GetFDCProof(ctx, txHash)
	if err != nil {
		// Log warning but don't fail - XRP was already sent
		// FDC proof can be retried later for final settlement
		log.Warn().
			Err(err).
			Uint64("redemption_id", event.RedemptionID.Uint64()).
			Str("xrpl_tx_hash", txHash).
			Msg("FDC proof fetch failed - XRP payment was sent, can retry FDC later")
		return nil
	}

	log.Info().
		Uint64("fdc_round_id", proof.RoundID).
		Msg("FDC proof obtained")

	// Step 5: Submit FDC proof to FLIPCore (with retry)
	maxRetries := 3
	var submitErr error
	for retry := 0; retry < maxRetries; retry++ {
		if retry > 0 {
			log.Info().
				Int("retry", retry).
				Uint64("redemption_id", event.RedemptionID.Uint64()).
				Msg("Retrying FDC proof submission")
			time.Sleep(5 * time.Second)
		}

		submitErr = a.fdcSubmitter.SubmitProof(ctx, event.RedemptionID, proof)
		if submitErr == nil {
			log.Info().
				Uint64("redemption_id", event.RedemptionID.Uint64()).
				Msg("FDC proof submitted successfully - redemption complete")
			return nil
		}

		log.Warn().
			Err(submitErr).
			Int("retry", retry).
			Uint64("redemption_id", event.RedemptionID.Uint64()).
			Msg("FDC proof submission failed")
	}

	log.Error().
		Err(submitErr).
		Uint64("redemption_id", event.RedemptionID.Uint64()).
		Msg("FDC proof submission failed after all retries")
	return nil
}

// recordXrplPayment records the XRPL tx hash on-chain to prevent double-payment
func (a *Agent) recordXrplPayment(ctx context.Context, redemptionID *big.Int, xrplTxHash string) error {
	const recordPaymentABI = `[{
		"inputs": [
			{"name": "_redemptionId", "type": "uint256"},
			{"name": "_xrplTxHash", "type": "string"}
		],
		"name": "recordXrplPayment",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(recordPaymentABI))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	privateKeyHex := a.config.Flare.PrivateKey
	if privateKeyHex == "" {
		return fmt.Errorf("no Flare private key configured")
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(privateKeyHex, "0x"))
	if err != nil {
		return fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(int64(a.config.Flare.ChainID))
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return fmt.Errorf("failed to create transactor: %w", err)
	}

	nonce, err := a.flareClient.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))

	gasPrice, err := a.flareClient.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}
	auth.GasPrice = gasPrice
	auth.GasLimit = uint64(200000)

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)
	tx, err := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient).Transact(auth, "recordXrplPayment", redemptionID, xrplTxHash)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Msg("Recording XRPL payment on-chain")

	receipt, err := bind.WaitMined(ctx, a.flareClient, tx)
	if err != nil {
		return fmt.Errorf("failed to wait for transaction: %w", err)
	}

	if receipt.Status != 1 {
		return fmt.Errorf("transaction failed with status %d", receipt.Status)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Msg("XRPL payment recorded on-chain")

	return nil
}

// handleMintingRequested processes a MintingRequested event by calling finalizeMintingProvisional
func (a *Agent) handleMintingRequested(ctx context.Context, event MintingRequestedEvent) error {
	mintingID := event.MintingID.Uint64()

	// Skip if already processed
	if a.processedMintings[mintingID] {
		log.Debug().Uint64("minting_id", mintingID).Msg("Minting already processed, skipping")
		return nil
	}

	log.Info().
		Uint64("minting_id", mintingID).
		Str("user", event.User.Hex()).
		Str("xrpl_tx_hash", event.XrplTxHash).
		Str("fxrp_amount", event.FxrpAmount.String()).
		Msg("Processing MintingRequested event")

	// Call finalizeMintingProvisional to match LP and transfer FXRP to user
	err := a.callFinalizeMintingProvisional(ctx, event.MintingID)
	if err != nil {
		return fmt.Errorf("failed to call finalizeMintingProvisional: %w", err)
	}

	a.processedMintings[mintingID] = true
	log.Info().Uint64("minting_id", mintingID).Msg("Minting provisional settlement complete")

	return nil
}

// callFinalizeMintingProvisional calls FLIPCore.finalizeMintingProvisional
func (a *Agent) callFinalizeMintingProvisional(ctx context.Context, mintingID *big.Int) error {
	const flipCoreABIJSON = `[{
		"inputs": [
			{"name": "_mintingId", "type": "uint256"},
			{"name": "_priceVolatility", "type": "uint256"}
		],
		"name": "finalizeMintingProvisional",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Default low volatility for high confidence
	priceVolatility := big.NewInt(10000) // 1% volatility

	privateKeyHex := a.config.Flare.PrivateKey
	if privateKeyHex == "" {
		return fmt.Errorf("no Flare private key configured")
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(privateKeyHex, "0x"))
	if err != nil {
		return fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(int64(a.config.Flare.ChainID))
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return fmt.Errorf("failed to create transactor: %w", err)
	}

	nonce, err := a.flareClient.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))

	gasPrice, err := a.flareClient.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}
	auth.GasPrice = gasPrice
	auth.GasLimit = uint64(500000)

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)

	tx, err := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient).Transact(auth, "finalizeMintingProvisional", mintingID, priceVolatility)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("minting_id", mintingID.Uint64()).
		Msg("Sent finalizeMintingProvisional transaction")

	receipt, err := bind.WaitMined(ctx, a.flareClient, tx)
	if err != nil {
		return fmt.Errorf("failed to wait for transaction: %w", err)
	}

	if receipt.Status != 1 {
		return fmt.Errorf("transaction failed with status %d", receipt.Status)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("gas_used", receipt.GasUsed).
		Msg("finalizeMintingProvisional transaction confirmed - FXRP transferred to user")

	return nil
}

// recoverPendingMintings checks for pending minting requests that need processing
func (a *Agent) recoverPendingMintings(ctx context.Context) error {
	log.Info().Msg("Checking for pending minting requests to recover...")

	const flipCoreABIJSON = `[
		{"inputs":[],"name":"nextMintingId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
		{"inputs":[{"name":"_mintingId","type":"uint256"}],"name":"mintingRequests","outputs":[{"name":"user","type":"address"},{"name":"asset","type":"address"},{"name":"collateralReservationId","type":"uint256"},{"name":"xrplTxHash","type":"string"},{"name":"xrpAmount","type":"uint256"},{"name":"fxrpAmount","type":"uint256"},{"name":"requestedAt","type":"uint256"},{"name":"priceLocked","type":"uint256"},{"name":"hedgeId","type":"uint256"},{"name":"status","type":"uint8"},{"name":"fdcRequestId","type":"uint256"},{"name":"matchedLP","type":"address"},{"name":"haircutRate","type":"uint256"},{"name":"userAuthorizedFlip","type":"bool"}],"stateMutability":"view","type":"function"}
	]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	flipCoreAddr := common.HexToAddress(a.config.Flare.FLIPCoreAddress)
	contract := bind.NewBoundContract(flipCoreAddr, parsed, a.flareClient, a.flareClient, a.flareClient)

	var result []interface{}
	err = contract.Call(&bind.CallOpts{Context: ctx}, &result, "nextMintingId")
	if err != nil {
		return fmt.Errorf("failed to get nextMintingId: %w", err)
	}
	nextID := result[0].(*big.Int).Uint64()
	log.Info().Uint64("next_minting_id", nextID).Msg("Found minting requests to check")

	for i := uint64(0); i < nextID; i++ {
		mintingID := big.NewInt(int64(i))
		var mintingResult []interface{}
		err = contract.Call(&bind.CallOpts{Context: ctx}, &mintingResult, "mintingRequests", mintingID)
		if err != nil {
			log.Warn().Err(err).Uint64("minting_id", i).Msg("Failed to get minting request")
			continue
		}

		// status is at index 9
		status := mintingResult[9].(uint8)
		// Status 0 = Pending (needs processing)
		if status == 0 {
			user := mintingResult[0].(common.Address)
			fxrpAmount := mintingResult[5].(*big.Int)

			log.Info().
				Uint64("minting_id", i).
				Str("user", user.Hex()).
				Str("fxrp_amount", fxrpAmount.String()).
				Msg("Found pending minting, processing...")

			if err := a.callFinalizeMintingProvisional(ctx, mintingID); err != nil {
				log.Error().Err(err).Uint64("minting_id", i).Msg("Failed to process pending minting")
			} else {
				a.processedMintings[i] = true
			}
		}
	}

	return nil
}

