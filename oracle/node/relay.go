package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Relay handles on-chain transaction submission
type Relay struct {
	client    *ethclient.Client
	oracleRelay common.Address // OracleRelay contract address
	privateKey *ecdsa.PrivateKey
	nonce     uint64
	mu        sync.Mutex
}

// NewRelay creates a new relay instance
func NewRelay(client *ethclient.Client, oracleRelayAddr common.Address) (*Relay, error) {
	privateKeyHex := os.Getenv("OPERATOR_PRIVATE_KEY")
	if privateKeyHex == "" {
		return nil, fmt.Errorf("OPERATOR_PRIVATE_KEY environment variable required")
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, err
	}

	// Get initial nonce
	auth := bind.NewKeyedTransactor(privateKey)
	nonce, err := client.PendingNonceAt(context.Background(), auth.From)
	if err != nil {
		return nil, err
	}

	return &Relay{
		client:     client,
		oracleRelay: oracleRelayAddr,
		privateKey: privateKey,
		nonce:      nonce,
	}, nil
}

// SubmitPrediction submits a signed prediction to OracleRelay contract
func (r *Relay) SubmitPrediction(redemptionId *big.Int, prediction *PredictionResult) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create signature
	messageHash := r.createMessageHash(redemptionId, prediction)
	signature, err := crypto.Sign(messageHash.Bytes(), r.privateKey)
	if err != nil {
		return err
	}

	// In production, would call OracleRelay.submitPrediction() via contract ABI
	// For now, this is a placeholder
	
	log.Printf("Would submit prediction: redemptionId=%s, prob=%d, conf=[%d, %d]",
		redemptionId.String(),
		prediction.Probability,
		prediction.ConfidenceLower,
		prediction.ConfidenceUpper,
	)

	r.nonce++
	return nil
}

// createMessageHash creates hash for signing (EIP-712 style)
func (r *Relay) createMessageHash(redemptionId *big.Int, prediction *PredictionResult) common.Hash {
	// In production, use EIP-712 structured data hashing
	// For now, simple keccak256
	data := append(redemptionId.Bytes(), 
		big.NewInt(int64(prediction.Probability)).Bytes()...,
		big.NewInt(int64(prediction.ConfidenceLower)).Bytes()...,
		big.NewInt(int64(time.Now().Unix())).Bytes()...,
	)
	return crypto.Keccak256Hash(data)
}

