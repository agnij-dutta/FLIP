package ingest

import (
	"context"
	"log"
	"time"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/common"
)

// FTSOFeedsIngester monitors FTSOv2 block-latency price feeds
type FTSOFeedsIngester struct {
	client      *ethclient.Client
	ftsoRegistry common.Address
	blockTime   time.Duration // ~1.8 seconds
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewFTSOFeedsIngester creates a new FTSO ingester
func NewFTSOFeedsIngester(client *ethclient.Client, ftsoRegistryAddr string) *FTSOFeedsIngester {
	ctx, cancel := context.WithCancel(context.Background())

	return &FTSOFeedsIngester{
		client:      client,
		ftsoRegistry: common.HexToAddress(ftsoRegistryAddr),
		blockTime:   1800 * time.Millisecond,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start begins monitoring FTSO price feeds
func (ffi *FTSOFeedsIngester) Start(priceChan chan<- FTSOPriceUpdate) error {
	// Subscribe to new blocks
	headers := make(chan *types.Header)
	sub, err := ffi.client.SubscribeNewHead(context.Background(), headers)
	if err != nil {
		return err
	}

	go func() {
		for {
			select {
			case err := <-sub.Err():
				log.Printf("FTSO subscription error: %v", err)
				return
			case header := <-headers:
				ffi.fetchPricesForBlock(header.Number.Uint64(), priceChan)
			case <-ffi.ctx.Done():
				return
			}
		}
	}()

	return nil
}

// FTSOPriceUpdate represents a price update
type FTSOPriceUpdate struct {
	Symbol    string
	Price     uint64
	Timestamp time.Time
	BlockNumber uint64
	Delta     int64 // Incremental delta (1/2^18 precision)
}

func (ffi *FTSOFeedsIngester) fetchPricesForBlock(blockNum uint64, priceChan chan<- FTSOPriceUpdate) {
	// In production:
	// 1. Query FTSO registry for all active feeds
	// 2. For each feed, get current price
	// 3. Compute delta from previous price
	// 4. Check for volatility incentives
	// 5. Store scaling feed anchors (90s epochs)
	
	// Placeholder
	update := FTSOPriceUpdate{
		Symbol:      "XRP/USD",
		Price:        1000000, // Scaled price
		Timestamp:    time.Now(),
		BlockNumber: blockNum,
		Delta:        1, // +1 increment
	}
	
	select {
	case priceChan <- update:
	default:
		log.Println("Price channel full, dropping update")
	}
}

// Stop stops the ingester
func (ffi *FTSOFeedsIngester) Stop() {
	ffi.cancel()
}

