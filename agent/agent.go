package main

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
)

// Agent represents the FLIP settlement executor
type Agent struct {
	config        *Config
	eventMonitor  *EventMonitor
	paymentProc   *PaymentProcessor
	fdcSubmitter  *FDCSubmitter
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

	return &Agent{
		config:       config,
		eventMonitor: eventMonitor,
		paymentProc:  paymentProc,
		fdcSubmitter: fdcSubmitter,
	}, nil
}

// Run starts the agent service
func (a *Agent) Run(ctx context.Context) error {
	log.Info().Msg("Agent service started")

	// Start monitoring EscrowCreated events
	eventChan := make(chan EscrowCreatedEvent, 10)
	go a.eventMonitor.Monitor(ctx, eventChan)

	// Process events
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-eventChan:
			if err := a.handleEscrowCreated(ctx, event); err != nil {
				log.Error().
					Err(err).
					Uint64("redemption_id", event.RedemptionID.Uint64()).
					Msg("Failed to handle EscrowCreated event")
				// Continue processing other events
			}
		}
	}
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
		Msg("XRP payment sent, waiting for finalization")

	// Step 2: Wait for XRPL transaction finalization
	time.Sleep(5 * time.Second) // XRPL finalization typically takes 4-5 seconds

	// Step 3: Get FDC proof
	proof, err := a.fdcSubmitter.GetFDCProof(ctx, txHash)
	if err != nil {
		return fmt.Errorf("failed to get FDC proof: %w", err)
	}

	log.Info().
		Uint64("fdc_round_id", proof.RoundID).
		Msg("FDC proof obtained")

	// Step 4: Submit FDC proof to FLIPCore
	if err := a.fdcSubmitter.SubmitProof(ctx, event.RedemptionID, proof); err != nil {
		return fmt.Errorf("failed to submit FDC proof: %w", err)
	}

	log.Info().
		Uint64("redemption_id", event.RedemptionID.Uint64()).
		Msg("FDC proof submitted successfully")

	return nil
}

