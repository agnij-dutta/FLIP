package aggregator

import (
	"math"
	"sort"
	"time"

	"../storage"
)

// FeatureAggregator computes ML features from time-series data
type FeatureAggregator struct {
	db storage.TimeSeriesDB
}

// NewFeatureAggregator creates a new aggregator
func NewFeatureAggregator(db storage.TimeSeriesDB) *FeatureAggregator {
	return &FeatureAggregator{db: db}
}

// ComputeFTSOVolatility computes rolling volatility over windows
func (fa *FeatureAggregator) ComputeFTSOVolatility(symbol string, window1h, window24h int) (map[string]float64, error) {
	now := time.Now()
	prices1h, err := fa.db.QueryFTSOPrices(symbol, now.Add(-1*time.Hour), now)
	if err != nil {
		return nil, err
	}

	prices24h, err := fa.db.QueryFTSOPrices(symbol, now.Add(-24*time.Hour), now)
	if err != nil {
		return nil, err
	}

	vol1h := computeStdDev(prices1h)
	vol24h := computeStdDev(prices24h)

	return map[string]float64{
		"volatility_1h":  vol1h,
		"volatility_24h": vol24h,
	}, nil
}

// ComputeFDCSuccessRate computes recent redemption success rate
func (fa *FeatureAggregator) ComputeFDCSuccessRate(window int) (float64, error) {
	now := time.Now()
	redemptions, err := fa.db.QueryRedemptions(now.Add(-7*24*time.Hour), now)
	if err != nil {
		return 0, err
	}

	if len(redemptions) == 0 {
		return 1.0, nil // Default optimistic
	}

	// Get recent N redemptions
	recent := redemptions
	if len(recent) > window {
		recent = recent[len(recent)-window:]
	}

	successCount := 0
	for _, r := range recent {
		if r.Status == "completed" {
			successCount++
		}
	}

	return float64(successCount) / float64(len(recent)), nil
}

// ComputeFDCLatencyStats computes latency distribution
func (fa *FeatureAggregator) ComputeFDCLatencyStats() (map[string]float64, error) {
	now := time.Now()
	attestations, err := fa.db.QueryFDCAttestations(now.Add(-7*24*time.Hour), now)
	if err != nil {
		return nil, err
	}

	if len(attestations) == 0 {
		return map[string]float64{
			"mean": 180.0,
			"p95":  300.0,
			"p99":  360.0,
		}, nil
	}

	latencies := make([]float64, len(attestations))
	for i, att := range attestations {
		latencies[i] = att.Latency.Seconds()
	}

	sort.Float64s(latencies)

	mean := average(latencies)
	p95 := percentile(latencies, 0.95)
	p99 := percentile(latencies, 0.99)

	return map[string]float64{
		"mean": mean,
		"p95":  p95,
		"p99":  p99,
		"std":  stdDev(latencies),
	}, nil
}

// Helper functions
func computeStdDev(prices []storage.FTSOPricePoint) float64 {
	if len(prices) < 2 {
		return 0.0
	}

	values := make([]float64, len(prices))
	for i, p := range prices {
		values[i] = float64(p.Price)
	}

	return stdDev(values)
}

func average(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func stdDev(values []float64) float64 {
	if len(values) < 2 {
		return 0.0
	}

	mean := average(values)
	sumSqDiff := 0.0
	for _, v := range values {
		diff := v - mean
		sumSqDiff += diff * diff
	}

	return math.Sqrt(sumSqDiff / float64(len(values)-1))
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0.0
	}
	idx := int(float64(len(sorted)) * p)
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

