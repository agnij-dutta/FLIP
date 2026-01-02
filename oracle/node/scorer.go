package main

import (
	"math/big"
	"time"
)

// DeterministicScorer calculates redemption scores without ML
type DeterministicScorer struct {
	// Configuration (can be updated via governance)
	baseSuccessRate    *big.Int // 980000 = 98% (scaled: 1000000 = 100%)
	maxVolatility      *big.Int // 50000 = 5%
	smallAmountThreshold *big.Int
	mediumAmountThreshold *big.Int
	largeAmountThreshold  *big.Int
	minStake            *big.Int
	provisionalThreshold *big.Int // 997000 = 99.7%
}

// NewDeterministicScorer creates a new scorer with default parameters
func NewDeterministicScorer() *DeterministicScorer {
	return &DeterministicScorer{
		baseSuccessRate:      big.NewInt(980000),
		maxVolatility:        big.NewInt(50000),
		smallAmountThreshold: big.NewInt(1000).Mul(big.NewInt(1000), big.NewInt(1e18)),
		mediumAmountThreshold: big.NewInt(10000).Mul(big.NewInt(10000), big.NewInt(1e18)),
		largeAmountThreshold:  big.NewInt(100000).Mul(big.NewInt(100000), big.NewInt(1e18)),
		minStake:             big.NewInt(100000).Mul(big.NewInt(100000), big.NewInt(1e18)),
		provisionalThreshold: big.NewInt(997000),
	}
}

// ScoringParams contains all inputs for scoring
type ScoringParams struct {
	PriceVolatility *big.Int // Scaled: 1000000 = 100%
	Amount          *big.Int
	AgentSuccessRate *big.Int // Scaled: 1000000 = 100%
	AgentStake      *big.Int
	HourOfDay       int
}

// ScoreResult contains the calculated score and decision
type ScoreResult struct {
	Score              *big.Int // Final score (scaled: 1000000 = 100%)
	ConfidenceLower    *big.Int
	ConfidenceUpper    *big.Int
	CanProvisionalSettle bool
	Decision           uint8 // 0=QueueFDC, 1=BufferEarmark, 2=ProvisionalSettle
}

// CalculateScore computes deterministic score for a redemption
func (ds *DeterministicScorer) CalculateScore(params ScoringParams) ScoreResult {
	// Start with base score
	score := new(big.Int).Set(ds.baseSuccessRate)

	// Apply multipliers
	stabilityMult := ds.calculateStabilityMultiplier(params.PriceVolatility)
	amountMult := ds.calculateAmountMultiplier(params.Amount)
	timeMult := ds.calculateTimeMultiplier(params.HourOfDay)
	agentMult := ds.calculateAgentMultiplier(params.AgentSuccessRate, params.AgentStake)

	// Multiply: score = base × stability × amount × time × agent
	// All scaled by 1e6, so divide by 1e6 for each multiplication
	score.Mul(score, stabilityMult)
	score.Div(score, big.NewInt(1e6))
	score.Mul(score, amountMult)
	score.Div(score, big.NewInt(1e6))
	score.Mul(score, timeMult)
	score.Div(score, big.NewInt(1e6))
	score.Mul(score, agentMult)
	score.Div(score, big.NewInt(1e6))

	// Cap at 100%
	maxScore := big.NewInt(1000000)
	if score.Cmp(maxScore) > 0 {
		score.Set(maxScore)
	}

	// Calculate confidence intervals (2% adjustment)
	confidenceLower := new(big.Int).Mul(score, big.NewInt(98))
	confidenceLower.Div(confidenceLower, big.NewInt(100))

	confidenceUpper := new(big.Int).Mul(score, big.NewInt(102))
	confidenceUpper.Div(confidenceUpper, big.NewInt(100))
	if confidenceUpper.Cmp(maxScore) > 0 {
		confidenceUpper.Set(maxScore)
	}

	// Determine if provisional settlement is allowed
	maxVolatilityForProvisional := big.NewInt(20000) // 2%
	canProvisionalSettle := confidenceLower.Cmp(ds.provisionalThreshold) >= 0 &&
		params.PriceVolatility.Cmp(maxVolatilityForProvisional) < 0 &&
		params.Amount.Cmp(ds.mediumAmountThreshold) < 0 &&
		params.AgentStake.Cmp(ds.minStake) >= 0

	// Make decision
	var decision uint8
	if canProvisionalSettle {
		decision = 2 // ProvisionalSettle
	} else if confidenceLower.Cmp(big.NewInt(950000)) >= 0 {
		decision = 1 // BufferEarmark
	} else {
		decision = 0 // QueueFDC
	}

	return ScoreResult{
		Score:              score,
		ConfidenceLower:    confidenceLower,
		ConfidenceUpper:    confidenceUpper,
		CanProvisionalSettle: canProvisionalSettle,
		Decision:           decision,
	}
}

// calculateStabilityMultiplier returns 0.8 - 1.2 based on volatility
func (ds *DeterministicScorer) calculateStabilityMultiplier(volatility *big.Int) *big.Int {
	if volatility.Cmp(ds.maxVolatility) >= 0 {
		return big.NewInt(800000) // 0.8x
	}

	// Linear: 1.2 at 0%, 0.8 at 5%
	// multiplier = 1200000 - (volatility * 400000) / maxVolatility
	multiplier := big.NewInt(1200000)
	volatilityFactor := new(big.Int).Mul(volatility, big.NewInt(400000))
	volatilityFactor.Div(volatilityFactor, ds.maxVolatility)
	multiplier.Sub(multiplier, volatilityFactor)

	// Ensure bounds
	if multiplier.Cmp(big.NewInt(800000)) < 0 {
		multiplier.Set(big.NewInt(800000))
	}
	if multiplier.Cmp(big.NewInt(1200000)) > 0 {
		multiplier.Set(big.NewInt(1200000))
	}

	return multiplier
}

// calculateAmountMultiplier returns 0.9 - 1.1 based on amount
func (ds *DeterministicScorer) calculateAmountMultiplier(amount *big.Int) *big.Int {
	if amount.Cmp(ds.smallAmountThreshold) < 0 {
		return big.NewInt(1100000) // 1.1x
	} else if amount.Cmp(ds.mediumAmountThreshold) < 0 {
		// Linear: 1.1 at small, 1.0 at medium
		rangeSize := new(big.Int).Sub(ds.mediumAmountThreshold, ds.smallAmountThreshold)
		excess := new(big.Int).Sub(amount, ds.smallAmountThreshold)
		multiplier := big.NewInt(1100000)
		reduction := new(big.Int).Mul(excess, big.NewInt(100000))
		reduction.Div(reduction, rangeSize)
		multiplier.Sub(multiplier, reduction)
		return multiplier
	} else {
		// Linear: 1.0 at medium, 0.9 at large
		rangeSize := new(big.Int).Sub(ds.largeAmountThreshold, ds.mediumAmountThreshold)
		excess := new(big.Int).Sub(amount, ds.mediumAmountThreshold)
		if excess.Cmp(rangeSize) >= 0 {
			return big.NewInt(900000) // 0.9x minimum
		}
		multiplier := big.NewInt(1000000)
		reduction := new(big.Int).Mul(excess, big.NewInt(100000))
		reduction.Div(reduction, rangeSize)
		multiplier.Sub(multiplier, reduction)
		return multiplier
	}
}

// calculateTimeMultiplier returns 0.95 - 1.05 based on hour
func (ds *DeterministicScorer) calculateTimeMultiplier(hour int) *big.Int {
	// Low activity hours (2-5 AM): 0.95x
	if hour >= 2 && hour <= 5 {
		return big.NewInt(950000)
	}
	// High activity hours (9-11 AM, 2-4 PM): 1.05x
	if (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) {
		return big.NewInt(1050000)
	}
	// Normal: 1.0x
	return big.NewInt(1000000)
}

// calculateAgentMultiplier returns 0.85 - 1.15 based on agent reputation
func (ds *DeterministicScorer) calculateAgentMultiplier(successRate, stake *big.Int) *big.Int {
	// Base: 0.85 + (successRate * 0.15)
	baseMultiplier := big.NewInt(850000)
	successBonus := new(big.Int).Mul(successRate, big.NewInt(150000))
	successBonus.Div(successBonus, big.NewInt(1000000))
	baseMultiplier.Add(baseMultiplier, successBonus)

	// Stake bonus: up to 0.15x for high stake
	stakeBonus := big.NewInt(0)
	if stake.Cmp(ds.minStake) >= 0 {
		excessStake := new(big.Int).Sub(stake, ds.minStake)
		maxBonus := big.NewInt(150000)
		if excessStake.Cmp(ds.minStake) >= 0 {
			stakeBonus.Set(maxBonus)
		} else {
			stakeBonus.Mul(excessStake, maxBonus)
			stakeBonus.Div(stakeBonus, ds.minStake)
		}
	}

	totalMultiplier := new(big.Int).Add(baseMultiplier, stakeBonus)
	if totalMultiplier.Cmp(big.NewInt(1150000)) > 0 {
		totalMultiplier.Set(big.NewInt(1150000))
	}

	return totalMultiplier
}

// GetPriceVolatility calculates price volatility from recent FTSO prices
func GetPriceVolatility(recentPrices []*big.Int) *big.Int {
	if len(recentPrices) < 2 {
		return big.NewInt(0) // No volatility if insufficient data
	}

	// Calculate mean
	sum := new(big.Int)
	for _, price := range recentPrices {
		sum.Add(sum, price)
	}
	mean := new(big.Int).Div(sum, big.NewInt(int64(len(recentPrices))))

	// Calculate variance
	variance := big.NewInt(0)
	for _, price := range recentPrices {
		diff := new(big.Int).Sub(price, mean)
		diffSq := new(big.Int).Mul(diff, diff)
		variance.Add(variance, diffSq)
	}
	variance.Div(variance, big.NewInt(int64(len(recentPrices))))

	// Standard deviation
	stdDev := new(big.Int).Sqrt(variance)

	// Volatility as percentage (scaled: 1000000 = 100%)
	// volatility = (stdDev / mean) * 1000000
	if mean.Cmp(big.NewInt(0)) == 0 {
		return big.NewInt(0)
	}
	volatility := new(big.Int).Mul(stdDev, big.NewInt(1000000))
	volatility.Div(volatility, mean)

	return volatility
}

// GetAgentSuccessRate calculates agent success rate from historical data
func GetAgentSuccessRate(completed, total int) *big.Int {
	if total == 0 {
		return big.NewInt(980000) // Default 98% if no history
	}
	// successRate = (completed / total) * 1000000
	successRate := big.NewInt(int64(completed))
	successRate.Mul(successRate, big.NewInt(1000000))
	successRate.Div(successRate, big.NewInt(int64(total)))
	return successRate
}

// GetCurrentHour returns current hour of day (0-23)
func GetCurrentHour() int {
	return time.Now().Hour()
}

