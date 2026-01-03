# FLIP Architecture Testing Plan

## Overview

Complete test suite for FLIP MVP with deterministic mathematical model (no ML).

## Test Structure

```
tests/
├── contracts/
│   ├── DeterministicScoring.t.sol  (9 tests)
│   └── FLIPCore.t.sol              (6 tests)
└── integration/
    └── FullFlow.t.sol              (4 tests)
```

**Total: 19 tests**

## Test Categories

### 1. Unit Tests - DeterministicScoring

**Purpose**: Verify mathematical scoring formula works correctly

**Tests**:
- ✅ High confidence calculation (>= 99.7%)
- ✅ Medium confidence calculation (95-99.7%)
- ✅ Low confidence calculation (< 95%)
- ✅ Stability multiplier (price volatility impact)
- ✅ Amount multiplier (redemption size impact)
- ✅ Agent multiplier (reputation + stake impact)
- ✅ Time multiplier (hour of day impact)
- ✅ Confidence intervals (2% adjustment)
- ✅ Score capping at 100%

### 2. Unit Tests - FLIPCore

**Purpose**: Verify contract logic with deterministic scoring

**Tests**:
- ✅ Request redemption
- ✅ Evaluate redemption (high confidence)
- ✅ Evaluate redemption (low confidence)
- ✅ Finalize provisional settlement
- ✅ Reject low score provisional
- ✅ Claim failure flow

### 3. Integration Tests - Full Flow

**Purpose**: Test complete redemption flows end-to-end

**Tests**:
- ✅ Request → High Confidence → Provisional → FDC Success
- ✅ Request → High Confidence → Provisional → FDC Failure → Insurance
- ✅ Request → Low Confidence → Queue FDC → FDC Success
- ✅ Multiple redemptions with different scores

## Running Tests

### Quick Start
```bash
./scripts/test-contracts.sh
```

### Manual
```bash
# Install Foundry (first time only)
./scripts/install-foundry.sh

# Compile
forge build

# Run all tests
forge test -vv

# Run specific test
forge test --match-test testCalculateScore_HighConfidence -vvv
```

## Expected Test Scenarios

### Scenario 1: High Confidence → Provisional
```
Input:
- Volatility: 1%
- Amount: 100 tokens
- Agent: 99% success, 200k stake
- Hour: 10 AM

Expected:
- Score: >= 99.7%
- Decision: ProvisionalSettle
- Result: User paid immediately
```

### Scenario 2: Medium Confidence → Buffer
```
Input:
- Volatility: 3%
- Amount: 5k tokens
- Agent: 97% success, 150k stake
- Hour: 6 AM

Expected:
- Score: 95-99.7%
- Decision: BufferEarmark
- Result: Insurance earmarked, wait for FDC
```

### Scenario 3: Low Confidence → Queue FDC
```
Input:
- Volatility: 6%
- Amount: 100k tokens
- Agent: 90% success, 50k stake
- Hour: 3 AM

Expected:
- Score: < 95%
- Decision: QueueFDC
- Result: No provisional, wait for FDC
```

## Architecture Verification

Tests verify:

1. **Deterministic Behavior**
   - Same inputs → same outputs
   - No randomness in scoring

2. **Decision Logic**
   - Thresholds work correctly (99.7%, 95%)
   - Provisional settlement conditions enforced

3. **Integration**
   - Insurance pool integration
   - Price hedge pool integration
   - Operator registry integration
   - FDC attestation handling

4. **Edge Cases**
   - Maximum scores (capped at 100%)
   - Minimum scores (low confidence)
   - Boundary conditions

## Gas Optimization

After tests pass, check gas usage:
```bash
forge test --gas-report
```

## Next Steps After Tests

1. ✅ All tests pass
2. Deploy to Coston2 testnet
3. Test with real FAssets
4. Monitor and optimize
5. Security audit

