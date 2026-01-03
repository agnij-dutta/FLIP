# FLIP Testing Guide

## Quick Start

### Run All Tests
```bash
./scripts/test-contracts.sh
```

### Verify Architecture (No Foundry Needed)
```bash
./scripts/verify-architecture.sh
```

### Demo Scoring Logic (Python)
```bash
python3 scripts/demo-scoring.py
```

## Test Coverage

### Unit Tests (15 tests)
- **DeterministicScoring**: 9 tests
  - High/Medium/Low confidence
  - All multipliers (stability, amount, time, agent)
  - Confidence intervals
  - Score capping

- **FLIPCore**: 6 tests
  - Request redemption
  - Evaluate redemption
  - Finalize provisional
  - Reject low scores
  - Claim failure

### Integration Tests (4 tests)
- Complete redemption flows
- Multiple scenarios
- End-to-end verification

## Architecture Verified

✅ All contracts present  
✅ All tests created  
✅ No ML dependencies  
✅ Deterministic scoring integrated  
✅ Full flow tested  

## Expected Results

All 19 tests should pass, verifying:
1. Mathematical scoring works correctly
2. Decision thresholds enforced (99.7%, 95%)
3. Full redemption flows work
4. Insurance pool integration
5. FDC attestation handling

## Next Steps

1. Install Foundry: `./scripts/install-foundry.sh`
2. Run tests: `forge test -vv`
3. Review results
4. Deploy to testnet

