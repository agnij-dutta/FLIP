# Flare Network Contract Addresses

## Coston2 Testnet

### Core Flare Contracts

**FTSOv2** (Flare Time Series Oracle v2):
- Address: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726`
- FeeCalculator: `0x88A9315f96c9b5518BBeC58dC6a914e13fAb13e2`
- Interface: Uses `TestFtsoV2Interface` from `@flarenetwork/flare-periphery-contracts`
- Functions: `getFeedById(bytes21)`, `getFeedByIdInWei(bytes21)`, `getFeedsById(bytes21[])`
- Feed IDs: See https://dev.flare.network/ftso/feeds
  - FLR/USD: `0x01464c522f55534400000000000000000000000000`
  - XRP/USD: `0x015852502f55534400000000000000000000000000`
  - BTC/USD: `0x014254432f55534400000000000000000000000000`

**ContractRegistry**:
- Provides dynamic access to Flare system contracts
- Use `ContractRegistry.getTestFtsoV2()` for testnet
- Use `ContractRegistry.getFtsoV2()` for mainnet
- Use `ContractRegistry.getFdcVerification()` for FDC

**State Connector / FDC**:
- FDC Hub (Coston, not Coston2): `0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b`
- For Coston2, use `ContractRegistry.getFdcVerification()`
- Interface: `IFdcVerification` from `@flarenetwork/flare-periphery-contracts`
- Functions: `verifyEVMTransaction(IEVMTransaction.Proof)`

**FAssets**:
- FXRP: Check Flare documentation for deployed addresses
- FBTC: Check Flare documentation for deployed addresses
- FDOGE: Check Flare documentation for deployed addresses
- Interface: `IFAsset.sol` (custom interface matching FAssets spec)

### Using ContractRegistry

Instead of hardcoding addresses, use ContractRegistry:

```solidity
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";

// Get FTSOv2 contract
TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

// Get price
bytes21 flrUsdId = 0x01464c522f55534400000000000000000000000000;
(uint256 price, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById(flrUsdId);
```

### Verification Steps

1. **Verify FTSOv2**:
   ```bash
   # Get FLR/USD price
   cast call 0x3d893C53D9e8056135C26C8c638B76C8b60Df726 \
     "getFeedById(bytes21)" \
     0x01464c522f55534400000000000000000000000000 \
     --rpc-url https://coston2-api.flare.network/ext/C/rpc
   ```

2. **Verify ContractRegistry**:
   ```bash
   # Get FTSOv2 address from registry
   cast call <CONTRACT_REGISTRY> "getTestFtsoV2()" \
     --rpc-url https://coston2-api.flare.network/ext/C/rpc
   ```

3. **Verify FAsset** (if deployed):
   ```bash
   cast call <FASSET> "symbol()" \
     --rpc-url https://coston2-api.flare.network/ext/C/rpc
   ```

### Notes

- **ContractRegistry is preferred**: Use ContractRegistry to get contract addresses dynamically
- **Testnet vs Mainnet**: Use `getTestFtsoV2()` for testnet, `getFtsoV2()` for mainnet
- **FTSOv2 Interface**: Our `IFtsoRegistry` interface needs to match actual FTSOv2 interface
- **FDC Interface**: Our `IStateConnector` interface is simplified - actual FDC uses `IFdcVerification`
- **Feed IDs**: Use bytes21 feed IDs, not string symbols (for FTSOv2)

### Integration Updates Needed

1. **PriceHedgePool**: Update to use FTSOv2 interface directly or via ContractRegistry
2. **FLIPCore**: Update State Connector interface to match FDC verification
3. **Interfaces**: Align with actual Flare contract interfaces from `@flarenetwork/flare-periphery-contracts`

---

**Last Updated**: $(date)
**Network**: Coston2 Testnet
**Source**: Flare Developer Documentation (https://dev.flare.network/)
