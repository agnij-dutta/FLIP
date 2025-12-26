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

// FDCAttestationIngester monitors FDC StateConnector attestation events
type FDCAttestationIngester struct {
	client          *ethclient.Client
	stateConnector  common.Address
	ctx             context.Context
	cancel          context.CancelFunc
	requestTimestamps map[uint64]time.Time // requestId -> request time
}

// NewFDCAttestationIngester creates a new FDC ingester
func NewFDCAttestationIngester(client *ethclient.Client, stateConnectorAddr string) *FDCAttestationIngester {
	ctx, cancel := context.WithCancel(context.Background())

	return &FDCAttestationIngester{
		client:          client,
		stateConnector:  common.HexToAddress(stateConnectorAddr),
		ctx:             ctx,
		cancel:          cancel,
		requestTimestamps: make(map[uint64]time.Time),
	}
}

// Start begins monitoring FDC attestations
func (fai *FDCAttestationIngester) Start(attestationChan chan<- FDCAttestation) error {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{fai.stateConnector},
		// Topics for Attestation event
	}

	logs := make(chan types.Log)
	sub, err := fai.client.SubscribeFilterLogs(fai.ctx, query, logs)
	if err != nil {
		return err
	}

	go func() {
		for {
			select {
			case err := <-sub.Err():
				log.Printf("FDC subscription error: %v", err)
				return
			case logEntry := <-logs:
				attestation := fai.parseAttestation(logEntry)
				if attestation != nil {
					attestationChan <- *attestation
				}
			case <-fai.ctx.Done():
				return
			}
		}
	}()

	return nil
}

// FDCAttestation represents an FDC attestation
type FDCAttestation struct {
	RequestID   uint64
	MerkleRoot  common.Hash
	Timestamp   time.Time
	Latency     time.Duration // request time → attestation time
	BlockNumber uint64
}

func (fai *FDCAttestationIngester) parseAttestation(logEntry types.Log) *FDCAttestation {
	// Parse Attestation event
	// event Attestation(uint256 indexed _requestId, bytes32 _merkleRoot, uint256 _timestamp)
	
	requestId := logEntry.Topics[1].Big().Uint64()
	merkleRoot := common.BytesToHash(logEntry.Data[0:32])
	
	// Calculate latency if we have request timestamp
	latency := time.Duration(0)
	if requestTime, exists := fai.requestTimestamps[requestId]; exists {
		latency = time.Since(requestTime)
		delete(fai.requestTimestamps, requestId)
	}

	return &FDCAttestation{
		RequestID:   requestId,
		MerkleRoot:  merkleRoot,
		Timestamp:   time.Now(),
		Latency:     latency,
		BlockNumber: logEntry.BlockNumber,
	}
}

// RecordRequest records a redemption request timestamp for latency calculation
func (fai *FDCAttestationIngester) RecordRequest(requestId uint64) {
	fai.requestTimestamps[requestId] = time.Now()
}

// Stop stops the ingester
func (fai *FDCAttestationIngester) Stop() {
	fai.cancel()
}



