package main

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/rs/zerolog/log"
)

// PaymentProcessor handles XRPL payment operations
type PaymentProcessor struct {
	xrplClient *XRPLClient
	config     *Config
}

// NewPaymentProcessor creates a new payment processor
func NewPaymentProcessor(config *Config) (*PaymentProcessor, error) {
	xrplClient, err := NewXRPLClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create XRPL client: %w", err)
	}

	return &PaymentProcessor{
		xrplClient: xrplClient,
		config:     config,
	}, nil
}

// SendPayment sends an XRP payment to a user
func (pp *PaymentProcessor) SendPayment(
	ctx context.Context,
	destination string,
	amount *big.Int,
	paymentReference string,
) (string, error) {
	// Convert amount from wei/drops to XRP drops string
	// XRP uses 6 decimals, so amount is already in drops (smallest unit)
	amountDrops := amount.String()

	// Check balance before sending
	balance, err := pp.xrplClient.GetBalance(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check balance: %w", err)
	}

	balanceBig, _ := new(big.Int).SetString(balance, 10)
	minBalance := big.NewInt(int64(pp.config.Agent.MinXRPBalance))
	requiredBalance := new(big.Int).Add(amount, minBalance)

	if balanceBig.Cmp(requiredBalance) < 0 {
		return "", fmt.Errorf("insufficient XRP balance: have %s, need %s", balance, requiredBalance.String())
	}

	// Send payment with retries
	var txHash string
	var lastErr error

	for i := 0; i < pp.config.Agent.MaxPaymentRetries; i++ {
		if i > 0 {
			log.Warn().
				Int("attempt", i+1).
				Msg("Retrying XRP payment")
			time.Sleep(time.Duration(pp.config.Agent.PaymentRetryDelay) * time.Second)
		}

		txHash, lastErr = pp.xrplClient.SendPayment(ctx, destination, amountDrops, paymentReference)
		if lastErr == nil {
			// Wait for finalization
			if err := pp.xrplClient.WaitForFinalization(ctx, txHash); err != nil {
				return "", fmt.Errorf("payment sent but finalization failed: %w", err)
			}
			return txHash, nil
		}

		log.Error().
			Err(lastErr).
			Int("attempt", i+1).
			Msg("Payment attempt failed")
	}

	return "", fmt.Errorf("failed to send payment after %d attempts: %w", pp.config.Agent.MaxPaymentRetries, lastErr)
}

