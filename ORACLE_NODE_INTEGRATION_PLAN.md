# Oracle Node Integration Plan

## Overview

Enhance oracle nodes to use deterministic scoring (not ML) and integrate with deployed contracts on Coston2 testnet.

## Current Status

- ✅ DeterministicScorer implemented in Go (`oracle/node/scorer.go`)
- ✅ Oracle node structure exists (`oracle/node/main.go`)
- ⚠️ Needs update to use deterministic scoring (currently uses ML placeholder)
- ⚠️ Needs integration with deployed contracts

## Implementation Tasks

### 1. Update Oracle Node to Use Deterministic Scoring ✅

**File**: `oracle/node/main.go`

**Changes**:
- Remove ML prediction code
- Use `DeterministicScorer` instead
- Extract on-chain data (price volatility, agent info, etc.)
- Calculate score using deterministic formula
- Submit to OracleRelay if score >= 99.7%

**Status**: ✅ Updated (see `oracle/node/main_enhanced.go`)

### 2. Update Relay to Match OracleRelay Interface ✅

**File**: `oracle/node/relay.go`

**Changes**:
- Update `SubmitPrediction` signature to match OracleRelay contract
- Parameters: `redemptionId`, `score`, `suggestedHaircut`, `routingDecision`
- Create proper signature (EIP-712 style)
- Call OracleRelay contract via ABI

**Status**: ✅ Updated

### 3. Extract On-Chain Data

**File**: `oracle/node/main_enhanced.go` → `extractScoringParams()`

**Required Data**:
1. **Price Volatility**: Query FTSO prices for last 10 blocks, calculate std dev
2. **Agent Success Rate**: Query FLIPCore or FAsset contract for agent history
3. **Agent Stake**: Query OperatorRegistry for agent stake
4. **Amount**: From redemption event
5. **Hour of Day**: Current time

**Implementation**:
- Query FTSO via PriceHedgePool or FtsoV2Adapter
- Query FLIPCore for redemption details
- Query OperatorRegistry for agent info
- Calculate volatility from price history

### 4. Integrate with Deployed Contracts

**Contracts on Coston2**:
- FLIPCore: `0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387`
- OracleRelay: (needs deployment or check if exists)
- PriceHedgePool: `0xb9Df841a5b5f4a7f23F2294f3eecB5b2e2F53CFD`
- OperatorRegistry: `0x21b165aE60748410793e4c2ef248940dc31FE773`

**Environment Variables**:
```bash
export FLARE_RPC="https://coston2-api.flare.network/ext/C/rpc"
export FLIP_CORE_ADDRESS="0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387"
export ORACLE_RELAY_ADDRESS="<deploy_oracle_relay>"
export OPERATOR_PRIVATE_KEY="<operator_private_key>"
```

### 5. Create Test Scripts

**File**: `scripts/test-oracle-integration.sh`

**Tests**:
1. Start oracle node
2. Request redemption via FLIPCore
3. Verify oracle node receives event
4. Verify oracle node calculates score
5. Verify oracle node submits to OracleRelay
6. Verify FLIPCore can finalize provisional settlement

### 6. Create Demo LP Setup

**File**: `scripts/setup-demo-lps.sh`

**Demo LPs**:
1. **Conservative LP**: 1% min haircut, 1 hour max delay, 10,000 tokens
2. **Aggressive LP**: 0.5% min haircut, 2 hours max delay, 20,000 tokens
3. **Balanced LP**: 0.75% min haircut, 1.5 hours max delay, 15,000 tokens

**Setup**:
```bash
# LP 1: Conservative
cast send $LP_REGISTRY "depositLiquidity(address,uint256,uint256,uint256)" \
  $FXRP_ADDRESS \
  10000e18 \
  10000 \
  3600 \
  --value 10000e18 \
  --private-key $LP1_KEY

# LP 2: Aggressive
cast send $LP_REGISTRY "depositLiquidity(address,uint256,uint256,uint256)" \
  $FXRP_ADDRESS \
  20000e18 \
  5000 \
  7200 \
  --value 20000e18 \
  --private-key $LP2_KEY

# LP 3: Balanced
cast send $LP_REGISTRY "depositLiquidity(address,uint256,uint256,uint256)" \
  $FXRP_ADDRESS \
  15000e18 \
  7500 \
  5400 \
  --value 15000e18 \
  --private-key $LP3_KEY
```

## Testing Plan

### Unit Tests

1. **DeterministicScorer Tests**
   - Test score calculation with various inputs
   - Test confidence interval calculation
   - Test decision logic

2. **Relay Tests**
   - Test signature creation
   - Test OracleRelay contract interaction

### Integration Tests

1. **End-to-End Flow**
   - User requests redemption
   - Oracle node receives event
   - Oracle node calculates score
   - Oracle node submits prediction
   - Operator finalizes provisional settlement
   - LP matched and escrow created
   - User receives receipt

2. **Edge Cases**
   - Low score (no provisional settlement)
   - No LP match (user-wait path)
   - FDC failure
   - FDC timeout

## Deployment Steps

### 1. Deploy OracleRelay (if not deployed)

```bash
forge script script/DeployOracleRelay.s.sol \
  --rpc-url $COSTON2_RPC \
  --broadcast \
  --private-key $PRIVATE_KEY
```

### 2. Configure OracleRelay

```bash
# Add operator
cast send $ORACLE_RELAY "addOperator(address)" $OPERATOR_ADDRESS \
  --rpc-url $COSTON2_RPC \
  --private-key $OWNER_KEY
```

### 3. Start Oracle Node

```bash
cd oracle/node
go run main_enhanced.go
```

### 4. Test Integration

```bash
# Request redemption
cast send $FLIP_CORE "requestRedemption(uint256,address)" \
  1000e18 \
  $FXRP_ADDRESS \
  --rpc-url $COSTON2_RPC \
  --private-key $USER_KEY

# Check oracle node logs for prediction submission
# Check OracleRelay for prediction
cast call $ORACLE_RELAY "getLatestPrediction(uint256)" $REDEMPTION_ID \
  --rpc-url $COSTON2_RPC
```

## Next Steps

1. ✅ Update oracle node to use deterministic scoring
2. ⏳ Deploy OracleRelay to Coston2
3. ⏳ Create test scripts
4. ⏳ Test end-to-end integration
5. ⏳ Create demo LP setup
6. ⏳ Document integration

---

**Last Updated**: $(date)
**Status**: ⏳ In Progress

