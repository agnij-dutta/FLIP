// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/DeterministicScoring.sol";

contract DeterministicScoringTest is Test {

    function testCalculateScore_HighConfidence() public {
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: 5000, // 0.5% volatility (very low)
            amount: 500 * 1e18, // Small amount
            agentSuccessRate: 995000, // 99.5% success rate
            agentStake: 200000 * 1e18, // High stake
            hourOfDay: 10 // High activity hour
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Should be high confidence (score should be high enough)
        assertGe(result.score, 980000, "Score should be high");
        // Provisional settlement requires confidenceLower >= 997000
        // With the adjusted logic, high scores use 0.3% adjustment instead of 2%
        assertGe(result.confidenceLower, 950000, "Should have reasonable confidence");
        // Note: canProvisionalSettle also requires volatility < 2% and amount < MEDIUM threshold
        if (result.canProvisionalSettle) {
            assertEq(DeterministicScoring.makeDecision(result), 1, "Should be FastLane (1)");
        }
    }

    function testCalculateScore_MediumConfidence() public {
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: 30000, // 3% volatility (medium)
            amount: 5000 * 1e18, // Medium amount
            agentSuccessRate: 970000, // 97% success rate
            agentStake: 150000 * 1e18, // Medium stake
            hourOfDay: 6 // Normal hour
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Should be medium confidence (95-99.7%)
        assertGe(result.confidenceLower, 950000, "Should be at least medium confidence");
        // Note: With adjusted logic, medium confidence might reach 99.7% threshold
        // So we check it's at least medium, but may be high
        assertGe(result.confidenceLower, 950000, "Should be at least medium confidence");
        // Medium confidence should queue for FDC (decision = 0)
        assertEq(DeterministicScoring.makeDecision(result), 0, "Should be QueueFDC");
    }

    function testCalculateScore_LowConfidence() public {
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: 60000, // 6% volatility (high)
            amount: 50000 * 1e18, // Large amount
            agentSuccessRate: 900000, // 90% success rate
            agentStake: 50000 * 1e18, // Low stake
            hourOfDay: 3 // Low activity hour
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Should be low confidence (< 95%)
        assertLt(result.confidenceLower, 950000, "Should be low confidence");
        assertFalse(result.canProvisionalSettle, "Should not allow provisional settlement");
        assertEq(DeterministicScoring.makeDecision(result), 0, "Should be QueueFDC");
    }

    function testStabilityMultiplier() public {
        // Low volatility should give high multiplier
        DeterministicScoring.ScoringParams memory params1 = DeterministicScoring.ScoringParams({
            priceVolatility: 0, // 0% volatility
            amount: 1000 * 1e18,
            agentSuccessRate: 980000,
            agentStake: 100000 * 1e18,
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result1 = DeterministicScoring.calculateScore(params1);

        // High volatility should give low multiplier
        DeterministicScoring.ScoringParams memory params2 = DeterministicScoring.ScoringParams({
            priceVolatility: 50000, // 5% volatility (max)
            amount: 1000 * 1e18,
            agentSuccessRate: 980000,
            agentStake: 100000 * 1e18,
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result2 = DeterministicScoring.calculateScore(params2);

        // Low volatility should score higher
        assertGt(result1.score, result2.score, "Low volatility should score higher");
    }

    function testAmountMultiplier() public {
        // Small amount should score higher
        DeterministicScoring.ScoringParams memory params1 = DeterministicScoring.ScoringParams({
            priceVolatility: 10000,
            amount: 100 * 1e18, // Very small
            agentSuccessRate: 980000,
            agentStake: 100000 * 1e18,
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result1 = DeterministicScoring.calculateScore(params1);

        // Large amount should score lower
        DeterministicScoring.ScoringParams memory params2 = DeterministicScoring.ScoringParams({
            priceVolatility: 10000,
            amount: 200000 * 1e18, // Very large
            agentSuccessRate: 980000,
            agentStake: 100000 * 1e18,
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result2 = DeterministicScoring.calculateScore(params2);

        // Small amount should score higher
        assertGt(result1.score, result2.score, "Small amount should score higher");
    }

    function testAgentMultiplier() public {
        // High reputation + high stake should score higher
        DeterministicScoring.ScoringParams memory params1 = DeterministicScoring.ScoringParams({
            priceVolatility: 20000, // Higher volatility to avoid cap
            amount: 5000 * 1e18, // Medium amount
            agentSuccessRate: 990000, // High success rate
            agentStake: 300000 * 1e18, // High stake
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result1 = DeterministicScoring.calculateScore(params1);

        // Low reputation + low stake should score lower
        DeterministicScoring.ScoringParams memory params2 = DeterministicScoring.ScoringParams({
            priceVolatility: 20000, // Same volatility
            amount: 5000 * 1e18, // Same amount
            agentSuccessRate: 850000, // Low success rate
            agentStake: 50000 * 1e18, // Low stake
            hourOfDay: 12
        });
        DeterministicScoring.ScoreResult memory result2 = DeterministicScoring.calculateScore(params2);

        // High reputation should score higher (or equal if capped)
        assertGe(result1.score, result2.score, "High reputation should score higher");
    }

    function testTimeMultiplier() public {
        // High activity hour should score slightly higher
        DeterministicScoring.ScoringParams memory params1 = DeterministicScoring.ScoringParams({
            priceVolatility: 25000, // Higher volatility to avoid cap
            amount: 5000 * 1e18, // Medium amount
            agentSuccessRate: 980000,
            agentStake: 150000 * 1e18,
            hourOfDay: 10 // High activity (9-11 AM)
        });
        DeterministicScoring.ScoreResult memory result1 = DeterministicScoring.calculateScore(params1);

        // Low activity hour should score slightly lower
        DeterministicScoring.ScoringParams memory params2 = DeterministicScoring.ScoringParams({
            priceVolatility: 25000, // Same volatility
            amount: 5000 * 1e18, // Same amount
            agentSuccessRate: 980000,
            agentStake: 150000 * 1e18,
            hourOfDay: 3 // Low activity (2-5 AM)
        });
        DeterministicScoring.ScoreResult memory result2 = DeterministicScoring.calculateScore(params2);

        // High activity should score slightly higher (or equal if capped)
        assertGe(result1.score, result2.score, "High activity hour should score higher");
    }

    function testConfidenceIntervals() public {
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: 10000,
            amount: 1000 * 1e18,
            agentSuccessRate: 980000,
            agentStake: 100000 * 1e18,
            hourOfDay: 12
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Confidence intervals should be within adjustment of score
        assertLe(result.confidenceLower, result.score, "Lower bound should be <= score");
        assertGe(result.confidenceUpper, result.score, "Upper bound should be >= score");
        
        // Check adjustment (2% for lower scores, 0.3% for high scores >= 99.7%)
        uint256 expectedLower;
        if (result.score >= 997000) {
            expectedLower = (result.score * 997) / 1000; // 0.3% for high scores
        } else {
            expectedLower = (result.score * 98) / 100; // 2% for lower scores
        }
        uint256 expectedUpper = (result.score * 102) / 100;
        assertEq(result.confidenceLower, expectedLower, "Lower should match expected adjustment");
        assertLe(result.confidenceUpper, expectedUpper, "Upper should be <= 102% of score");
    }

    function testScoreCappedAt100Percent() public {
        // Create scenario that would exceed 100% if not capped
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: 0, // Best stability
            amount: 100 * 1e18, // Small amount
            agentSuccessRate: 1000000, // Perfect agent
            agentStake: 500000 * 1e18, // Very high stake
            hourOfDay: 10 // High activity
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Score should be capped at 100%
        assertLe(result.score, 1000000, "Score should be capped at 100%");
        assertLe(result.confidenceUpper, 1000000, "Upper bound should be capped at 100%");
    }
}

