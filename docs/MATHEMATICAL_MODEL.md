# FLIP Mathematical Decision Model v2 (Launchpad-Grade)

## Overview

**Deterministic, conservative, and explainable** — designed for testnet deployment and defensible for Flare Launchpad review.

**Core Principle**: ML later, determinism first. Every decision is reproducible, auditable, and on-chain.

## Key Invariant

**FLIP never finalizes value without FDC confirmation.**

```
∀ redemption R: Finalize(R) ⟹ FDC(P_A(R)) = true
```

This is the fundamental trust boundary: the settlement executor can move money, but only FDC can finalize value.

## Two-Metric Decision System

### 1. Settlement Confidence S(R)

**Purpose**: Determines if fast-lane provisional settlement is safe.

**Formula**:
```
S(R) = BaseScore × StabilityMultiplier × AmountMultiplier × TimeMultiplier × ExecutorMultiplier

Where:
- BaseScore: Historical success rate for asset (e.g., 0.98 for FXRP)
- StabilityMultiplier: FTSO price stability (0.8 - 1.2)
- AmountMultiplier: Amount risk factor (0.9 - 1.1)
- TimeMultiplier: Time-of-day factor (0.95 - 1.05) [heuristic risk shading, not core safety]
- ExecutorMultiplier: Settlement executor reputation (0.85 - 1.15)
```

**Threshold**: `S(R) ≥ 0.997` (99.7%)

**Rationale**: Aligns with conformal prediction α = 0.003 for eventual statistical guarantee. Even in MVP, cutoff equals eventual statistical guarantee.

### 2. Liquidity Clearance L(R)

**Purpose**: Determines if LP can be matched at acceptable haircut.

**Formula**:
```
L(R) = true IF ∃ LP: (LP.minHaircut ≤ suggestedHaircut(R)) AND (LP.availableAmount ≥ R.amount)

Where:
suggestedHaircut(R) = (1 - confidenceLower(R)) × maxHaircut

And maxHaircut is calibrated so that:
(1 - confidenceLower) × maxHaircut ≥ r · T

for conservative LPs, where:
- r = LP opportunity cost (annual rate)
- T = expected escrow duration
```

**Haircut Clearing Condition** (Appendix A):
```
H ≥ r · T
```

Where H = haircut, r = LP opportunity cost, T = escrow duration.

**Calibration**: maxHaircut ensures that in worst-case escrow duration T, the haircut satisfies the clearing condition for conservative LPs.

## Decision Rules

### Fast Lane (Provisional Settlement)
```
IF S(R) ≥ 0.997 AND L(R) = true
THEN: Provisional settlement with LP liquidity
```

### FDC Lane (Native Settlement)
```
IF S(R) < 0.997 OR L(R) = false
THEN: Queue for FDC, no provisional
```

## Components

### 1. Price Stability Score

**Formula**:
```
stabilityScore = 1.0 - min(priceVolatility / maxVolatility, 1.0)

where:
- priceVolatility = std(price_last_10_blocks) / mean(price_last_10_blocks)
- maxVolatility = 0.05 (5% threshold)
```

**Justification**: 5% approximates one standard deviation of intrablock noise on FTSO during stressed periods. 10 blocks balances responsiveness vs overfitting.

### 2. Amount Risk Score

**Formula**:
```
IF amount < smallAmountThreshold:
    amountScore = 1.0
ELIF amount < mediumAmountThreshold:
    amountScore = 1.0 - (amount - smallAmountThreshold) / (mediumAmountThreshold - smallAmountThreshold) * 0.1
ELSE:
    amountScore = 0.9 - (amount - mediumAmountThreshold) / largeAmountThreshold * 0.1
```

### 3. Settlement Executor Reputation Score

**Formula**:
```
executorScore = min(executorSuccessRate × executorStakeMultiplier, 1.15)

where:
- executorSuccessRate = completedRedemptions / totalRedemptions (last 30 days)
- executorStakeMultiplier = min(executorStake / minStake, 1.5)
```

**Note**: Terminology updated from "Agent" to "Settlement Executor" to emphasize mechanical, bounded role.

### 4. Time Factor

**Formula**:
```
timeScore = 1.0 (base)
IF hour in [2, 3, 4, 5]:  // Low activity hours
    timeScore = 0.95
IF hour in [9, 10, 11, 14, 15, 16]:  // High activity hours
    timeScore = 1.05
```

**Label**: Heuristic risk shading, not a core safety component. For whitepaper, can be replaced with queueing logic.

## Confidence Intervals

### MVP Implementation

```
confidenceLower = score × 0.98  // 2% conservative adjustment
confidenceUpper = min(score × 1.02, 1.0)  // 2% optimistic, capped at 1.0

For high scores (≥ 99.7%): use 0.3% adjustment instead of 2%
```

### Whitepaper Specification (Future)

Conformal prediction with α = 0.003 for distribution-free guarantees:
```
Pr(p ≥ p̂) ≥ 99.7%
```

## Payment Reference System

**Updated Formula** (includes chainId for cross-network clarity):
```
ref(R) = Hash(chainId, redemptionId, user, amount, timestamp)
```

**Properties**:
- Uniqueness: `Pr[ref(R₁) = ref(R₂)] ≈ 0` for R₁ ≠ R₂
- Deterministic: Same redemption always has same reference
- Cross-network unambiguous: chainId prevents collisions
- Verifiable: FDC can verify payment includes correct reference

## Settlement Executor Model

### Mathematical Constraint

```
∀ redemption R: Finalize(R) ⟹ FDC(P_A(R)) = true
```

**Trust Model**:
```
Trust(Settlement Executor) = 0
All trust is in FDC, not executor.
```

### Executor Failure Mode

**If executor fails to pay**:
- User can prove non-payment via FDC
- User receives compensation from escrow
- Executor loses reputation
- **No user loss** (worst-case is delay)

**Mathematical Guarantee**:
```
Pr[User Loss | Executor Failure] = 0
Pr[User Delay | Executor Failure] ≤ τ
```

## Three-Layer Protection

FLIP uses three layers of protection:

1. **Deterministic scoring** → reduces bad fast lanes
2. **Haircut + LP market** → prices risk
3. **FDC finality** → guarantees correctness

**Failure Modes**:
- Bad prediction → user waits
- Executor failure → user gets compensated
- Market illiquidity → fallback to FDC

**Result**: No magic, only bounded failure modes.

## Queueing Bound

**Formula** (for future scaling):
```
E[C_escrow] ≤ λ · f · τ · E[R]

Where:
- λ = redemption arrival rate
- f = fraction routed to fast lane
- τ = expected escrow duration
- E[R] = expected redemption size
```

**Intuition**: Average escrow capital is arrival rate × fast-lane share × lock time × average ticket size.

## Safety Analysis

### Is the model safe?

**Yes — with caveats.**

The system fails gracefully:
- Bad prediction → user waits (no loss)
- Executor failure → user gets compensated (no loss)
- Market illiquidity → fallback to FDC (no loss)

**Three-layer protection ensures**:
- Deterministic scoring reduces bad fast lanes
- Haircut + LP market prices risk
- FDC finality guarantees correctness

This is exactly what Flare likes: no magic, only bounded failure modes.

## Launchpad-Grade Summary

**One-paragraph version**:

"FLIP uses a fully deterministic risk model to route redemptions either to a fast, haircut-priced liquidity lane or to the native FDC lane. Fast paths are enabled only when on-chain volatility, amount risk, and settlement executor reputation jointly imply ≥99.7% confidence, while haircut pricing clears LP opportunity cost. A settlement executor pays XRP immediately, but finality is guaranteed only by FDC proofs tied to a unique payment reference, so users can never lose funds — only experience bounded delay."

