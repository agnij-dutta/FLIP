// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DeterministicScoring
 * @notice Mathematical scoring system for redemption decisions (replaces ML)
 * @dev All calculations are deterministic and on-chain
 */
library DeterministicScoring {
    // Configuration parameters (can be set via governance)
    uint256 public constant BASE_SUCCESS_RATE = 980000; // 98% (scaled: 1000000 = 100%)
    uint256 public constant MAX_VOLATILITY = 50000; // 5% (scaled)
    uint256 public constant SMALL_AMOUNT_THRESHOLD = 1000 * 1e18; // 1000 tokens
    uint256 public constant MEDIUM_AMOUNT_THRESHOLD = 10000 * 1e18; // 10000 tokens
    uint256 public constant LARGE_AMOUNT_THRESHOLD = 100000 * 1e18; // 100000 tokens
    uint256 public constant MIN_STAKE = 100000 * 1e18; // $100k equivalent
    uint256 public constant PROVISIONAL_THRESHOLD = 997000; // 99.7% (scaled)
    uint256 public constant LOW_CONFIDENCE_THRESHOLD = 950000; // 95% (scaled)
    
    struct ScoringParams {
        uint256 priceVolatility; // Price volatility (scaled: 1000000 = 100%)
        uint256 amount; // Redemption amount
        uint256 agentSuccessRate; // Agent historical success rate (scaled)
        uint256 agentStake; // Agent stake amount
        uint256 hourOfDay; // 0-23
    }
    
    struct ScoreResult {
        uint256 score; // Final score (scaled: 1000000 = 100%)
        uint256 confidenceLower; // Lower confidence bound
        uint256 confidenceUpper; // Upper confidence bound
        bool canProvisionalSettle; // Whether provisional settlement is allowed
    }
    
    /**
     * @notice Calculate deterministic score for a redemption
     * @param params Scoring parameters
     * @return result Score and confidence intervals
     */
    function calculateScore(ScoringParams memory params) 
        internal 
        pure 
        returns (ScoreResult memory result) 
    {
        // Base score from historical success rate
        uint256 baseScore = BASE_SUCCESS_RATE;
        
        // 1. Price stability multiplier (0.8 - 1.2)
        uint256 stabilityMultiplier = calculateStabilityMultiplier(params.priceVolatility);
        
        // 2. Amount risk multiplier (0.9 - 1.1)
        uint256 amountMultiplier = calculateAmountMultiplier(params.amount);
        
        // 3. Time factor multiplier (0.95 - 1.05)
        uint256 timeMultiplier = calculateTimeMultiplier(params.hourOfDay);
        
        // 4. Agent reputation multiplier (0.85 - 1.15)
        uint256 agentMultiplier = calculateAgentMultiplier(
            params.agentSuccessRate,
            params.agentStake
        );
        
        // Calculate final score
        // score = base × stability × amount × time × agent
        // All scaled by 1e6, so divide by 1e6 for each multiplication
        uint256 score = baseScore;
        score = (score * stabilityMultiplier) / 1e6;
        score = (score * amountMultiplier) / 1e6;
        score = (score * timeMultiplier) / 1e6;
        score = (score * agentMultiplier) / 1e6;
        
        // Cap at 100%
        if (score > 1000000) {
            score = 1000000;
        }
        
        // Calculate confidence intervals (2% adjustment)
        uint256 confidenceLower = (score * 98) / 100; // 2% conservative
        uint256 confidenceUpper = (score * 102) / 100; // 2% optimistic
        if (confidenceUpper > 1000000) {
            confidenceUpper = 1000000;
        }
        
        // Determine if provisional settlement is allowed
        bool canProvisionalSettle = (
            confidenceLower >= PROVISIONAL_THRESHOLD &&
            params.priceVolatility < 20000 && // 2% max volatility
            params.amount < MEDIUM_AMOUNT_THRESHOLD &&
            params.agentStake >= MIN_STAKE
        );
        
        result = ScoreResult({
            score: score,
            confidenceLower: confidenceLower,
            confidenceUpper: confidenceUpper,
            canProvisionalSettle: canProvisionalSettle
        });
    }
    
    /**
     * @notice Calculate price stability multiplier
     * @param volatility Price volatility (scaled: 1000000 = 100%)
     * @return multiplier Stability multiplier (scaled: 1000000 = 1.0)
     */
    function calculateStabilityMultiplier(uint256 volatility) 
        internal 
        pure 
        returns (uint256 multiplier) 
    {
        if (volatility >= MAX_VOLATILITY) {
            // High volatility: 0.8x
            return 800000;
        }
        
        // Linear interpolation: 1.2 at 0% volatility, 0.8 at 5% volatility
        // multiplier = 1200000 - (volatility * 400000) / MAX_VOLATILITY
        multiplier = 1200000 - (volatility * 400000) / MAX_VOLATILITY;
        
        // Ensure bounds
        if (multiplier < 800000) multiplier = 800000;
        if (multiplier > 1200000) multiplier = 1200000;
    }
    
    /**
     * @notice Calculate amount risk multiplier
     * @param amount Redemption amount
     * @return multiplier Amount multiplier (scaled: 1000000 = 1.0)
     */
    function calculateAmountMultiplier(uint256 amount) 
        internal 
        pure 
        returns (uint256 multiplier) 
    {
        if (amount < SMALL_AMOUNT_THRESHOLD) {
            // Small amounts: 1.1x (lower risk)
            return 1100000;
        } else if (amount < MEDIUM_AMOUNT_THRESHOLD) {
            // Medium amounts: linear decrease from 1.1 to 1.0
            uint256 range = MEDIUM_AMOUNT_THRESHOLD - SMALL_AMOUNT_THRESHOLD;
            uint256 excess = amount - SMALL_AMOUNT_THRESHOLD;
            multiplier = 1100000 - (excess * 100000) / range;
        } else {
            // Large amounts: linear decrease from 1.0 to 0.9
            uint256 range = LARGE_AMOUNT_THRESHOLD - MEDIUM_AMOUNT_THRESHOLD;
            uint256 excess = amount - MEDIUM_AMOUNT_THRESHOLD;
            if (excess >= range) {
                multiplier = 900000; // Minimum
            } else {
                multiplier = 1000000 - (excess * 100000) / range;
            }
        }
    }
    
    /**
     * @notice Calculate time-of-day multiplier
     * @param hour Hour of day (0-23)
     * @return multiplier Time multiplier (scaled: 1000000 = 1.0)
     */
    function calculateTimeMultiplier(uint256 hour) 
        internal 
        pure 
        returns (uint256 multiplier) 
    {
        // Low activity hours (2-5 AM): 0.95x
        if (hour >= 2 && hour <= 5) {
            return 950000;
        }
        
        // High activity hours (9-11 AM, 2-4 PM): 1.05x
        if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
            return 1050000;
        }
        
        // Normal hours: 1.0x
        return 1000000;
    }
    
    /**
     * @notice Calculate agent reputation multiplier
     * @param successRate Agent success rate (scaled: 1000000 = 100%)
     * @param stake Agent stake amount
     * @return multiplier Agent multiplier (scaled: 1000000 = 1.0)
     */
    function calculateAgentMultiplier(uint256 successRate, uint256 stake) 
        internal 
        pure 
        returns (uint256 multiplier) 
    {
        // Base multiplier from success rate (0.85 - 1.0)
        uint256 baseMultiplier = 850000 + (successRate * 150000) / 1000000;
        
        // Stake bonus (up to 1.15x for high stake)
        uint256 stakeBonus = 0;
        if (stake >= MIN_STAKE) {
            uint256 excessStake = stake - MIN_STAKE;
            uint256 maxBonus = 150000; // 15% max bonus
            // Linear: 1.15x at 2x min stake
            if (excessStake >= MIN_STAKE) {
                stakeBonus = maxBonus;
            } else {
                stakeBonus = (excessStake * maxBonus) / MIN_STAKE;
            }
        }
        
        multiplier = baseMultiplier + stakeBonus;
        
        // Cap at 1.15x
        if (multiplier > 1150000) {
            multiplier = 1150000;
        }
    }
    
    /**
     * @notice Determine redemption decision based on score
     * @param result Score result
     * @return decision Decision type: 0=QueueFDC, 1=BufferEarmark, 2=ProvisionalSettle
     */
    function makeDecision(ScoreResult memory result) 
        internal 
        pure 
        returns (uint8 decision) 
    {
        if (result.canProvisionalSettle) {
            return 2; // ProvisionalSettle
        } else if (result.confidenceLower >= LOW_CONFIDENCE_THRESHOLD) {
            return 1; // BufferEarmark
        } else {
            return 0; // QueueFDC
        }
    }
}

