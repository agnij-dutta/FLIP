# FLIP v2 - Coston2 Deployed Contract Addresses

## ✅ Successfully Deployed

All contracts deployed using `forge script` on Coston2 testnet.

### Core Contracts

- **FLIPCore**: `0x406B2ec53e2e01f9E9D056D98295d0cf61694279`
- **EscrowVault**: `0xAF16AdAE0A157C92e2B173F2579e1f063A7aABE7`
- **SettlementReceipt**: `0x02A56612A4D8D7ae38BD577Be3222D26a4846032`
- **LiquidityProviderRegistry**: `0x0Ec47da13c178f85edd078Cc7d2e775De5e88813`
- **OperatorRegistry**: `0x6420808b3444aC0Ae9adAAf97d2Be5Ac8e6a9b02`
- **PriceHedgePool**: `0xA7d0016BeA9951525d60816c285fd108c5Fe5B92`
- **FtsoV2Adapter**: `0x794eA218dDBcD3dd4683251136dBaAbcFa22E008`

### Flare Contracts (External)

- **FTSOv2**: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726` (Flare contract)
- **State Connector**: `0x0000000000000000000000000000000000000000` (Placeholder)

## 📋 Configuration

All contracts are configured:
- EscrowVault.flipCore = FLIPCore address ✅
- LiquidityProviderRegistry.flipCore = FLIPCore address ✅
- SettlementReceipt.flipCore = FLIPCore address ✅
- FtsoV2Adapter.ftsoV2 = FTSOv2 address ✅

## 🔍 Verification Commands

```bash
# Check FLIPCore
cast call 0x406B2ec53e2e01f9E9D056D98295d0cf61694279 "escrowVault()" --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check EscrowVault
cast call 0xAF16AdAE0A157C92e2B173F2579e1f063A7aABE7 "flipCore()" --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check FtsoV2Adapter
cast call 0x794eA218dDBcD3dd4683251136dBaAbcFa22E008 "ftsoV2()" --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

## 📝 Next Steps

1. ✅ Deploy contracts - DONE
2. ⏳ Test contract interactions
3. ⏳ Verify FTSOv2 integration
4. ⏳ Test with real FAssets (if available)
5. ⏳ Monitor events on explorer

## 🌐 Explorer Links

- Coston2 Explorer: https://coston2-explorer.flare.network
- Transaction: Check `broadcast/Deploy.s.sol/114/run-latest.json`

---

**Deployed**: $(date)
**Network**: Coston2 Testnet
**Method**: forge script
**Status**: ✅ All contracts deployed and configured

