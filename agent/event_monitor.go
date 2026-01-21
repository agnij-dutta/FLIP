package main

import (
	"bytes"
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// EscrowCreatedEvent represents an EscrowCreated event from FLIPCore
type EscrowCreatedEvent struct {
	RedemptionID     *big.Int
	User             common.Address
	ReceiptID        *big.Int
	Amount           *big.Int
	Timestamp        *big.Int
	XRPLAddress      string // Extracted from redemption data
	PaymentReference string // Generated from redemption ID
}

// RedemptionData represents redemption struct from FLIPCore
type RedemptionData struct {
	User               common.Address
	Asset              common.Address
	Amount             *big.Int
	RequestedAt        *big.Int
	PriceLocked        *big.Int
	HedgeID            *big.Int
	Status             uint8
	FDCRequestID       *big.Int
	ProvisionalSettled bool
	XRPLAddress        string
}

// EventMonitor monitors FLIPCore for EscrowCreated events
type EventMonitor struct {
	client       *ethclient.Client
	flipCore     common.Address
	lastBlock    uint64
	pollInterval time.Duration
}

// NewEventMonitor creates a new event monitor
func NewEventMonitor(config *Config) (*EventMonitor, error) {
	client, err := ethclient.Dial(config.Flare.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Flare RPC: %w", err)
	}

	// Get current block number
	blockNumber, err := client.BlockNumber(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get block number: %w", err)
	}

	// Start slightly behind head to avoid missing events around startup.
	// This is safe because we only act on EscrowCreated once per redemptionId.
	startBlock := blockNumber
	if startBlock > 50 {
		startBlock = startBlock - 50
	}

	return &EventMonitor{
		client:       client,
		flipCore:     common.HexToAddress(config.Flare.FLIPCoreAddress),
		lastBlock:    startBlock,
		pollInterval: time.Duration(config.Agent.PollingInterval) * time.Second,
	}, nil
}

// Monitor monitors for EscrowCreated events
func (em *EventMonitor) Monitor(ctx context.Context, eventChan chan<- EscrowCreatedEvent) error {
	// EscrowCreated event signature
	// event EscrowCreated(uint256 indexed redemptionId, address indexed user, uint256 receiptId, uint256 amount, uint256 timestamp)
	eventSignature := []byte("EscrowCreated(uint256,address,uint256,uint256,uint256)")
	eventTopic := common.BytesToHash(crypto.Keccak256(eventSignature))

	log.Info().
		Uint64("from_block", em.lastBlock).
		Str("flip_core", em.flipCore.Hex()).
		Msg("Starting event monitoring")

	ticker := time.NewTicker(em.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			// Get current block
			currentBlock, err := em.client.BlockNumber(ctx)
			if err != nil {
				log.Error().Err(err).Msg("Failed to get block number")
				continue
			}

			if currentBlock <= em.lastBlock {
				continue
			}

			// Query for EscrowCreated events
			query := ethereum.FilterQuery{
				FromBlock: big.NewInt(int64(em.lastBlock)),
				ToBlock:   big.NewInt(int64(currentBlock)),
				Addresses: []common.Address{em.flipCore},
				Topics:    [][]common.Hash{{eventTopic}},
			}

			logs, err := em.client.FilterLogs(ctx, query)
			if err != nil {
				log.Error().Err(err).Msg("Failed to filter logs")
				continue
			}

			// Process events
			for _, vLog := range logs {
				event, err := em.parseEscrowCreatedEvent(vLog)
				if err != nil {
					log.Error().Err(err).Msg("Failed to parse event")
					continue
				}

				// Query FLIPCore.redemptions() to get XRPL address
				xrplAddress, err := em.getXRPLAddressFromRedemption(ctx, event.RedemptionID)
				if err != nil {
					log.Error().Err(err).Uint64("redemption_id", event.RedemptionID.Uint64()).Msg("Failed to get XRPL address")
					continue
				}

				event.XRPLAddress = xrplAddress
				event.PaymentReference = generatePaymentReference(event.RedemptionID)

				eventChan <- *event
			}

			em.lastBlock = currentBlock
		}
	}
}

// parseEscrowCreatedEvent parses an EscrowCreated event from a log
func (em *EventMonitor) parseEscrowCreatedEvent(vLog types.Log) (*EscrowCreatedEvent, error) {
	// Event signature: EscrowCreated(uint256 indexed redemptionId, address indexed user, uint256 receiptId, uint256 amount, uint256 timestamp)
	// Topics: [event signature, redemptionId, user]
	// Data: [receiptId, amount, timestamp]

	if len(vLog.Topics) < 3 {
		return nil, fmt.Errorf("invalid event log: insufficient topics")
	}

	redemptionID := new(big.Int).SetBytes(vLog.Topics[1].Bytes())
	user := common.BytesToAddress(vLog.Topics[2].Bytes())

	// Parse data (receiptId, amount, timestamp)
	if len(vLog.Data) < 96 { // 3 * 32 bytes
		return nil, fmt.Errorf("invalid event log: insufficient data")
	}

	receiptID := new(big.Int).SetBytes(vLog.Data[0:32])
	amount := new(big.Int).SetBytes(vLog.Data[32:64])
	timestamp := new(big.Int).SetBytes(vLog.Data[64:96])

	return &EscrowCreatedEvent{
		RedemptionID: redemptionID,
		User:         user,
		ReceiptID:    receiptID,
		Amount:       amount,
		Timestamp:    timestamp,
	}, nil
}

// getXRPLAddressFromRedemption queries FLIPCore to get XRPL address for redemption
func (em *EventMonitor) getXRPLAddressFromRedemption(ctx context.Context, redemptionID *big.Int) (string, error) {
	// Minimal ABI for FLIPCore.redemptions(uint256) including xrplAddress string.
	const flipCoreABIJSON = `[
		{
			"inputs":[{"name":"_redemptionId","type":"uint256"}],
			"name":"redemptions",
			"outputs":[
				{"name":"user","type":"address"},
				{"name":"asset","type":"address"},
				{"name":"amount","type":"uint256"},
				{"name":"requestedAt","type":"uint256"},
				{"name":"priceLocked","type":"uint256"},
				{"name":"hedgeId","type":"uint256"},
				{"name":"status","type":"uint8"},
				{"name":"fdcRequestId","type":"uint256"},
				{"name":"provisionalSettled","type":"bool"},
				{"name":"xrplAddress","type":"string"}
			],
			"stateMutability":"view",
			"type":"function"
		}
	]`

	parsed, err := abi.JSON(strings.NewReader(flipCoreABIJSON))
	if err != nil {
		return "", fmt.Errorf("failed to parse FLIPCore ABI: %w", err)
	}

	data, err := parsed.Pack("redemptions", redemptionID)
	if err != nil {
		return "", fmt.Errorf("failed to pack redemptions call: %w", err)
	}

	callMsg := ethereum.CallMsg{
		To:   &em.flipCore,
		Data: data,
	}

	raw, err := em.client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return "", fmt.Errorf("failed to call FLIPCore.redemptions: %w", err)
	}

	// Unpack into a generic slice; xrplAddress is index 9.
	out, err := parsed.Unpack("redemptions", raw)
	if err != nil {
		// Helpful context when ABI mismatches
		return "", fmt.Errorf("failed to unpack redemptions result (len=%d): %w", len(raw), err)
	}
	if len(out) != 10 {
		return "", fmt.Errorf("unexpected redemptions output length: %d", len(out))
	}

	xrpl, ok := out[9].(string)
	if !ok {
		return "", fmt.Errorf("unexpected xrplAddress type: %T", out[9])
	}

	// Be defensive about potential null padding.
	xrpl = strings.Trim(xrpl, "\x00")
	xrpl = strings.TrimSpace(xrpl)
	if xrpl == "" {
		return "", fmt.Errorf("xrplAddress is empty for redemptionId=%s", redemptionID.String())
	}
	// Avoid accidental leading nulls from some decoders.
	xrpl = string(bytes.Trim([]byte(xrpl), "\x00"))

	return xrpl, nil
}

// generatePaymentReference generates a payment reference from redemption data
// Updated formula: Hash(chainId, redemptionId, user, amount, timestamp)
func generatePaymentReference(redemptionID *big.Int) string {
	// TODO: Implement full hash with chainId, user, amount, timestamp
	// For now, use redemption ID as hex string (will be updated to match FLIPCore logic)
	// In production, this should match FLIPCore's payment reference generation exactly
	return fmt.Sprintf("%064x", redemptionID)
}
