# FLIP MVP - Mathematical Model (No ML)

## Overview

MVP implementation uses **deterministic mathematical scoring** instead of ML predictions. All decisions are rule-based and fully transparent.

## Architecture Changes

### Removed Components
- ❌ ML training pipeline (`ml/training/`)
- ❌ ML model inference (`oracle/node/predictor.go` with ML)
- ❌ Conformal prediction calibration
- ❌ OracleRelay dependency (optional, can be removed)

### New Components
- ✅ `DeterministicScoring.sol` - On-chain scoring library
- ✅ `oracle/node/scorer.go` - Go implementation of scoring
- ✅ Direct on-chain decision making

## Decision Flow

```
1. User requests redemption
   ↓
2. FLIPCore locks FTSO price
   ↓
3. Calculate deterministic score:
   - Price volatility (last 10 blocks)
   - Amount risk factor
   - Agent reputation
   - Time-of-day factor
   ↓
4. Make decision:
   - Score >= 99.7% → Provisional settlement
   - Score 95-99.7% → Buffer/Earmark
   - Score < 95% → Queue for FDC
   ↓
5. FDC finalization (unchanged)
```

## Scoring Formula

```
Score = BaseScore × Stability × Amount × Time × Agent

Where:
- BaseScore = 98% (historical success rate)
- Stability = 0.8-1.2 (based on price volatility)
- Amount = 0.9-1.1 (based on redemption size)
- Time = 0.95-1.05 (based on hour of day)
- Agent = 0.85-1.15 (based on reputation + stake)
```

## Advantages

1. **Deterministic**: Same inputs → same output
2. **Transparent**: All rules on-chain, auditable
3. **Fast**: No ML inference, instant calculations
4. **Simple**: No model training, no data pipelines
5. **Debuggable**: Can trace exact decision path
6. **Upgradeable**: Thresholds adjustable via governance

## Implementation Status

### ✅ Completed
- `DeterministicScoring.sol` library
- `oracle/node/scorer.go` implementation
- Updated `FLIPCore.sol` to use scoring
- Mathematical model documentation

### 🔄 To Do
- Update tests to use deterministic scoring
- Remove ML dependencies from oracle nodes
- Update deployment scripts
- Add governance for threshold updates

## Usage

### On-Chain (Solidity)
```solidity
DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
    priceVolatility: volatility,
    amount: redemption.amount,
    agentSuccessRate: agentRate,
    agentStake: agentStake,
    hourOfDay: hour
});

DeterministicScoring.ScoreResult memory result = 
    DeterministicScoring.calculateScore(params);

if (result.canProvisionalSettle) {
    // Proceed with provisional settlement
}
```

### Off-Chain (Go)
```go
scorer := NewDeterministicScorer()
params := ScoringParams{
    PriceVolatility: volatility,
    Amount: amount,
    AgentSuccessRate: agentRate,
    AgentStake: agentStake,
    HourOfDay: time.Now().Hour(),
}
result := scorer.CalculateScore(params)
```

## Configuration

All thresholds are constants in `DeterministicScoring.sol`:
- `BASE_SUCCESS_RATE = 980000` (98%)
- `PROVISIONAL_THRESHOLD = 997000` (99.7%)
- `LOW_CONFIDENCE_THRESHOLD = 950000` (95%)
- `MAX_VOLATILITY = 50000` (5%)
- Amount thresholds: 1000, 10000, 100000 tokens

These can be made configurable via governance in future versions.

## Next Steps

1. Test deterministic scoring in Foundry tests
2. Update oracle nodes to use scorer.go
3. Remove ML dependencies
4. Deploy MVP to testnet

