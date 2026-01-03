# FLIP Contract Testing Guide

## Quick Start

### Option 1: Run All Tests (Recommended)
```bash
cd /home/agnij/Desktop/FLIP
./scripts/test-contracts.sh
```

### Option 2: Manual Testing
```bash
# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# Compile contracts
forge build

# Run all tests
forge test -vv

# Run specific test file
forge test --match-contract DeterministicScoring -vv
forge test --match-contract FLIPCore -vv
forge test --match-path "tests/integration/*" -vv
```

## Test Coverage

### 1. DeterministicScoring Tests
**File**: `tests/contracts/DeterministicScoring.t.sol`

Tests:
- ✅ High confidence scoring (>= 99.7%)
- ✅ Medium confidence scoring (95-99.7%)
- ✅ Low confidence scoring (< 95%)
- ✅ Stability multiplier (volatility impact)
- ✅ Amount multiplier (size impact)
- ✅ Agent multiplier (reputation + stake)
- ✅ Time multiplier (hour of day)
- ✅ Confidence intervals (2% adjustment)
- ✅ Score capping at 100%

### 2. FLIPCore Tests
**File**: `tests/contracts/FLIPCore.t.sol`

Tests:
- ✅ Request redemption
- ✅ Evaluate redemption (high confidence)
- ✅ Evaluate redemption (low confidence)
- ✅ Finalize provisional settlement
- ✅ Reject low score provisional
- ✅ Claim failure flow

### 3. Integration Tests
**File**: `tests/integration/FullFlow.t.sol`

Tests:
- ✅ Complete flow: Request → Provisional → FDC Success
- ✅ Complete flow: Request → Provisional → FDC Failure → Insurance
- ✅ Complete flow: Request → Queue FDC → FDC Success
- ✅ Multiple redemptions with different scores

## Expected Test Results

```
Running 15 tests for tests/contracts/DeterministicScoring.t.sol:DeterministicScoringTest
[PASS] testCalculateScore_HighConfidence()
[PASS] testCalculateScore_MediumConfidence()
[PASS] testCalculateScore_LowConfidence()
[PASS] testStabilityMultiplier()
[PASS] testAmountMultiplier()
[PASS] testAgentMultiplier()
[PASS] testTimeMultiplier()
[PASS] testConfidenceIntervals()
[PASS] testScoreCappedAt100Percent()

Running 6 tests for tests/contracts/FLIPCore.t.sol:FLIPCoreTest
[PASS] testRequestRedemption()
[PASS] testEvaluateRedemption()
[PASS] testEvaluateRedemption_LowConfidence()
[PASS] testFinalizeProvisional()
[PASS] testFinalizeProvisional_RejectsLowScore()
[PASS] testClaimFailure()

Running 4 tests for tests/integration/FullFlow.t.sol:FullFlowTest
[PASS] testFullFlow_ProvisionalSuccess()
[PASS] testFullFlow_ProvisionalFailure()
[PASS] testFullFlow_QueueFDC()
[PASS] testMultipleRedemptions()
```

## Test Scenarios

### High Confidence Scenario
- Price volatility: 1% (low)
- Amount: 100 tokens (small)
- Agent success rate: 99%
- Agent stake: 200k tokens (high)
- **Expected**: Provisional settlement allowed

### Medium Confidence Scenario
- Price volatility: 3% (medium)
- Amount: 5k tokens (medium)
- Agent success rate: 97%
- Agent stake: 150k tokens (medium)
- **Expected**: Buffer/Earmark (wait for FDC)

### Low Confidence Scenario
- Price volatility: 6% (high)
- Amount: 100k tokens (large)
- Agent success rate: 90%
- Agent stake: 50k tokens (low)
- **Expected**: Queue for FDC (no provisional)

## Debugging Failed Tests

### Verbose Output
```bash
forge test -vvv  # Very verbose
```

### Run Single Test
```bash
forge test --match-test testCalculateScore_HighConfidence -vvv
```

### Gas Report
```bash
forge test --gas-report
```

## Architecture Testing

The tests verify:
1. ✅ Deterministic scoring produces consistent results
2. ✅ Decision logic matches thresholds
3. ✅ Full redemption flow works end-to-end
4. ✅ Insurance pool integration
5. ✅ FDC attestation handling
6. ✅ Operator permissions

## Next Steps After Tests Pass

1. Deploy to Coston2 testnet
2. Test with real FAssets
3. Monitor gas costs
4. Optimize if needed
5. Security audit

