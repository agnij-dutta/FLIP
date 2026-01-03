#!/usr/bin/env python3
"""
Demo script to show deterministic scoring logic (matches Solidity implementation)
"""
import math
from typing import Tuple

# Constants (scaled: 1000000 = 100%)
BASE_SUCCESS_RATE = 980000  # 98%
MAX_VOLATILITY = 50000  # 5%
SMALL_AMOUNT_THRESHOLD = 1000 * 1e18
MEDIUM_AMOUNT_THRESHOLD = 10000 * 1e18
LARGE_AMOUNT_THRESHOLD = 100000 * 1e18
MIN_STAKE = 100000 * 1e18
PROVISIONAL_THRESHOLD = 997000  # 99.7%
LOW_CONFIDENCE_THRESHOLD = 950000  # 95%


def calculate_stability_multiplier(volatility: int) -> int:
    """Calculate price stability multiplier (0.8 - 1.2)"""
    if volatility >= MAX_VOLATILITY:
        return 800000  # 0.8x
    # Linear: 1.2 at 0%, 0.8 at 5%
    multiplier = 1200000 - (volatility * 400000) // MAX_VOLATILITY
    return max(800000, min(1200000, multiplier))


def calculate_amount_multiplier(amount: int) -> int:
    """Calculate amount risk multiplier (0.9 - 1.1)"""
    if amount < SMALL_AMOUNT_THRESHOLD:
        return 1100000  # 1.1x
    elif amount < MEDIUM_AMOUNT_THRESHOLD:
        # Linear: 1.1 at small, 1.0 at medium
        range_size = MEDIUM_AMOUNT_THRESHOLD - SMALL_AMOUNT_THRESHOLD
        excess = amount - SMALL_AMOUNT_THRESHOLD
        return 1100000 - (excess * 100000) // range_size
    else:
        # Linear: 1.0 at medium, 0.9 at large
        range_size = LARGE_AMOUNT_THRESHOLD - MEDIUM_AMOUNT_THRESHOLD
        excess = amount - MEDIUM_AMOUNT_THRESHOLD
        if excess >= range_size:
            return 900000  # 0.9x minimum
        return 1000000 - (excess * 100000) // range_size


def calculate_time_multiplier(hour: int) -> int:
    """Calculate time-of-day multiplier (0.95 - 1.05)"""
    if 2 <= hour <= 5:  # Low activity
        return 950000
    if (9 <= hour <= 11) or (14 <= hour <= 16):  # High activity
        return 1050000
    return 1000000  # Normal


def calculate_agent_multiplier(success_rate: int, stake: int) -> int:
    """Calculate agent reputation multiplier (0.85 - 1.15)"""
    # Base: 0.85 + (successRate * 0.15)
    base_multiplier = 850000 + (success_rate * 150000) // 1000000
    
    # Stake bonus: up to 0.15x
    stake_bonus = 0
    if stake >= MIN_STAKE:
        excess_stake = stake - MIN_STAKE
        max_bonus = 150000
        if excess_stake >= MIN_STAKE:
            stake_bonus = max_bonus
        else:
            stake_bonus = (excess_stake * max_bonus) // MIN_STAKE
    
    total = base_multiplier + stake_bonus
    return min(1150000, total)


def calculate_score(
    price_volatility: int,
    amount: int,
    agent_success_rate: int,
    agent_stake: int,
    hour_of_day: int
) -> Tuple[int, int, int, bool, str]:
    """
    Calculate deterministic score.
    
    Returns:
        (score, confidence_lower, confidence_upper, can_provisional, decision)
    """
    # Start with base score
    score = BASE_SUCCESS_RATE
    
    # Apply multipliers
    stability_mult = calculate_stability_multiplier(price_volatility)
    amount_mult = calculate_amount_multiplier(amount)
    time_mult = calculate_time_multiplier(hour_of_day)
    agent_mult = calculate_agent_multiplier(agent_success_rate, agent_stake)
    
    # Multiply: score = base × stability × amount × time × agent
    score = (score * stability_mult) // 1000000
    score = (score * amount_mult) // 1000000
    score = (score * time_mult) // 1000000
    score = (score * agent_mult) // 1000000
    
    # Cap at 100%
    score = min(1000000, score)
    
    # Confidence intervals (2% adjustment)
    confidence_lower = (score * 98) // 100
    confidence_upper = min(1000000, (score * 102) // 100)
    
    # Can provisional settle?
    max_volatility_for_provisional = 20000  # 2%
    can_provisional = (
        confidence_lower >= PROVISIONAL_THRESHOLD and
        price_volatility < max_volatility_for_provisional and
        amount < MEDIUM_AMOUNT_THRESHOLD and
        agent_stake >= MIN_STAKE
    )
    
    # Decision
    if can_provisional:
        decision = "ProvisionalSettle"
    elif confidence_lower >= LOW_CONFIDENCE_THRESHOLD:
        decision = "BufferEarmark"
    else:
        decision = "QueueFDC"
    
    return score, confidence_lower, confidence_upper, can_provisional, decision


def main():
    print("🧮 FLIP Deterministic Scoring Demo\n")
    print("=" * 60)
    
    # Test Case 1: High Confidence
    print("\n📊 Test Case 1: High Confidence Scenario")
    print("-" * 60)
    print("Inputs:")
    print("  Price Volatility: 1%")
    print("  Amount: 100 tokens")
    print("  Agent Success Rate: 99%")
    print("  Agent Stake: 200k tokens")
    print("  Hour: 10 AM (high activity)")
    
    score, lower, upper, can_prov, decision = calculate_score(
        price_volatility=10000,  # 1%
        amount=int(100 * 1e18),
        agent_success_rate=990000,  # 99%
        agent_stake=int(200000 * 1e18),
        hour_of_day=10
    )
    
    print(f"\nResults:")
    print(f"  Score: {score/10000:.2f}%")
    print(f"  Confidence: {lower/10000:.2f}% - {upper/10000:.2f}%")
    print(f"  Can Provisional: {can_prov}")
    print(f"  Decision: {decision}")
    
    # Test Case 2: Medium Confidence
    print("\n📊 Test Case 2: Medium Confidence Scenario")
    print("-" * 60)
    print("Inputs:")
    print("  Price Volatility: 3%")
    print("  Amount: 5k tokens")
    print("  Agent Success Rate: 97%")
    print("  Agent Stake: 150k tokens")
    print("  Hour: 6 AM (normal)")
    
    score, lower, upper, can_prov, decision = calculate_score(
        price_volatility=30000,  # 3%
        amount=int(5000 * 1e18),
        agent_success_rate=970000,  # 97%
        agent_stake=int(150000 * 1e18),
        hour_of_day=6
    )
    
    print(f"\nResults:")
    print(f"  Score: {score/10000:.2f}%")
    print(f"  Confidence: {lower/10000:.2f}% - {upper/10000:.2f}%")
    print(f"  Can Provisional: {can_prov}")
    print(f"  Decision: {decision}")
    
    # Test Case 3: Low Confidence
    print("\n📊 Test Case 3: Low Confidence Scenario")
    print("-" * 60)
    print("Inputs:")
    print("  Price Volatility: 6%")
    print("  Amount: 100k tokens")
    print("  Agent Success Rate: 90%")
    print("  Agent Stake: 50k tokens")
    print("  Hour: 3 AM (low activity)")
    
    score, lower, upper, can_prov, decision = calculate_score(
        price_volatility=60000,  # 6%
        amount=int(100000 * 1e18),
        agent_success_rate=900000,  # 90%
        agent_stake=int(50000 * 1e18),
        hour_of_day=3
    )
    
    print(f"\nResults:")
    print(f"  Score: {score/10000:.2f}%")
    print(f"  Confidence: {lower/10000:.2f}% - {upper/10000:.2f}%")
    print(f"  Can Provisional: {can_prov}")
    print(f"  Decision: {decision}")
    
    print("\n" + "=" * 60)
    print("✅ Scoring demo complete!")
    print("\nThis matches the Solidity implementation in DeterministicScoring.sol")


if __name__ == "__main__":
    main()

