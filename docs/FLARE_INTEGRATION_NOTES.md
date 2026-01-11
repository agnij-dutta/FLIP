# Flare Integration Notes

## Interface Compatibility

### Current Status

Our contracts use simplified interfaces that don't exactly match Flare's actual contracts:

1. **IFtsoRegistry**:
   - Our interface: `getCurrentPriceWithDecimals(string symbol)`
   - Actual FTSOv2: `getFeedById(bytes21 feedId)` or `getFeedByIdInWei(bytes21 feedId)`
   - **Action Needed**: Update `PriceHedgePool` to use FTSOv2 interface directly

2. **IStateConnector**:
   - Our interface: Simplified with `getStateConnectorRound()` and `getAttestation()`
   - Actual FDC: Uses `IFdcVerification.verifyEVMTransaction(Proof)` for verification
   - **Action Needed**: Update `FLIPCore` to use FDC verification interface

### Recommended Approach

**Option 1: Use ContractRegistry (Recommended)**
```solidity
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";

// Get FTSOv2 dynamically
TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

// Use bytes21 feed IDs
bytes21 flrUsdId = 0x01464c522f55534400000000000000000000000000;
(uint256 price, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById(flrUsdId);
```

**Option 2: Create Adapter Contracts**
- Create `FtsoV2Adapter` that implements `IFtsoRegistry` and wraps FTSOv2
- Create `FdcAdapter` that implements `IStateConnector` and wraps FDC verification

**Option 3: Update Contracts Directly**
- Update `PriceHedgePool` to use FTSOv2 interface directly
- Update `FLIPCore` to use FDC verification interface directly

## Known Addresses (Coston2)

### FTSOv2
- **FTSOv2**: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726`
- **FeeCalculator**: `0x88A9315f96c9b5518BBeC58dC6a914e13fAb13e2`

### Feed IDs
- FLR/USD: `0x01464c522f55534400000000000000000000000000`
- XRP/USD: `0x015852502f55534400000000000000000000000000`
- BTC/USD: `0x014254432f55534400000000000000000000000000`

### ContractRegistry
- Use `ContractRegistry.getTestFtsoV2()` for testnet
- Use `ContractRegistry.getFtsoV2()` for mainnet
- Use `ContractRegistry.getFdcVerification()` for FDC

## FAssets Integration

From Flare documentation, FAssets redemption process:

1. User calls `requestRedemption(uint256 amount)` on FAsset contract
2. FAsset system burns tokens and queues redemption
3. Agent pays on underlying chain
4. Agent uses FDC to prove payment
5. Redemption ticket is created
6. Collateral is released

**Our Integration**:
- FLIP intercepts step 1: User calls `FLIPCore.requestRedemption()` instead
- FLIP handles provisional settlement before FDC confirmation
- FLIP uses FDC attestation to finalize

## Testing Strategy

1. **Unit Tests**: ✅ Complete (using mocks)
2. **Integration Tests**: ✅ Complete (using mocks)
3. **Flare Testnet Tests**: ⏳ Pending
   - Deploy to Coston2
   - Test with real FTSOv2 (verify price feeds work)
   - Test with real FDC (verify attestations work)
   - Test with real FAssets (if available on testnet)

## Migration Path

### Phase 1: Current (MVP)
- Use simplified interfaces with mocks
- Deploy to Coston2 with known addresses
- Test basic functionality

### Phase 2: Interface Alignment
- Update to use ContractRegistry
- Update interfaces to match Flare contracts
- Test with real Flare contracts

### Phase 3: Production
- Full integration with Flare contracts
- Use ContractRegistry for all addresses
- Production-ready interfaces

---

**Last Updated**: $(date)
**Status**: Phase 1 (MVP) - Ready for Coston2 deployment

