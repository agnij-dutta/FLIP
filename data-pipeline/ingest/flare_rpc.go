package ingest

import (
	"context"
	"log"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// FlareRPCIngester monitors FAssets redemption events in real-time
type FlareRPCIngester struct {
	client        *ethclient.Client
	fassetAddress common.Address
	blockTime     time.Duration // ~1.8 seconds
	ctx           context.Context
	cancel        context.CancelFunc
}

// NewFlareRPCIngester creates a new ingester
func NewFlareRPCIngester(rpcURL string, fassetAddr string) (*FlareRPCIngester, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &FlareRPCIngester{
		client:        client,
		fassetAddress: common.HexToAddress(fassetAddr),
		blockTime:     1800 * time.Millisecond, // ~1.8s
		ctx:           ctx,
		cancel:        cancel,
	}, nil
}

// Start begins monitoring redemption events
func (fri *FlareRPCIngester) Start(eventChan chan<- RedemptionEvent) error {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{fri.fassetAddress},
		// Topics for RedemptionRequested, RedemptionCompleted, RedemptionFailed
	}

	logs := make(chan types.Log)
	sub, err := fri.client.SubscribeFilterLogs(fri.ctx, query, logs)
	if err != nil {
		return err
	}

	go func() {
		for {
			select {
			case err := <-sub.Err():
				log.Printf("Subscription error: %v", err)
				return
			case logEntry := <-logs:
				event := fri.parseRedemptionEvent(logEntry)
				if event != nil {
					eventChan <- *event
				}
			case <-fri.ctx.Done():
				return
			}
		}
	}()

	return nil
}

// RedemptionEvent represents a redemption event
type RedemptionEvent struct {
	Type        string    // "requested", "completed", "failed"
	RedemptionID string
	User        common.Address
	Amount      uint64
	BlockNumber uint64
	Timestamp   time.Time
}

func (fri *FlareRPCIngester) parseRedemptionEvent(logEntry types.Log) *RedemptionEvent {
	// Parse event based on topic[0] (event signature)
	// Placeholder implementation
	return &RedemptionEvent{
		Type:        "requested",
		RedemptionID: logEntry.Topics[1].Hex(),
		BlockNumber: logEntry.BlockNumber,
		Timestamp:   time.Now(), // In production, get from block header
	}
}

// Stop stops the ingester
func (fri *FlareRPCIngester) Stop() {
	fri.cancel()
	fri.client.Close()
}



