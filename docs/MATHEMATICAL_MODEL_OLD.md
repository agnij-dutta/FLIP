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

**Justification**: 5% approximates one standard deviation of intrablock noise on FTSO during stressed periods. 10 blocks balances responsiveness vs overfitting.

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

**Label**: Heuristic risk shading, not a core safety component. For whitepaper, can be replaced with queueing logic.

## Confidence Intervals

### MVP Implementation (Current)

Instead of ML confidence intervals, use deterministic bounds:

```
confidenceLower = score × 0.98  // 2% conservative adjustment
confidenceUpper = min(score × 1.02, 1.0)  // 2% optimistic, capped at 1.0
```

### Whitepaper Specification (Future)

The whitepaper (Appendix B) specifies **conformal prediction** with α = 0.003 for distribution-free guarantees:

```
Pr(p ≥ p̂) ≥ 1 − α = 99.7%
```

Where:
- `p` = true probability of redemption success
- `p̂` = lower confidence bound (confidenceLower)
- `α` = error rate (0.003 = 0.3%)

**Current Status**: MVP uses fixed 2% adjustment as a conservative approximation. For full theoretical alignment, conformal prediction quantiles should be:
1. Computed off-chain via ML training pipeline
2. Updated on-chain via governance parameters
3. Used instead of fixed 2% adjustment

**Impact**: The fixed 2% adjustment is conservative (more restrictive) but does not provide the same theoretical guarantee as conformal prediction. The 99.7% threshold (p_min) is still enforced, ensuring safety, but the confidence bound itself is not distribution-free.

## Advantages

1. **Deterministic**: Same inputs → same output (no randomness)
2. **Transparent**: All rules are on-chain, auditable
3. **Fast**: No ML inference, just calculations
4. **Debuggable**: Can trace exactly why a decision was made
5. **Upgradeable**: Can adjust thresholds via governance

## Haircut Economics

### Haircut Clearing Condition (Appendix A)

The whitepaper specifies that haircut `H` must satisfy:

```
H ≥ r · T
```

Where:
- `H` = haircut rate
- `r` = LP opportunity cost (annualized)
- `T` = escrow duration (fraction of year)

**Implementation**: This condition is enforced via `LiquidityProviderRegistry`, where LPs set their own `minHaircut` based on their opportunity cost and expected delay. The suggested haircut from `calculateSuggestedHaircut()` is advisory - LPs will only match if their `minHaircut` is satisfied, ensuring the clearing condition is met.

**Current Formula**: 
```
haircut = (1 - confidenceLower) × maxHaircut
```

This is confidence-based, not explicitly validated against r · T. The LP matching mechanism ensures market-clearing.

## Implementation

- **On-Chain**: FLIPCore computes score directly (no oracle needed for simple cases)
- **Oracle Nodes**: Only needed for complex calculations or external data
- **Governance**: Thresholds can be updated via multisig/DAO

## MVP vs Full Implementation

### Current (MVP)
- ✅ Deterministic scoring with fixed 2% confidence intervals
- ✅ 99.7% threshold (p_min) enforced
- ✅ Worst-case bounds (no loss, only delay)
- ⚠️ Fixed confidence intervals (not conformal prediction)
- ⚠️ Confidence-based haircut (not explicitly validated against r · T)

### Future (Full Theoretical Alignment)
- 🔮 Conformal prediction with α = 0.003
- 🔮 Distribution-free confidence bounds
- 🔮 Explicit haircut validation: H ≥ r · T
- 🔮 Queueing bounds enforcement: E[C_escrow] ≤ λ · f · τ · E[R]

**Note**: The MVP implementation is **conservative and safe** - it enforces all safety guarantees but uses simpler approximations for theoretical guarantees. Full theoretical alignment can be added post-deployment via governance updates.

---

## Agent Model (New Addition)

### Agent Role

The Settlement Executor (Agent) facilitates cross-chain payments:

```
Agent Flow:
1. Monitor EscrowCreated events
2. Send XRP payment P_A(R) to user's XRPL address
3. Include payment reference ref(R) in XRPL memo
4. Submit FDC proof of payment
5. FLIPCore finalizes based on FDC confirmation
```

### Settlement Executor Constraints

**Mathematical Constraint**:
```
∀ redemption R: Finalize(R) ⟹ FDC(P_A(R)) = true
```

**Trust Model**:
```
Trust(Settlement Executor) = 0
All trust is in FDC, not executor.
```

**Key Invariant**: FLIP never finalizes value without FDC confirmation.

### Settlement Executor Failure Mode

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

---

## Cross-Chain Settlement Model (New Addition)

### Payment Reference System

Each redemption has unique payment reference:

```
ref(R) = Hash(chainId, redemptionId, user, amount, timestamp)
```

**Update**: Includes chainId for cross-network clarity and to prevent collisions across networks.

**Properties**:
- Uniqueness: `Pr[ref(R₁) = ref(R₂)] ≈ 0` for R₁ ≠ R₂
- Deterministic: Same redemption always has same reference
- Verifiable: FDC can verify payment includes correct reference

### FDC Verification Flow

```
1. Agent sends: P_XRPL(ref(R))
2. FDC verifies: Payment includes ref(R) in memo
3. FDC confirms: FDC(P_XRPL(ref(R))) = true
4. FLIPCore finalizes: Finalize(R) based on FDC confirmation
```

### Settlement Correctness

**Theorem**: 
```
Pr[Settle(R) with payment P ≠ P_A(R)] = 0
```

**Proof**: See Mathematical Proofs document (Cross-Chain Settlement Correctness Theorem).

---

## Updated Flow Equations

### Complete Redemption Flow

**With Agent and XRPL**:

```
1. User requests: R = requestRedemption(amount, asset, xrplAddress)
2. Escrow created: E(R) = createEscrow(R, LP?)
3. Agent pays: P_A(R) = sendXRPPayment(xrplAddress, amount, ref(R))
4. FDC verifies: FDC(P_A(R)) = verifyPayment(ref(R))
5. Escrow released: Release(E(R), FDC(P_A(R)))
6. Finalized: Finalize(R) if FDC(P_A(R)) = true
```

**Capital requirement unchanged**:
```
E[C_escrow] = λ · f · E[R] · E[T | fast]
```

---

## New Invariants

### Invariant 1: FDC Finality

```
∀ redemption R: Finalize(R) ⟹ FDC(R) = true
```

**Enforcement**: Code-level (handleFDCAttestation() required)

---

### Invariant 2: Settlement Executor Boundedness

```
∀ payment P: Executor(P) ⟹ ∃ FDC(P)
```

**Enforcement**: Agent must submit FDC proof for all payments

---

### Invariant 3: No Trust Assumption

```
∀ settlement S: Trust(S) = 0
```

**Enforcement**: All trust in FDC, not agent or LPs

---

**Last Updated**: January 2026  
**Version**: FLIP v2.1 Mathematical Model (Post-Agent Update)

