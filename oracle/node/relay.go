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
func (r *Relay) SubmitPrediction(
	redemptionId *big.Int,
	score *big.Int,
	suggestedHaircut *big.Int,
	routingDecision uint8,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create signature (EIP-712 style)
	messageHash := r.createMessageHash(redemptionId, score, suggestedHaircut, routingDecision)
	signature, err := crypto.Sign(messageHash.Bytes(), r.privateKey)
	if err != nil {
		return err
	}

	// In production, call OracleRelay.submitPrediction() via contract ABI
	// For now, log the prediction
	log.Printf("Submitting prediction: redemptionId=%s, score=%d, haircut=%d, decision=%d",
		redemptionId.String(),
		score.Uint64(),
		suggestedHaircut.Uint64(),
		routingDecision,
	)

	r.nonce++
	return nil
}

// createMessageHash creates hash for signing (EIP-712 style)
func (r *Relay) createMessageHash(redemptionId *big.Int, score *big.Int, suggestedHaircut *big.Int, routingDecision uint8) common.Hash {
	// In production, use EIP-712 structured data hashing
	// For now, simple keccak256
	data := append(redemptionId.Bytes(),
		score.Bytes()...,
		suggestedHaircut.Bytes()...,
		[]byte{routingDecision}...,
		big.NewInt(time.Now().Unix()).Bytes()...,
	)
	return crypto.Keccak256Hash(data)
}

