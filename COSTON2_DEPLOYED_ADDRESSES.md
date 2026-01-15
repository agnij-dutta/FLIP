# FLIP v2 - Coston2 Deployed Contract Addresses

## ✅ Latest Deployment (Gas Optimized + Allowance Refresh Fix)

All contracts deployed using `forge script` on Coston2 testnet. FLIPCore now properly handles token transfers and gas optimization.

### Core Contracts (Latest Deployment - Gas Optimized)

- **FLIPCore**: `0x1151473d15F012d0Dd54f8e707dB6708BD25981F` ✅ (Gas optimized - removed redundant price call)
- **EscrowVault**: `0x96f78a441cd5F495BdE362685B200c285e445073` ✅
- **SettlementReceipt**: `0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7` ✅
- **LiquidityProviderRegistry**: `0x3A6aEa499Df3e330E9BBFfeF9Fe5393FA6227E36` ✅
- **OperatorRegistry**: `0x98E12876aB1b38f1B6ac6ceA745f8BA703Ff2DEB` ✅
- **PriceHedgePool**: `0xb8d9efA7348b7E89d308F8f6284Fbc14D2C4d3Ef` ✅
- **FtsoV2Adapter**: `0x05108Aa7A166B1f9A32B9bbCb0D335cd1441Ad67` ✅
- **OracleRelay**: `0xa9feC29134294e5Cb18e8125F700a1d8C354891f` ✅

### Flare Contracts (External)

- **FTSOv2**: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726` (Flare contract)
- **State Connector**: `0x0000000000000000000000000000000000000000` (Placeholder)
- **Dead Address** (Token Burn): `0x000000000000000000000000000000000000dEaD` ✅

## 🆕 Latest Fixes

- ✅ **Gas Optimization**: Removed redundant `getCurrentPriceWithDecimals` call (already called in `lockPrice`)
- ✅ **Gas Limit Fix**: Frontend now estimates gas and adds 50% buffer to prevent OutOfGas errors
- ✅ **Allowance Refresh**: Frontend automatically refetches allowance after approval succeeds (no page refresh needed)
- ✅ **Token Transfer**: FLIPCore transfers tokens from user and holds them in escrow
- ✅ **Unlimited Approval**: Frontend supports maxUint256 approval pattern
- ✅ **Redemption Verification**: Frontend parses events to show redemption ID
- ✅ **Settlement Receipts**: Frontend displays user's settlement receipts

## 📋 Configuration

All contracts are configured:
- EscrowVault.flipCore = FLIPCore address ✅
- LiquidityProviderRegistry.flipCore = FLIPCore address ✅
- SettlementReceipt.flipCore = FLIPCore address ✅
- FtsoV2Adapter.ftsoV2 = FTSOv2 address ✅
- OracleRelay: Operators can be added ✅

## 🔍 Verification Commands

```bash
# Check FLIPCore (with pause)
cast call 0x1151473d15F012d0Dd54f8e707dB6708BD25981F "paused()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check FLIPCore owner (pause control)
cast call 0x1151473d15F012d0Dd54f8e707dB6708BD25981F "owner()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check EscrowVault
cast call 0x96f78a441cd5F495BdE362685B200c285e445073 "flipCore()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Verify tokens are burned (check dead address balance)
cast call 0x0b6A3645c240605887a5532109323A3E12273dc7 "balanceOf(address)" \
  0x000000000000000000000000000000000000dEaD \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

## 🧪 Test Pause Functionality

```bash
# Pause FLIPCore (owner only)
cast send 0x1151473d15F012d0Dd54f8e707dB6708BD25981F "pause()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Unpause FLIPCore
cast send 0x1151473d15F012d0Dd54f8e707dB6708BD25981F "unpause()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

## 📝 Deployment Details

- **Deployment Method**: `forge script`
- **Network**: Coston2 Testnet
- **Gas Used**: ~9.68M gas
- **Cost**: ~0.242 C2FLR
- **Status**: ✅ All contracts deployed and configured
- **Verification**: ⚠️ Skipped (API key not set)

## 📄 Transaction Log

See: `broadcast/Deploy.s.sol/114/run-latest.json`

## 🌐 Explorer Links

- Coston2 Explorer: https://coston2-explorer.flare.network
- FLIPCore: https://coston2-explorer.flare.network/address/0x1151473d15F012d0Dd54f8e707dB6708BD25981F

## ✅ How Token Transfer Works

1. User approves FLIPCore to spend FXRP (unlimited approval via maxUint256)
2. User calls `requestRedemption()` on FLIPCore
3. FLIPCore transfers FXRP from user to FLIPCore (`transferFrom`)
4. FLIPCore immediately transfers FXRP to dead address (`0x000...dead`) - **this effectively burns the tokens**
5. Tokens are permanently locked in dead address (cannot be recovered)
6. Redemption flow continues with price locking and settlement receipt creation

**Proof**: Check dead address balance - it will show all burned FXRP tokens.

## 🔧 Frontend Fixes

### Gas Limit
- Frontend now estimates gas before sending transaction
- Adds 50% buffer to estimated gas to prevent OutOfGas errors
- Fallback to 800k gas if estimation fails

### Allowance Refresh
- After approval succeeds, frontend automatically refetches allowance
- No page refresh needed - UI updates immediately
- Uses `refetchAllowance()` from `useReadContract` hook

---

**Deployed**: Latest
**Network**: Coston2 Testnet
**Version**: v2 (Gas Optimized + Allowance Refresh)
**Status**: ✅ All contracts deployed and configured
