# FLIP v2 - Coston2 Deployed Contract Addresses

## ✅ Latest Deployment (v3 - Real Fund Transfers + Full Setup)

All contracts deployed using `forge script` on Coston2 testnet. Contracts now have real fund transfers, proper escrow setup, and SettlementReceipt authorization.

### Core Contracts (Latest Deployment - v3)

- **FLIPCore**: `0x192E107c9E1adAbf7d01624AFa158d10203F8DAB` ✅ (Real fund transfers, proper token handling)
- **EscrowVault**: `0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4` ✅ (SettlementReceipt authorized)
- **SettlementReceipt**: `0xE87c033A9c4371B6192Ab213380fb30955b3Bf39` ✅
- **LiquidityProviderRegistry**: `0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B` ✅ (EscrowVault configured)
- **OperatorRegistry**: `0xC067A34098fDa5Cd746494636Aaaa696EB07f66a` ✅
- **PriceHedgePool**: `0x790167f780F1ae511A717445074FF988FD3656f4` ✅
- **FtsoV2Adapter**: `0x8cEDF2770E670d601394851C51e3aBFe3AB3177c` ✅
- **OracleRelay**: `0x5501773156a002B85b33C58c74e0Fc79FF97680f` ✅

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
