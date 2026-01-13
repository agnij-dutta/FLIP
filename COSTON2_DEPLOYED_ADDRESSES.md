# FLIP v2 - Coston2 Deployed Contract Addresses

## ✅ Successfully Deployed (v2 with Pause Functionality)

All contracts deployed using `forge script` on Coston2 testnet with pause functionality.

### Core Contracts

- **FLIPCore**: `0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387` ✅ (with Pausable)
- **EscrowVault**: `0x0e37cc3dc8fa1675f2748b77dddff452b63dd4cc` ✅
- **SettlementReceipt**: `0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8` ✅
- **LiquidityProviderRegistry**: `0x2CC077f1Da27e7e08A1832804B03b30A2990a61C` ✅
- **OperatorRegistry**: `0x21b165aE60748410793e4c2ef248940dc31FE773` ✅
- **PriceHedgePool**: `0xb9Df841a5b5f4a7f23F2294f3eecB5b2e2F53CFD` ✅
- **FtsoV2Adapter**: `0x4D1E494CaB138D8c23B18c975b49C1Bec7902746` ✅
- **OracleRelay**: `0x5Fd855d2592feba675E5E8284c830fE1Cefb014E` ✅

### Flare Contracts (External)

- **FTSOv2**: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726` (Flare contract)
- **State Connector**: `0x0000000000000000000000000000000000000000` (Placeholder)

## 🆕 Features in v2

- ✅ **Pause Functionality**: FLIPCore inherits Pausable
- ✅ **Math Proofs**: Complete mathematical proofs documented
- ✅ **Worst-Case Analysis**: 9 scenarios analyzed and proven

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
cast call 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387 "paused()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check FLIPCore owner (pause control)
cast call 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387 "owner()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check EscrowVault
cast call 0x0e37cc3dc8fa1675f2748b77dddff452b63dd4cc "flipCore()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

## 🧪 Test Pause Functionality

```bash
# Pause FLIPCore (owner only)
cast send 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387 "pause()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Unpause FLIPCore
cast send 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387 "unpause()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

## 📝 Deployment Details

- **Deployment Method**: `forge script`
- **Network**: Coston2 Testnet
- **Gas Used**: ~8.68M gas
- **Cost**: ~0.434 C2FLR
- **Status**: ✅ All contracts deployed and configured
- **Verification**: ⚠️ Skipped (API key not set)

## 📄 Transaction Log

See: `broadcast/Deploy.s.sol/114/run-latest.json`

## 🌐 Explorer Links

- Coston2 Explorer: https://coston2-explorer.flare.network
- FLIPCore: https://coston2-explorer.flare.network/address/0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387

---

**Deployed**: $(date)
**Network**: Coston2 Testnet
**Version**: v2 (with Pause)
**Status**: ✅ All contracts deployed and configured

