# FLIP v2 Deployment Guide - Coston2 Testnet

## Prerequisites

1. **Environment Setup**:
   ```bash
   # Install Foundry
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   
   # Install dependencies
   forge install
   ```

2. **Wallet Setup**:
   - Get testnet tokens from [Coston2 Faucet](https://faucet.coston2.flare.network/)
   - Ensure you have C2FLR tokens for gas fees

3. **Environment Variables**:
   ```bash
   # Create .env file
   cp .env.example .env
   
   # Fill in:
   PRIVATE_KEY=your_private_key_here
   COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
   ```

## Flare Contract Addresses (Coston2)

Before deployment, you need to find the actual Flare contract addresses:

### Finding Flare Contracts

1. **FTSO Registry**:
   - Check Flare documentation: https://docs.flare.network/
   - Or use Flare explorer: https://coston2-explorer.flare.network
   - Look for "FTSO Registry" or "FtsoRegistry" contracts

2. **State Connector**:
   - Usually at a known address
   - Check Flare documentation for State Connector address

3. **FAssets** (optional for initial testing):
   - FXRP, FBTC, FDOGE addresses
   - Check Flare documentation

### Update Deployment Script

Edit `scripts/deploy-coston2.sh` and update:
```bash
FTSO_REGISTRY="0x..." # Actual FTSO Registry address
STATE_CONNECTOR="0x..." # Actual State Connector address
```

## Deployment Steps

1. **Compile Contracts**:
   ```bash
   forge build
   ```

2. **Run Tests** (ensure all pass):
   ```bash
   forge test
   ```

3. **Deploy to Coston2**:
   ```bash
   chmod +x scripts/deploy-coston2.sh
   ./scripts/deploy-coston2.sh
   ```

4. **Verify Deployment**:
   - Check contract addresses in output
   - Verify on explorer: https://coston2-explorer.flare.network

## Post-Deployment Configuration

After deployment, you need to:

1. **Set FLIPCore addresses** (done automatically by script):
   - EscrowVault.setFLIPCore()
   - LiquidityProviderRegistry.setFLIPCore()
   - SettlementReceipt.setFLIPCore()

2. **Verify Contract Interactions**:
   ```bash
   # Check FLIPCore is set in EscrowVault
   cast call <ESCROW_VAULT> "flipCore()" --rpc-url $COSTON2_RPC_URL
   
   # Check FLIPCore is set in LP Registry
   cast call <LP_REGISTRY> "flipCore()" --rpc-url $COSTON2_RPC_URL
   ```

## Testing on Coston2

1. **Request Redemption** (if FAsset available):
   ```bash
   cast send <FLIP_CORE> "requestRedemption(uint256,address)" \
      1000000000000000000 <FASSET_ADDRESS> \
      --rpc-url $COSTON2_RPC_URL \
      --private-key $PRIVATE_KEY
   ```

2. **Check Redemption Status**:
   ```bash
   cast call <FLIP_CORE> "getRedemptionStatus(uint256)" 0 \
      --rpc-url $COSTON2_RPC_URL
   ```

3. **Monitor Events**:
   - Use Flare explorer to monitor contract events
   - Or use `cast logs` to query events

## Troubleshooting

### Common Issues

1. **"Insufficient funds"**:
   - Get more C2FLR from faucet
   - Check gas price settings

2. **"Contract not found"**:
   - Verify Flare contract addresses are correct
   - Check RPC URL is correct

3. **"Invalid constructor arguments"**:
   - Verify constructor parameters match contract
   - Check address format (must be checksummed)

## Next Steps

1. ✅ Deploy contracts to Coston2
2. ✅ Verify contract interactions
3. ⏳ Test with real FAssets (if available)
4. ⏳ Test FTSO price feeds
5. ⏳ Test FDC attestations
6. ⏳ Monitor and iterate

---

**Last Updated**: $(date)
**Version**: FLIP v2.0
