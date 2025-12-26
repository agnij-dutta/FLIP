package main

import (
	"context"
	"log"
	"sync"
	"time"
)

// Monitor tracks prediction accuracy and detects model drift
type Monitor struct {
	predictor     *Predictor
	relay         *Relay
	predictions   []PredictionRecord
	actuals       map[string]bool // redemptionId -> actual outcome
	mu            sync.RWMutex
	accuracy      float64
	driftThreshold float64 // 0.995 = 99.5%
}

// PredictionRecord tracks a prediction and its outcome
type PredictionRecord struct {
	RedemptionID   string
	PredictedProb  float64
	ConfidenceLower float64
	Timestamp      time.Time
	ActualOutcome  *bool // nil until FDC confirms
}

// NewMonitor creates a new monitor instance
func NewMonitor(predictor *Predictor, relay *Relay) *Monitor {
	return &Monitor{
		predictor:      predictor,
		relay:         relay,
		predictions:   make([]PredictionRecord, 0),
		actuals:       make(map[string]bool),
		driftThreshold: 0.995,
	}
}

// Start begins monitoring
func (m *Monitor) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.checkAccuracy()
			m.checkDrift()
		}
	}
}

// RecordPrediction records a prediction for tracking
func (m *Monitor) RecordPrediction(redemptionId string, prob, confLower float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.predictions = append(m.predictions, PredictionRecord{
		RedemptionID:    redemptionId,
		PredictedProb:   prob,
		ConfidenceLower: confLower,
		Timestamp:       time.Now(),
		ActualOutcome:   nil,
	})
}

// RecordOutcome records the actual FDC outcome
func (m *Monitor) RecordOutcome(redemptionId string, success bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.actuals[redemptionId] = success

	// Update prediction record
	for i := range m.predictions {
		if m.predictions[i].RedemptionID == redemptionId {
			m.predictions[i].ActualOutcome = &success
			break
		}
	}
}

// checkAccuracy computes current prediction accuracy
func (m *Monitor) checkAccuracy() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	completed := 0
	correct := 0

	for _, pred := range m.predictions {
		if pred.ActualOutcome == nil {
			continue
		}

		completed++
		predictedSuccess := pred.PredictedProb > 0.5
		if predictedSuccess == *pred.ActualOutcome {
			correct++
		}
	}

	if completed > 0 {
		m.accuracy = float64(correct) / float64(completed)
		log.Printf("Current accuracy: %.4f (%d/%d)", m.accuracy, correct, completed)
	}
}

// checkDrift checks if model accuracy has dropped below threshold
func (m *Monitor) checkDrift() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.accuracy > 0 && m.accuracy < m.driftThreshold {
		log.Printf("WARNING: Model drift detected! Accuracy %.4f < threshold %.4f",
			m.accuracy, m.driftThreshold)
		
		// In production:
		// - Trigger retraining pipeline
		// - Pause ML finalization (fallback to FDC-only)
		// - Alert operators
	}
}

// GetStats returns monitoring statistics
func (m *Monitor) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return map[string]interface{}{
		"total_predictions": len(m.predictions),
		"completed_predictions": len(m.actuals),
		"accuracy": m.accuracy,
		"drift_threshold": m.driftThreshold,
		"drift_detected": m.accuracy > 0 && m.accuracy < m.driftThreshold,
	}
}

