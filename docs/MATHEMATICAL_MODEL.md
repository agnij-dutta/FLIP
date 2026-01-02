# FLIP Mathematical Decision Model (MVP)

## Overview

Replaces ML predictions with deterministic, rule-based scoring system for provisional settlement decisions.

## Core Principle

**Deterministic Scoring**: Every redemption gets a score based on observable on-chain metrics. No ML, no black boxes.

## Scoring Formula

```
Score = BaseScore × StabilityMultiplier × AmountMultiplier × TimeMultiplier × AgentMultiplier

Where:
- BaseScore: Historical success rate for asset (e.g., 0.98 for FXRP)
- StabilityMultiplier: FTSO price stability (0.8 - 1.2)
- AmountMultiplier: Amount risk factor (0.9 - 1.1)
- TimeMultiplier: Time-of-day factor (0.95 - 1.05)
- AgentMultiplier: Agent reputation (0.85 - 1.15)

Final Score Range: 0.0 - 1.0
```

## Decision Rules

### High Confidence (Provisional Settlement)
```
IF score >= 0.997 AND
   priceVolatility < 0.02 AND
   amount < maxProvisionalAmount AND
   agentStake >= minStake
THEN: Provisional settlement
```

### Medium Confidence (Buffer/Earmark)
```
IF 0.95 <= score < 0.997
THEN: Earmark insurance, wait for FDC
```

### Low Confidence (Queue for FDC)
```
IF score < 0.95 OR
   priceVolatility >= 0.02 OR
   amount >= maxProvisionalAmount
THEN: Queue for FDC, no provisional
```

## Components

### 1. Price Stability Score
```
stabilityScore = 1.0 - min(priceVolatility / maxVolatility, 1.0)
where:
- priceVolatility = std(price_last_10_blocks) / mean(price_last_10_blocks)
- maxVolatility = 0.05 (5% threshold)
```

### 2. Amount Risk Score
```
IF amount < smallAmountThreshold:
    amountScore = 1.0
ELIF amount < mediumAmountThreshold:
    amountScore = 1.0 - (amount - smallAmountThreshold) / (mediumAmountThreshold - smallAmountThreshold) * 0.1
ELSE:
    amountScore = 0.9 - (amount - mediumAmountThreshold) / largeAmountThreshold * 0.1
```

### 3. Agent Reputation Score
```
agentScore = min(agentSuccessRate * agentStakeMultiplier, 1.15)
where:
- agentSuccessRate = completedRedemptions / totalRedemptions (last 30 days)
- agentStakeMultiplier = min(agentStake / minStake, 1.5)
```

### 4. Time Factor
```
timeScore = 1.0 (base)
IF hour in [2, 3, 4, 5]:  // Low activity hours
    timeScore = 0.95
IF hour in [9, 10, 11, 14, 15, 16]:  // High activity hours
    timeScore = 1.05
```

## Confidence Intervals

Instead of ML confidence intervals, use deterministic bounds:

```
confidenceLower = score × 0.98  // 2% conservative adjustment
confidenceUpper = min(score × 1.02, 1.0)  // 2% optimistic, capped at 1.0
```

## Advantages

1. **Deterministic**: Same inputs → same output (no randomness)
2. **Transparent**: All rules are on-chain, auditable
3. **Fast**: No ML inference, just calculations
4. **Debuggable**: Can trace exactly why a decision was made
5. **Upgradeable**: Can adjust thresholds via governance

## Implementation

- **On-Chain**: FLIPCore computes score directly (no oracle needed for simple cases)
- **Oracle Nodes**: Only needed for complex calculations or external data
- **Governance**: Thresholds can be updated via multisig/DAO

