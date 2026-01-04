# FLIP Protocol Deployment Guide

## Prerequisites

1. **Foundry installed** - See `scripts/install-foundry.sh`
2. **Testnet FLR tokens** - Get from [Coston2 Faucet](https://coston-faucet.towolabs.com/)
3. **Private key** - For contract deployment (keep secure!)
4. **RPC access** - Coston2 testnet RPC endpoint

## Deployment Steps

### 1. Configure Environment

Create a `.env` file in the project root:

```bash
PRIVATE_KEY=your_private_key_here
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_RPC_URL=https://flare-api.flare.network/ext/C/rpc
```

### 2. Get Contract Addresses

Before deploying, you need the following Flare contract addresses:

- **FTSO Registry:** Query from `FlareContractRegistry` at `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- **StateConnector:** Query from `FlareContractRegistry`
- **FAsset addresses:** For FXRP, FBTC, etc.

You can use the helper script:
```bash
python3 scripts/get-fasset-addresses.py
```

### 3. Deploy Contracts

Run the deployment script:
```bash
./scripts/deploy-coston2.sh
```

This will:
1. Compile all contracts
2. Deploy in the correct order:
   - InsurancePool
   - OperatorRegistry
   - PriceHedgePool
   - FLIPCore
3. Save addresses to `.env`

### 4. Initialize Contracts

After deployment, you need to:

1. **Fund Insurance Pool:**
```bash
cast send $INSURANCE_POOL_ADDRESS "replenishPool()" --value 1000ether --rpc-url $COSTON2_RPC_URL --private-key $PRIVATE_KEY
```

2. **Register Operators:**
```bash
cast send $OPERATOR_REGISTRY_ADDRESS "stake(uint256)" 1000000000000000000000 --value 1000ether --rpc-url $COSTON2_RPC_URL --private-key $PRIVATE_KEY
```

3. **Set Monthly Liability Estimate:**
```bash
cast send $INSURANCE_POOL_ADDRESS "setMonthlyLiabilityEstimate(uint256)" 10000000000000000000000 --rpc-url $COSTON2_RPC_URL --private-key $PRIVATE_KEY
```

### 5. Update Frontend

Update `frontend/app/page.tsx` with deployed contract addresses:
```typescript
const FLIP_CORE_ADDRESS = '0x...'; // From deployment
const FASSET_ADDRESS = '0x...'; // FXRP address on Coston2
```

### 6. Test on Testnet

1. **Request a redemption:**
   - Use the frontend or call `requestRedemption()` directly
   - Monitor transaction on [Coston2 Explorer](https://coston2.testnet.flarescan.com)

2. **Monitor FTSO prices:**
   - Check that PriceHedgePool is receiving price updates
   - Verify price locking works correctly

3. **Test FDC integration:**
   - Submit a redemption request
   - Wait for FDC attestation
   - Verify finalization works

## Verification

Verify contracts on explorer:
```bash
# FLIPCore
cast code $FLIP_CORE_ADDRESS --rpc-url $COSTON2_RPC_URL

# Check contract state
cast call $FLIP_CORE_ADDRESS "nextRedemptionId()" --rpc-url $COSTON2_RPC_URL
```

## Troubleshooting

### "Insufficient funds"
- Get testnet FLR from faucet
- Check account balance: `cast balance $YOUR_ADDRESS --rpc-url $COSTON2_RPC_URL`

### "Contract not found"
- Verify contract was deployed successfully
- Check transaction receipt on explorer

### "Invalid FTSO Registry address"
- Query correct address from FlareContractRegistry
- Update deployment script with correct address

## Next Steps

After successful deployment:
1. Test with real FAsset redemptions
2. Monitor pool utilization
3. Test operator staking and slashing
4. Collect metrics for model validation



