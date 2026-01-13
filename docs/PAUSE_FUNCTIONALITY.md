# FLIP v2 - Pause Functionality

## Overview

FLIPCore implements a pause mechanism that allows the owner to temporarily halt new redemption requests while existing escrows continue to operate normally.

## Implementation

### Contract: `Pausable.sol`

```solidity
abstract contract Pausable {
    bool public paused;
    address public owner;
    
    modifier whenNotPaused() {
        require(!paused, "Pausable: paused");
        _;
    }
    
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
}
```

### Integration: `FLIPCore.sol`

FLIPCore inherits from Pausable and applies `whenNotPaused` modifier to `requestRedemption()`:

```solidity
contract FLIPCore is Pausable {
    function requestRedemption(...) external whenNotPaused {
        // New redemptions blocked when paused
    }
}
```

## Pause Triggers

### When to Pause

1. **Security Incident**
   - Suspected exploit or vulnerability
   - Unusual activity detected
   - Emergency response required

2. **Capital Limits Exceeded**
   - Total escrow capital exceeds theoretical bound
   - `E[C_escrow] > λ · f · τ · R_max`
   - Risk of capital exhaustion

3. **FDC Issues**
   - FDC attestation delays beyond normal
   - FDC failure rate spikes
   - State Connector issues

4. **Oracle Issues**
   - FTSO price feed failures
   - Oracle consensus issues
   - Price manipulation detected

5. **Governance Decision**
   - Protocol upgrade preparation
   - Parameter adjustment period
   - Maintenance window

## Behavior When Paused

### Blocked Operations

- ❌ `requestRedemption()` - New redemptions blocked
- ❌ New escrow creation blocked

### Allowed Operations

- ✅ Existing escrows continue (release, refund, timeout)
- ✅ Receipt redemption (immediate or after FDC)
- ✅ FDC attestation handling
- ✅ Timeout releases
- ✅ LP withdrawals
- ✅ View functions

## Safety Guarantees

### Existing Escrows Unaffected

**Guarantee:** When paused, all existing escrows continue to operate normally.

**Proof:**
- Pause only affects `requestRedemption()` (new redemptions)
- Escrow release/refund/timeout functions are not paused
- Users with existing escrows are unaffected

### No User Loss

**Guarantee:** Pausing does not cause user loss.

**Proof:**
- Existing escrows continue to release/refund
- Users can still redeem receipts
- No funds are locked indefinitely

## Testing

### Test Cases

1. **Pause Blocks New Redemptions**
   ```solidity
   flipCore.pause();
   vm.expectRevert("Pausable: paused");
   flipCore.requestRedemption(amount, asset);
   ```

2. **Existing Escrows Continue**
   ```solidity
   // Create escrow
   uint256 redemptionId = flipCore.requestRedemption(...);
   // Pause
   flipCore.pause();
   // Escrow operations still work
   flipCore.handleFDCAttestation(redemptionId, true, roundId);
   ```

3. **Unpause Restores Functionality**
   ```solidity
   flipCore.pause();
   flipCore.unpause();
   // New redemptions work again
   flipCore.requestRedemption(...);
   ```

## Access Control

- **Owner Only:** Only contract owner can pause/unpause
- **No Time Lock:** Immediate pause/unpause (owner discretion)
- **Governance:** In production, owner should be multisig/DAO

## Recommendations

1. **Multisig Owner:** Use multisig for pause control
2. **Monitoring:** Alert on pause events
3. **Documentation:** Document pause procedures
4. **Communication:** Announce pauses to users
5. **Time Limits:** Consider time-locked unpause for safety

---

**Last Updated**: $(date)
**Status**: ✅ **Implemented**


