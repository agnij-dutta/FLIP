# FLIP Bidirectional Architecture Plan

## Overview

FLIP currently supports **Redemption** (FXRP → XRP) with provisional settlement. This document outlines the architecture to add **Minting** (XRP → FXRP) support within the same unified contract, preserving the core invariant:

**FLIP never finalizes value without FDC confirmation.**

```
∀ operation O: Finalize(O) ⟹ FDC(O) = true
```

---

## Current Architecture Review

### Core Components (from docs/architecture.md)

| Contract | Purpose |
|----------|---------|
| **FLIPCore** | Main handler with escrow-based provisional settlement |
| **EscrowVault** | Conditional escrow vault (replaces InsurancePool) |
| **SettlementReceipt** | ERC-721 NFT for conditional claims |
| **LiquidityProviderRegistry** | Market-based opt-in LP system |
| **PriceHedgePool** | FTSO price locking and hedging |
| **OperatorRegistry** | Operator management and slashing |
| **DeterministicScoring** | Mathematical scoring library |

### Redemption Flow (Existing - FXRP → XRP)

```
1. User → FLIPCore.requestRedemption(amount, asset, xrplAddress)
   - Burns FXRP (transfer to dead address)
   - Locks price via PriceHedgePool
   - Status: Pending

2. Operator → evaluateRedemption()
   - DeterministicScoring.calculateScore()
   - Decision: FastLane (≥99.7%) or QueueFDC (<99.7%)

3. FastLane Path:
   - finalizeProvisional() matches LP
   - EscrowVault.createEscrow() holds user's FXRP value
   - SettlementReceipt minted to user
   - User can redeemNow() (with haircut) or wait for FDC

4. Settlement Executor (Agent):
   - Monitors EscrowCreated events
   - Sends XRP to user's XRPL address
   - Submits FDC proof of payment

5. FDC Adjudication:
   - handleFDCAttestation() finalizes
   - Escrow released to LP (payment for service)
   - Status: Finalized
```

### Key Invariants (from MATHEMATICAL_MODEL.md)

1. **FDC Finality**: `∀ R: Finalize(R) ⟹ FDC(P_A(R)) = true`
2. **Agent Boundedness**: Agent cannot finalize without FDC
3. **No Trust Assumption**: All trust is in FDC, not executor
4. **Worst-Case**: Loss = 0, Delay ≤ τ

---

## Proposed: Minting Flow (XRP → FXRP)

### Design Principles

1. **Preserve Core Invariant**: FDC is final judge for all minting operations
2. **Symmetric Design**: Mirror redemption flow with reversed asset direction
3. **LP Market**: LPs provide FXRP liquidity (ERC20 deposits)
4. **Same Scoring**: Use DeterministicScoring for confidence evaluation

### Minting Flow Overview

```
1. User → FAssets: Reserve collateral with agent
   - Gets: reservationId, agentXrplAddress, paymentReference, xrpAmount

2. User → XRPL: Send XRP to agent's address with memo (paymentReference)

3. User → FLIPCore.requestMinting(reservationId, xrplTxHash, xrpAmount, asset)
   - Records minting request
   - Locks price via PriceHedgePool
   - Status: Pending

4. Operator → evaluateMinting()
   - DeterministicScoring.calculateScore()
   - Decision: FastLane (≥99.7%) or QueueFDC (<99.7%)

5. FastLane Path (Instant FXRP):
   - finalizeMintingProvisional() matches LP with FXRP liquidity
   - LP's FXRP → User (instant settlement!)
   - MintingEscrow created (tracks LP's claim to minted tokens)
   - Status: ProvisionalSettled

6. FDC Verification (Background):
   - FDC verifies XRP payment on XRPL
   - Uses Payment attestation type
   - Confirms: destination, amount, memo match

7. FDC Adjudication:
   - handleMintingFDCAttestation()
   - On success: LP claim recorded, FAssets minting directed to LP
   - Status: Finalized

USER GETS FXRP INSTANTLY IN STEP 5 - NO 3-5 MIN WAIT!
```

### Detailed Minting State Machine

```
                    requestMinting()
                          │
                          ▼
                    ┌──────────┐
                    │ Pending  │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    (score ≥ 99.7%)  (score < 99.7%)  (timeout)
         │               │               │
         ▼               ▼               ▼
  ┌──────────────┐ ┌───────────┐  ┌──────────┐
  │ProvisionalSet│ │QueuedForFD│  │ Timeout  │
  │    tled      │ │     C     │  │          │
  └──────┬───────┘ └─────┬─────┘  └──────────┘
         │               │
         │    ┌──────────┼──────────┐
         │    │                     │
         ▼    ▼                     ▼
    ┌───────────┐             ┌──────────┐
    │ Finalized │             │  Failed  │
    │ (FDC ✓)   │             │ (FDC ✗)  │
    └───────────┘             └──────────┘
```

---

## Contract Changes

### 1. FLIPCore.sol - Add Minting State & Functions

```solidity
// ============ MINTING STATE ============

struct MintingRequest {
    address user;
    address asset;                    // FXRP token address
    uint256 collateralReservationId;  // From FAssets AssetManager
    string xrplTxHash;                // XRPL payment tx hash
    uint256 xrpAmount;                // Amount in drops (1 XRP = 1,000,000 drops)
    uint256 fxrpAmount;               // Equivalent FXRP amount (calculated from price)
    uint256 requestedAt;
    uint256 priceLocked;              // FTSO price at request time
    uint256 hedgeId;                  // PriceHedgePool hedge ID
    MintingStatus status;
    uint256 fdcRequestId;             // FDC attestation request ID
    address matchedLP;                // LP who provided FXRP (address(0) if none)
    uint256 haircutRate;              // Haircut rate applied (scaled: 1000000 = 100%)
}

enum MintingStatus {
    Pending,            // Awaiting evaluation
    ProvisionalSettled, // LP provided FXRP, waiting for FDC
    QueuedForFDC,       // Low confidence, waiting for FDC
    Finalized,          // FDC confirmed success
    Failed,             // FDC confirmed failure
    Timeout             // FDC timeout
}

mapping(uint256 => MintingRequest) public mintingRequests;
uint256 public nextMintingId;

// ============ MINTING EVENTS ============

event MintingRequested(
    uint256 indexed mintingId,
    address indexed user,
    address indexed asset,
    uint256 collateralReservationId,
    string xrplTxHash,
    uint256 xrpAmount,
    uint256 fxrpAmount,
    uint256 timestamp
);

event MintingProvisionalSettled(
    uint256 indexed mintingId,
    address indexed user,
    address indexed lp,
    uint256 fxrpAmount,
    uint256 haircutRate,
    uint256 timestamp
);

event MintingFinalized(
    uint256 indexed mintingId,
    bool success,
    uint256 timestamp
);

// ============ MINTING FUNCTIONS ============

/**
 * @notice Request minting with FLIP instant settlement
 * @param _collateralReservationId FAssets collateral reservation ID
 * @param _xrplTxHash XRPL payment transaction hash
 * @param _xrpAmount Amount of XRP sent (in drops)
 * @param _asset FXRP token address
 * @return mintingId Unique minting request ID
 */
function requestMinting(
    uint256 _collateralReservationId,
    string memory _xrplTxHash,
    uint256 _xrpAmount,
    address _asset
) external whenNotPaused returns (uint256 mintingId);

/**
 * @notice Evaluate minting confidence
 * @param _mintingId Minting request ID
 * @param _priceVolatility Current FTSO price volatility
 * @return decision 0=QueueFDC, 1=FastLane
 * @return score Confidence score (scaled: 1000000 = 100%)
 */
function evaluateMinting(
    uint256 _mintingId,
    uint256 _priceVolatility
) external view returns (uint8 decision, uint256 score);

/**
 * @notice Finalize minting provisional settlement
 * @param _mintingId Minting request ID
 * @param _priceVolatility Current price volatility
 */
function finalizeMintingProvisional(
    uint256 _mintingId,
    uint256 _priceVolatility
) external onlyOperator;

/**
 * @notice Handle FDC attestation for minting
 * @param _mintingId Minting request ID
 * @param _fdcRequestId FDC request ID
 * @param _success Whether FDC confirmed payment
 */
function handleMintingFDCAttestation(
    uint256 _mintingId,
    uint256 _fdcRequestId,
    bool _success
) external onlyOperator;

/**
 * @notice Queue minting for FDC (low confidence)
 * @param _mintingId Minting request ID
 */
function queueMintingForFDC(uint256 _mintingId) external onlyOperator;

/**
 * @notice Check minting timeout
 * @param _mintingId Minting request ID
 */
function checkMintingTimeout(uint256 _mintingId) external;
```

### 2. LiquidityProviderRegistry.sol - Add ERC20 Support

```solidity
// ============ ERC20 LIQUIDITY ============

// ERC20 balances: (lp, token) => balance
mapping(address => mapping(address => uint256)) public erc20Balances;

// ERC20 positions: (lp, token) => position
mapping(address => mapping(address => LPPosition)) public erc20Positions;

// Active ERC20 LPs per token
mapping(address => address[]) public activeERC20LPs;

/**
 * @notice Deposit ERC20 liquidity (for minting)
 * @param _token ERC20 token address (e.g., FXRP)
 * @param _amount Amount to deposit
 * @param _minHaircut Minimum haircut LP accepts
 * @param _maxDelay Maximum delay LP tolerates
 */
function depositERC20Liquidity(
    address _token,
    uint256 _amount,
    uint256 _minHaircut,
    uint256 _maxDelay
) external;

/**
 * @notice Withdraw ERC20 liquidity
 * @param _token ERC20 token address
 * @param _amount Amount to withdraw
 */
function withdrawERC20Liquidity(address _token, uint256 _amount) external;

/**
 * @notice Match ERC20 liquidity for minting
 * @param _token ERC20 token address
 * @param _amount Amount needed
 * @param _requestedHaircut Requested haircut
 * @return lp Matched LP address
 * @return availableAmount Amount matched
 */
function matchERC20Liquidity(
    address _token,
    uint256 _amount,
    uint256 _requestedHaircut
) external returns (address lp, uint256 availableAmount);
```

### 3. EscrowVault.sol - Add Minting Escrow Support

```solidity
// ============ MINTING ESCROW ============

struct MintingEscrow {
    uint256 mintingId;
    address user;           // User who receives FXRP
    address lp;             // LP who provided FXRP
    address token;          // FXRP token address
    uint256 amount;         // FXRP amount transferred to user
    uint256 haircutAmount;  // Haircut amount (LP's fee)
    uint256 createdAt;
    uint256 fdcRoundId;
    MintingEscrowStatus status;
}

enum MintingEscrowStatus {
    None,
    Created,    // LP provided FXRP, awaiting FDC
    Released,   // FDC success, LP claim recorded
    Failed,     // FDC failure, LP loses FXRP
    Timeout     // FDC timeout, LP refunded from minted tokens
}

mapping(uint256 => MintingEscrow) public mintingEscrows;

/**
 * @notice Create minting escrow after LP provides FXRP
 * @param _mintingId Minting request ID
 * @param _user User receiving FXRP
 * @param _lp LP providing FXRP
 * @param _token FXRP token address
 * @param _amount Amount of FXRP
 * @param _haircutAmount Haircut amount (LP's fee)
 */
function createMintingEscrow(
    uint256 _mintingId,
    address _user,
    address _lp,
    address _token,
    uint256 _amount,
    uint256 _haircutAmount
) external;

/**
 * @notice Release minting escrow on FDC attestation
 * @param _mintingId Minting request ID
 * @param _success Whether FDC confirmed payment
 * @param _fdcRoundId FDC round ID
 */
function releaseMintingOnFDC(
    uint256 _mintingId,
    bool _success,
    uint256 _fdcRoundId
) external;
```

---

## FDC Integration for Minting

### XRPL Payment Attestation

Flare's FDC can attest to XRPL payments using the **Payment** attestation type:

```
Attestation Request:
{
  "attestationType": "Payment",
  "sourceId": "XRPL",
  "requestBody": {
    "transactionId": "<xrpl_tx_hash>",
    "inUtxo": "0",
    "utxo": "0"
  }
}
```

### FDC Verification Flow

```
1. User sends XRP on XRPL with memo (paymentReference)

2. User submits requestMinting() with xrplTxHash

3. Operator/Agent:
   a. Prepares FDC attestation request via verifier API
   b. Submits to FDC
   c. Waits for attestation round (~90 seconds per round)

4. After attestation (~3-5 minutes):
   a. Fetch Merkle proof from Data Availability Layer
   b. Verify: destination matches FAssets agent
   c. Verify: amount matches expected
   d. Verify: memo matches paymentReference

5. Operator calls handleMintingFDCAttestation() with proof
```

### Using Flare's Native FDC Integration

From `docs/FDC_ENHANCED_SETUP.md` and `docs/FLARE_INTEGRATION_NOTES.md`:

```javascript
// Prepare attestation request
const prepareRequest = await fetch(
  'https://verifier-coston2.flare.network/verifier/xrp/Payment/prepareRequest',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: xrplTxHash,
      inUtxo: '0',
      utxo: '0'
    })
  }
);

// Get proof after attestation round
const proofResponse = await fetch(
  'https://coston2-api.flare.network/api/v0/fdc/get-proof-round-id-bytes',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      votingRoundId: roundId,
      requestBytes: abiEncodedRequest
    })
  }
);
```

---

## LP Economics for Minting

### How Minting LPs Work

1. **Deposit**: LP deposits FXRP to LiquidityProviderRegistry
2. **Match**: When user requests minting, LP's FXRP is matched
3. **Transfer**: LP's FXRP → User (instant settlement)
4. **Wait**: LP waits for FDC confirmation (~3-5 min)
5. **Repayment**: On FDC success, newly minted FXRP → LP (replenishment)
6. **Fee**: LP earns haircut as fee

### Haircut Clearing Condition

Same as redemption (from Appendix A):

```
H ≥ r · T

Where:
- H = haircut rate
- r = LP opportunity cost (annual rate)
- T = escrow duration (~5 minutes = 0.0000095 years)

Example:
- r = 5% annual (0.05)
- T = 5 minutes (0.0000095 years)
- H ≥ 0.05 × 0.0000095 ≈ 0.0000005 (0.00005%)

In practice, LPs set higher haircut to account for:
- Risk premium
- Gas costs
- Operational costs
```

### LP Revenue Model

```
LP Revenue = (Matched Amount × Haircut Rate) per settlement

Example:
- LP deposits 10,000 FXRP
- User mints 100 FXRP with 0.5% haircut
- LP provides 100 FXRP to user
- FDC confirms → LP receives 100.5 FXRP (100 minted + 0.5 fee)
- Net LP gain: 0.5 FXRP
```

### LP Risk

```
If FDC confirms failure (XRP payment invalid):
- LP loses the FXRP they provided
- This is the risk premium LPs charge via haircut

Pr[LP Loss] = Pr[FDC Failure] × Amount
            ≈ (1 - 0.997) × Amount  (for fast lane)
            = 0.003 × Amount
```

---

## Integration with FAssets

### Minting Flow with FAssets

The key challenge: How does the newly minted FXRP go to LP instead of user?

#### Option A: User Directs Minted Tokens (Simpler)

```
1. User requests minting via FLIP
2. LP provides FXRP to user (instant)
3. FDC confirms XRP payment
4. User calls FAssets executeMinting() → receives FXRP
5. User transfers FXRP to LP (repayment)

Problem: Requires user cooperation for LP repayment
```

#### Option B: FLIP Executes Minting on Behalf (Better)

```
1. User requests minting via FLIP
2. LP provides FXRP to user (instant)
3. User grants FLIP permission to call executeMinting()
4. FDC confirms XRP payment
5. FLIP calls FAssets executeMinting() on user's behalf
6. Newly minted FXRP → LP (automatic repayment)

Benefit: No user cooperation needed after initial request
```

#### Option C: Escrow-Based Repayment (Most Secure)

```
1. User requests minting via FLIP
2. User deposits collateral (small amount) to escrow
3. LP provides FXRP to user (instant)
4. FDC confirms XRP payment
5. User calls executeMinting() → receives FXRP
6. User repays LP from escrow prompt
7. If user fails to repay: escrow slashed, LP compensated

Benefit: Economic incentive for user to repay
```

### Recommended: Option B with Fallback

```solidity
// User grants FLIP permission during requestMinting()
function requestMinting(...) external {
    // ... validation ...

    // Store user's intent to allow FLIP to execute minting
    mintingRequests[mintingId].userAuthorizedFlip = true;

    // ... rest of logic ...
}

// After FDC success, FLIP can execute minting
function handleMintingFDCAttestation(...) external {
    // ... FDC verification ...

    if (success && mintingRequest.userAuthorizedFlip) {
        // Execute minting on behalf of user
        // Direct minted tokens to LP
    }
}
```

---

## Data Flow Diagrams

### Complete Minting Flow

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │ FAssets  │    │  FLIP   │    │   LP    │    │  FDC    │
└────┬────┘    └────┬─────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │               │              │              │
     │ reserveCollateral()         │              │              │
     │─────────────>│              │              │              │
     │<─────────────│              │              │              │
     │ reservationId, agentAddr    │              │              │
     │              │               │              │              │
     │ Send XRP (XRPL)             │              │              │
     │─────────────>│              │              │              │
     │              │               │              │              │
     │ requestMinting(xrplTxHash)  │              │              │
     │──────────────────────────────>              │              │
     │              │               │              │              │
     │              │  evaluateMinting() (≥99.7%)  │              │
     │              │               │              │              │
     │              │  finalizeMintingProvisional()│              │
     │              │               │─────────────>│              │
     │              │               │<─────────────│              │
     │              │               │ FXRP matched │              │
     │<────────────────────────────────────────────│              │
     │       FXRP (instant!)       │              │              │
     │              │               │              │              │
     │    ══════════════════════════════════════════════════════ │
     │    ║  USER IS DONE - HAS FXRP INSTANTLY  ║               │
     │    ══════════════════════════════════════════════════════ │
     │              │               │              │              │
     │              │               │    [Background: FDC]       │
     │              │               │              │              │
     │              │               │ Prepare attestation        │
     │              │               │──────────────────────────────>
     │              │               │              │              │
     │              │               │       [~3-5 min]           │
     │              │               │              │              │
     │              │               │<──────────────────────────────
     │              │               │ FDC proof    │              │
     │              │               │              │              │
     │              │ executeMinting() (on behalf) │              │
     │              │<──────────────│              │              │
     │              │───────────────>              │              │
     │              │  Minted FXRP │───────────────>              │
     │              │               │ (repayment)  │              │
     │              │               │              │              │
```

### Complete Redemption Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │  FLIP   │    │  Agent  │    │   LP    │    │  FDC    │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │ requestRedemption(amount, xrplAddr)       │              │
     │─────────────>│              │              │              │
     │              │              │              │              │
     │              │ evaluateRedemption() (≥99.7%)              │
     │              │              │              │              │
     │              │ finalizeProvisional()       │              │
     │              │─────────────────────────────>│              │
     │<─────────────│              │              │              │
     │ Receipt NFT  │              │              │              │
     │              │              │              │              │
     │ redeemNow()  │              │              │              │
     │─────────────>│              │              │              │
     │              │─────────────>│              │              │
     │              │ EscrowCreated│              │              │
     │              │              │              │              │
     │              │              │ Send XRP     │              │
     │              │              │─────────────────────────────>│
     │<──────────────────────────────────────────────────────────│
     │       XRP received (XRPL)   │              │              │
     │              │              │              │              │
     │    ══════════════════════════════════════════════════════ │
     │    ║  USER IS DONE - HAS XRP INSTANTLY   ║               │
     │    ══════════════════════════════════════════════════════ │
     │              │              │              │              │
     │              │              │    [Background: FDC]        │
     │              │              │──────────────────────────────>
     │              │              │              │              │
     │              │              │<──────────────────────────────
     │              │ handleFDCAttestation()      │              │
     │              │─────────────────────────────>│              │
     │              │              │ FXRP (payment)              │
```

---

## Implementation Phases

### Phase 1: Contract Updates (Priority)

1. **FLIPCore.sol**
   - Add MintingRequest struct and state
   - Add minting functions (request, evaluate, finalize, handleFDC)
   - Add minting events

2. **LiquidityProviderRegistry.sol**
   - Add ERC20 deposit/withdraw functions
   - Add ERC20 matching logic
   - Track ERC20 balances and positions

3. **EscrowVault.sol**
   - Add MintingEscrow struct and state
   - Add minting escrow functions

### Phase 2: FDC Integration

1. **FDC Helper Library**
   - Attestation request preparation
   - Merkle proof verification
   - Payment validation

2. **Agent Service Updates**
   - Monitor MintingRequested events
   - Submit FDC attestation requests
   - Call handleMintingFDCAttestation

### Phase 3: Frontend Updates

1. **Mint Page** (`frontend/app/mint/page.tsx`)
   - Add FLIP instant settlement flow
   - Remove FDC wait step for users
   - Show instant FXRP receipt

2. **Redeem Page** (`frontend/app/redeem/page.tsx`)
   - Integrate with FLIP redemption
   - Show instant XRP option

3. **LP Dashboard** (new)
   - Deposit/withdraw liquidity
   - View earnings
   - Manage positions

### Phase 4: Testing

1. **Unit Tests**
   - Minting functions
   - ERC20 liquidity
   - Minting escrow

2. **Integration Tests**
   - Full minting flow
   - LP matching
   - FDC attestation

3. **E2E Tests**
   - Testnet deployment
   - Real FDC integration
   - Frontend flow

---

## File Changes Summary

| File | Changes |
|------|---------|
| `contracts/FLIPCore.sol` | Add minting structs, functions, events |
| `contracts/LiquidityProviderRegistry.sol` | Add ERC20 deposit/withdraw/match |
| `contracts/EscrowVault.sol` | Add minting escrow functions |
| `contracts/interfaces/IERC20.sol` | Standard ERC20 interface |
| `agent/main.go` | Add minting event monitoring |
| `frontend/app/mint/page.tsx` | Use FLIP for instant settlement |
| `frontend/app/redeem/page.tsx` | Use FLIP for instant settlement |
| `frontend/lib/flip.ts` | Add FLIP contract interactions |
| `docs/architecture.md` | Update with bidirectional flows |

---

## Safety Guarantees (Preserved)

### Core Invariant

```
∀ operation O: Finalize(O) ⟹ FDC(O) = true
```

This applies to both minting and redemption.

### Minting Safety

1. **User Safety**: User receives FXRP instantly, no waiting
2. **LP Safety**: LP repaid from minted tokens after FDC
3. **Protocol Safety**: No value created without FDC confirmation

### Failure Modes

| Failure | Impact | Resolution |
|---------|--------|------------|
| FDC confirms XRP payment invalid | LP loses FXRP | LP risk premium (haircut) |
| FDC timeout | LP FXRP returned | Timeout release |
| No LP available | User waits for FDC | Fallback to native FAssets |
| Price volatility high | Queue for FDC | Conservative routing |

### Three-Layer Protection (Extended)

1. **Deterministic Scoring** → Reduces bad fast lanes
2. **Haircut + LP Market** → Prices risk
3. **FDC Finality** → Guarantees correctness

Applied to both minting AND redemption.

---

## Conclusion

This bidirectional architecture:

1. **Preserves all whitepaper guarantees**
2. **Adds instant minting** (XRP → FXRP)
3. **Uses same LP market model**
4. **Maintains FDC as final judge**
5. **Eliminates 3-5 minute wait for users**

**User Experience**:
- Minting: Send XRP → Get FXRP in seconds (not minutes)
- Redemption: Burn FXRP → Get XRP in seconds (not minutes)

**LP Experience**:
- Deposit FXRP and/or provide XRP liquidity
- Earn haircut fees on each settlement
- Risk: FDC failure (priced into haircut)

---

**Next Steps**: Review this plan and proceed with Phase 1 implementation.

---

**Last Updated**: January 2026
**Version**: FLIP Bidirectional Plan v2.0
