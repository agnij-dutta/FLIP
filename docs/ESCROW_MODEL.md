# FLIP Escrow Model (v2)

## Overview

FLIP v2 replaces the prefunded InsurancePool with an **escrow-based conditional settlement** model. This eliminates idle capital requirements while maintaining user protection through conditional escrows and FDC adjudication.

## Architecture

### Core Components

1. **EscrowVault** - Conditional escrow vault that holds funds until FDC adjudication
2. **SettlementReceipt** - ERC-721 NFT representing conditional claims on escrowed funds
3. **LiquidityProviderRegistry** - Market-based opt-in liquidity provider system

### Key Differences from v1

| Aspect | v1 (InsurancePool) | v2 (EscrowVault) |
|--------|-------------------|-------------------|
| **Capital Model** | Prefunded pool (capital-intensive) | Escrow per redemption (capital-efficient) |
| **Funding Source** | Insurance pool | Users (wait path) or LPs (fast path) |
| **User Experience** | Immediate payout | Receipt NFT with redemption options |
| **Capital Efficiency** | Low (idle capital) | High (10-20× improvement) |

## Escrow Flow

### 1. Redemption Request

```
User → FLIPCore.requestRedemption()
  ↓
Status: Pending
```

### 2. Provisional Settlement Decision

```
FLIPCore.evaluateRedemption()
  ↓
DeterministicScoring.calculateScore()
  ↓
Decision: FastLane (score >= 99.7%) or QueueFDC (score < 99.7%)
```

### 3. Escrow Creation (FastLane Path)

```
FLIPCore.finalizeProvisional()
  ↓
Try LP matching: lpRegistry.matchLiquidity()
  ↓
If LP matched:
  → EscrowVault.createEscrow() with LP funds
  → SettlementReceipt.mintReceipt() with LP haircut
  → Status: EscrowCreated (LP-funded)
  
If no LP:
  → EscrowVault.createEscrow() with user funds (wait path)
  → SettlementReceipt.mintReceipt() with suggested haircut
  → Status: EscrowCreated (user-wait)
```

### 4. Receipt Redemption Options

#### Option A: Immediate Redemption (with haircut)
```
User → SettlementReceipt.redeemNow(tokenId)
  ↓
If LP-funded:
  → Transfer (amount - haircut) to user immediately
  → LP earns haircut fee
  → Status: ReceiptRedeemed
  
If user-wait:
  → Transfer (amount - haircut) to user immediately
  → Remaining haircut stays in escrow
  → Status: ReceiptRedeemed
```

#### Option B: Wait for FDC (full amount)
```
User → SettlementReceipt.redeemAfterFDC(tokenId)
  ↓
Wait for FDC attestation
  ↓
After FDC confirms success:
  → Transfer full amount to user (no haircut)
  → Status: ReceiptRedeemed
```

### 5. FDC Adjudication

```
FLIPCore.handleFDCAttestation(redemptionId, requestId, success)
  ↓
If success:
  → EscrowVault.releaseOnFDC(redemptionId, true)
  → Status: Finalized
  → Funds released to user (or LP if already redeemed)
  
If failure:
  → EscrowVault.releaseOnFDC(redemptionId, false)
  → Status: Failed
  → Funds returned to LP (if LP-funded) or user (if user-wait)
```

### 6. Timeout Handling

```
If FDC doesn't attest within 600 seconds:
  → FLIPCore.checkTimeout(redemptionId)
  → EscrowVault.timeoutRelease(redemptionId)
  → Status: Timeout
  → Funds returned to LP (if LP-funded) or user (if user-wait)
```

## Escrow States

```solidity
enum EscrowStatus {
    None,       // Escrow not created
    Created,    // Escrow created, awaiting FDC
    Released,   // Escrow released (FDC success)
    Failed,     // Escrow failed (FDC failure)
    Timeout     // Escrow timed out
}
```

## Escrow Structure

```solidity
struct Escrow {
    uint256 redemptionId;
    address user;           // Original user requesting redemption
    address lp;             // LP providing liquidity (address(0) if user-wait)
    address asset;          // Asset being redeemed
    uint256 amount;         // Escrowed amount
    uint256 createdAt;      // Timestamp when escrow created
    uint256 fdcRoundId;     // FDC round ID (set when FDC attests)
    EscrowStatus status;
    bool lpFunded;          // True if LP provided funds, false if user waiting
}
```

## Capital Efficiency Analysis

### v1 (InsurancePool) Capital Requirements

- **Prefunded Pool**: 3× monthly liability (e.g., $30M for $10M/month)
- **Idle Capital**: Pool sits idle between redemptions
- **Capital Intensity**: High - requires large upfront capital

### v2 (EscrowVault) Capital Requirements

- **Per-Redemption Escrow**: Only funds for active redemptions
- **LP Capital**: Market-based, opt-in (LPs earn spreads)
- **Capital Intensity**: Low - no idle capital

### Improvement

**10-20× capital efficiency improvement** - Only escrow active redemptions instead of maintaining large prefunded pool.

## Security Considerations

### 1. Escrow Release Logic

- **FDC Adjudication**: FDC is the final arbiter - its decision is binding
- **Timeout Protection**: 600-second timeout prevents indefinite lock
- **LP Protection**: Failed redemptions return funds to LP (if LP-funded)

### 2. Receipt Security

- **ERC-721 Standard**: Standard NFT, transferable, tradeable
- **Metadata Integrity**: Receipt metadata stored on-chain
- **Redemption Authorization**: Only receipt owner can redeem

### 3. LP Risk Management

- **Haircut Protection**: LPs set minimum haircut requirements
- **Delay Limits**: LPs set maximum delay tolerance
- **Settlement Tracking**: LP earnings tracked for fee distribution

## Migration from v1

**Critical**: v1 InsurancePool cannot be migrated to v2 EscrowVault.

**Migration Path**:
1. Deploy v2 contracts alongside v1
2. Pause v1 FLIPCore (if upgradeable) or deploy new FLIPCore
3. Migrate any pending redemptions manually
4. Withdraw v1 InsurancePool funds (if any)
5. Decommission v1 contracts

## API Reference

### EscrowVault

```solidity
function createEscrow(
    uint256 _redemptionId,
    address _user,
    address _lp,
    address _asset,
    uint256 _amount,
    bool _lpFunded
) external;

function releaseOnFDC(uint256 _redemptionId, bool _success) external;

function timeoutRelease(uint256 _redemptionId) external;

function getEscrowStatus(uint256 _redemptionId) external view returns (EscrowStatus);

function getEscrow(uint256 _redemptionId) external view returns (Escrow memory);
```

### SettlementReceipt

```solidity
function mintReceipt(
    address _to,
    uint256 _redemptionId,
    address _asset,
    uint256 _amount,
    uint256 _haircutRate,
    address _lp
) external returns (uint256 tokenId);

function redeemNow(uint256 _tokenId) external;

function redeemAfterFDC(uint256 _tokenId) external;

function redemptionToTokenId(uint256 _redemptionId) external view returns (uint256);
```

## Examples

### Example 1: LP-Funded Fast Lane

```solidity
// 1. User requests redemption
uint256 redemptionId = flipCore.requestRedemption(100 ether, address(fxrp));

// 2. Operator finalizes provisional (LP matched)
flipCore.finalizeProvisional(redemptionId, 5000, 995000, 200000 ether);

// 3. User receives receipt NFT
uint256 receiptId = settlementReceipt.redemptionToTokenId(redemptionId);

// 4. User redeems immediately (with 1% haircut)
settlementReceipt.redeemNow(receiptId);
// User receives: 99 ether immediately
// LP earns: 1 ether haircut fee

// 5. FDC confirms success later
flipCore.handleFDCAttestation(redemptionId, 1, true);
// LP receives full 100 ether (already paid user 99 ether, keeps 1 ether fee)
```

### Example 2: User-Wait Path

```solidity
// 1. User requests redemption (no LP available)
uint256 redemptionId = flipCore.requestRedemption(100 ether, address(fxrp));

// 2. Operator finalizes provisional (no LP match)
flipCore.finalizeProvisional(redemptionId, 5000, 995000, 200000 ether);

// 3. User receives receipt NFT
uint256 receiptId = settlementReceipt.redemptionToTokenId(redemptionId);

// 4. User waits for FDC
// ... (600 seconds later) ...

// 5. FDC confirms success
flipCore.handleFDCAttestation(redemptionId, 1, true);

// 6. User redeems full amount (no haircut)
settlementReceipt.redeemAfterFDC(receiptId);
// User receives: 100 ether (full amount)
```

## Future Enhancements

1. **Receipt Trading**: Enable secondary market for receipts
2. **Partial Redemption**: Allow partial receipt redemption
3. **Escrow Insurance**: Optional insurance for escrow failures
4. **Multi-Asset Escrows**: Support multiple assets in single escrow
5. **Escrow Pooling**: Pool multiple small escrows for efficiency

