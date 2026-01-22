# FLIP Bidirectional Plan - Open Questions Answered

**Based on Current Implementation State**  
**Date**: January 2026

This document answers all open-ended questions in `BIDIRECTIONAL_FLIP_PLAN.md` based on the current FLIP v2 implementation patterns and architecture.

---

## Question 1: FAssets Integration - How Does Minted FXRP Go to LP?

**Location in Plan**: Lines 516-583  
**Status**: ✅ **ANSWERED - Option B with Enhanced Security**

### Recommended Solution: Option B (FLIP Executes on Behalf) with Authorization Pattern

Based on the current redemption flow pattern and FAssets integration, here's the definitive answer:

### Implementation Pattern

```solidity
// In FLIPCore.sol - MintingRequest struct
struct MintingRequest {
    // ... existing fields ...
    bool userAuthorizedFlip;        // User grants FLIP permission
    address mintingExecutor;         // Address authorized to execute minting (FLIPCore or user)
    uint256 fdcRoundId;              // FDC round when payment was confirmed
}

// During requestMinting()
function requestMinting(
    uint256 _collateralReservationId,
    string memory _xrplTxHash,
    uint256 _xrpAmount,
    address _asset,
    bool _authorizeFlipExecution    // User opts in
) external whenNotPaused returns (uint256 mintingId) {
    // ... validation ...
    
    mintingRequests[mintingId] = MintingRequest({
        // ... other fields ...
        userAuthorizedFlip: _authorizeFlipExecution,
        mintingExecutor: _authorizeFlipExecution ? address(this) : msg.sender,
        // ...
    });
}

// After FDC success
function handleMintingFDCAttestation(
    uint256 _mintingId,
    uint256 _fdcRequestId,
    bool _success
) external onlyOperator {
    MintingRequest storage request = mintingRequests[_mintingId];
    require(request.status == MintingStatus.ProvisionalSettled, "FLIPCore: invalid status");
    
    if (_success) {
        // FDC confirmed XRP payment is valid
        
        if (request.userAuthorizedFlip && request.matchedLP != address(0)) {
            // FLIP executes minting on behalf of user
            // Direct minted tokens to LP for repayment
            
            // Step 1: Call FAssets AssetManager.executeMinting()
            IAssetManager assetManager = IAssetManager(_getAssetManager(request.asset));
            
            // Prepare FDC proof (from attestation)
            bytes memory fdcProof = _getFDCProof(_fdcRequestId);
            
            // Execute minting - minted tokens go directly to LP
            assetManager.executeMinting(
                request.collateralReservationId,
                fdcProof,
                request.matchedLP  // ← Minted FXRP goes to LP, not user
            );
            
            // Step 2: Record LP repayment in EscrowVault
            escrowVault.releaseMintingOnFDC(_mintingId, true, _fdcRequestId);
            
            // Step 3: LP earns haircut (already transferred to user in step 5 of flow)
            // The haircut is the difference: (mintedAmount - userReceivedAmount)
            
        } else {
            // User didn't authorize or no LP matched
            // User must execute minting themselves and repay LP manually
            // This is the fallback path
        }
        
        request.status = MintingStatus.Finalized;
        emit MintingFinalized(_mintingId, true, block.timestamp);
    } else {
        // FDC confirmed failure
        // LP loses FXRP they provided (risk premium)
        escrowVault.releaseMintingOnFDC(_mintingId, false, _fdcRequestId);
        request.status = MintingStatus.Failed;
        emit MintingFinalized(_mintingId, false, block.timestamp);
    }
}
```

### Why Option B?

1. **Matches Current Pattern**: Redemption flow uses similar authorization pattern
2. **User Experience**: User gets FXRP instantly, no manual repayment needed
3. **LP Safety**: LP automatically repaid from minted tokens
4. **Fallback**: If user doesn't authorize, they can still use Option A manually

### Authorization Flow

```solidity
// User grants permission during requestMinting()
// Frontend shows checkbox: "Allow FLIP to execute minting on my behalf"
// If checked: userAuthorizedFlip = true
// If unchecked: userAuthorizedFlip = false (user must execute manually)
```

### Security Considerations

- **User Control**: User explicitly opts in (no default authorization)
- **LP Protection**: LP only matched if user authorizes (or LP accepts manual repayment risk)
- **FDC Finality**: Minting only executes after FDC confirms payment
- **Reentrancy**: Use checks-effects-interactions pattern

---

## Question 2: FDC Integration Details for Minting

**Location in Plan**: Lines 380-451  
**Status**: ✅ **ANSWERED - Based on Current Agent Implementation**

### FDC Attestation Flow for Minting

Based on the current agent implementation (`agent/fdc_submitter.go` and `agent/event_monitor.go`):

```go
// In agent service - New minting event handler
func (a *Agent) handleMintingRequested(ctx context.Context, event MintingRequestedEvent) error {
    // Step 1: Prepare FDC attestation request
    attestationRequest := FDCRequest{
        AttestationType: "Payment",
        SourceID:        "XRPL",
        RequestBody: map[string]interface{}{
            "transactionId": event.XRPLTxHash,
            "inUtxo":        "0",
            "utxo":          "0",
        },
    }
    
    // Step 2: Submit to FDC verifier
    requestID, err := a.fdcSubmitter.PrepareAttestationRequest(ctx, attestationRequest)
    if err != nil {
        return fmt.Errorf("failed to prepare FDC request: %w", err)
    }
    
    // Step 3: Wait for FDC round (~3-5 minutes)
    // Monitor FDC rounds until attestation is available
    
    // Step 4: Fetch Merkle proof
    proof, err := a.fdcSubmitter.GetFDCProof(ctx, requestID)
    if err != nil {
        return fmt.Errorf("failed to get FDC proof: %w", err)
    }
    
    // Step 5: Verify proof details
    // - destination matches FAssets agent address
    // - amount matches expected XRP amount
    // - memo matches paymentReference from collateral reservation
    
    // Step 6: Submit to FLIPCore
    err = a.fdcSubmitter.SubmitMintingProof(ctx, event.MintingID, proof)
    if err != nil {
        return fmt.Errorf("failed to submit minting proof: %w", err)
    }
    
    return nil
}
```

### FDC Proof Verification

```solidity
// In FLIPCore.sol
function handleMintingFDCAttestation(
    uint256 _mintingId,
    uint256 _fdcRequestId,
    bool _success
) external onlyOperator {
    MintingRequest storage request = mintingRequests[_mintingId];
    
    // Verify FDC proof matches expected payment
    bytes32 merkleRoot = stateConnector.getAttestation(_fdcRequestId);
    
    // Verify payment details match
    require(
        _verifyPaymentDetails(merkleRoot, request.xrplTxHash, request.xrpAmount),
        "FLIPCore: FDC proof mismatch"
    );
    
    // ... rest of logic ...
}
```

### API Endpoints (From Current Implementation)

- **Verifier**: `https://verifier-coston2.flare.network/verifier/xrp/Payment/prepareRequest`
- **Proof Fetch**: `https://coston2-api.flare.network/api/v0/fdc/get-proof-round-id-bytes`
- **State Connector**: `0x1000000000000000000000000000000000000005` (Coston2)

---

## Question 3: LP Repayment Mechanism

**Location in Plan**: Lines 455-512  
**Status**: ✅ **ANSWERED - Based on Current EscrowVault Pattern**

### How LP Gets Repaid

Based on the current `EscrowVault` pattern for redemptions:

```solidity
// In EscrowVault.sol - Minting escrow release
function releaseMintingOnFDC(
    uint256 _mintingId,
    bool _success,
    uint256 _fdcRoundId
) external onlyAuthorized {
    MintingEscrow storage escrow = mintingEscrows[_mintingId];
    require(escrow.status == MintingEscrowStatus.Created, "EscrowVault: invalid status");
    
    if (_success) {
        // FDC confirmed XRP payment is valid
        // LP's claim is now valid - they will receive minted FXRP
        
        // The actual FXRP transfer happens in FLIPCore.handleMintingFDCAttestation()
        // when it calls AssetManager.executeMinting() with LP as recipient
        
        // Here we just mark the escrow as released
        escrow.status = MintingEscrowStatus.Released;
        escrow.fdcRoundId = _fdcRoundId;
        
        // Record LP earnings (haircut amount)
        lpRegistry.recordSettlement(
            escrow.lp,
            escrow.token,
            escrow.amount,
            escrow.haircutAmount
        );
        
        emit MintingEscrowReleased(_mintingId, escrow.lp, escrow.amount, _fdcRoundId);
    } else {
        // FDC confirmed failure
        // LP loses the FXRP they provided (this is their risk premium)
        escrow.status = MintingEscrowStatus.Failed;
        
        // No repayment - LP takes the loss
        // This is why LPs charge haircut fees (to compensate for this risk)
        
        emit MintingEscrowFailed(_mintingId, escrow.lp, escrow.amount);
    }
}
```

### Repayment Flow

```
1. LP provides FXRP to user (instant) → User has FXRP
2. FDC confirms XRP payment is valid
3. FLIPCore calls AssetManager.executeMinting() with LP as recipient
4. AssetManager mints FXRP directly to LP address
5. LP receives: originalAmount + haircutAmount (from minted tokens)
6. Net result: LP has same amount + haircut fee
```

### LP Risk Calculation

```solidity
// LP Risk = Pr[FDC Failure] × Amount Provided
// For fast lane (score ≥ 99.7%): Pr[FDC Failure] ≈ 0.3%
// LP Risk = 0.003 × Amount

// LP sets minHaircut to cover this risk:
// minHaircut ≥ (Risk Premium + Opportunity Cost + Gas Costs)
// Example: minHaircut = 0.5% (5000 scaled) covers:
//   - 0.3% risk premium
//   - 0.1% opportunity cost
//   - 0.1% gas and operational costs
```

---

## Question 4: User Authorization Mechanism

**Location in Plan**: Lines 561-583  
**Status**: ✅ **ANSWERED - ERC20 Approval Pattern**

### Authorization Pattern

Based on the current redemption flow (which uses ERC20 `approve` pattern):

```solidity
// In FLIPCore.sol
struct MintingRequest {
    // ... other fields ...
    bool userAuthorizedFlip;        // User grants permission
    address mintingExecutor;         // Who can execute minting
}

// User authorization is explicit during requestMinting()
function requestMinting(
    uint256 _collateralReservationId,
    string memory _xrplTxHash,
    uint256 _xrpAmount,
    address _asset,
    bool _authorizeFlipExecution    // ← User opts in here
) external whenNotPaused returns (uint256 mintingId) {
    // ... validation ...
    
    mintingRequests[mintingId] = MintingRequest({
        user: msg.sender,
        userAuthorizedFlip: _authorizeFlipExecution,
        mintingExecutor: _authorizeFlipExecution ? address(this) : msg.sender,
        // ... other fields ...
    });
}
```

### Frontend Implementation

```typescript
// In frontend/app/mint/page.tsx
const [authorizeFlipExecution, setAuthorizeFlipExecution] = useState(true);

async function handleRequestMinting() {
    // User can toggle authorization
    const mintingId = await writeContract({
        address: FLIP_CORE_ADDRESS,
        abi: FLIP_CORE_ABI,
        functionName: 'requestMinting',
        args: [
            collateralReservationId,
            xrplTxHash,
            xrpAmount,
            assetAddress,
            authorizeFlipExecution  // ← User's choice
        ],
    });
}

// UI: Checkbox for user
<Checkbox
    checked={authorizeFlipExecution}
    onCheckedChange={setAuthorizeFlipExecution}
>
    Allow FLIP to execute minting on my behalf (recommended)
</Checkbox>
<p className="text-sm text-gray-400">
    If enabled, FLIP will automatically execute minting and repay LP.
    If disabled, you must execute minting manually after FDC confirms.
</p>
```

### Security Model

- **Explicit Opt-In**: User must explicitly grant permission (no default)
- **Revocable**: User can choose not to authorize (but must repay LP manually)
- **Transparent**: Frontend clearly explains what authorization means
- **Fallback**: If not authorized, user can still use FLIP (just manual repayment)

---

## Question 5: Collateral Reservation Integration

**Location in Plan**: Lines 516-636  
**Status**: ✅ **ANSWERED - Based on Current Frontend Implementation**

### Current FAssets Integration Pattern

Based on `frontend/app/mint/page.tsx` and `frontend/lib/fassets.ts`:

```typescript
// Step 1: User reserves collateral with FAssets
async function handleReserveCollateral() {
    const result = await writeContract({
        address: assetManagerAddress,
        abi: ASSET_MANAGER_ABI,
        functionName: 'reserveCollateral',
        args: [selectedAgent.address, lots, fee],
    });
    
    // Parse CollateralReserved event
    // Extract: reservationId, agentXrplAddress, paymentReference, xrpAmount
}

// Step 2: User sends XRP on XRPL
// (User does this manually via Xaman/XUMM wallet)

// Step 3: User requests minting via FLIP
async function handleRequestMinting() {
    const mintingId = await writeContract({
        address: FLIP_CORE_ADDRESS,
        abi: FLIP_CORE_ABI,
        functionName: 'requestMinting',
        args: [
            reservationId,      // From step 1
            xrplTxHash,        // From step 2
            xrpAmount,         // From step 1
            fxrpAddress,       // FXRP token address
            authorizeFlip      // User's authorization choice
        ],
    });
}
```

### FLIP Integration with FAssets

```solidity
// In FLIPCore.sol - requestMinting()
function requestMinting(
    uint256 _collateralReservationId,
    string memory _xrplTxHash,
    uint256 _xrpAmount,
    address _asset,
    bool _authorizeFlipExecution
) external whenNotPaused returns (uint256 mintingId) {
    // Validate collateral reservation exists
    IAssetManager assetManager = IAssetManager(_getAssetManager(_asset));
    
    // Verify reservation is valid and belongs to user
    CollateralReservation memory reservation = assetManager.getCollateralReservation(_collateralReservationId);
    require(reservation.user == msg.sender, "FLIPCore: reservation not owned by user");
    require(reservation.status == ReservationStatus.Active, "FLIPCore: reservation not active");
    
    // Calculate FXRP amount from XRP amount using locked price
    uint256 fxrpAmount = _calculateFXRPAmount(_xrpAmount, _asset);
    
    // Lock price via PriceHedgePool
    (uint256 lockedPrice, uint256 hedgeId) = priceHedgePool.lockPrice(_asset, fxrpAmount);
    
    mintingId = nextMintingId++;
    
    mintingRequests[mintingId] = MintingRequest({
        user: msg.sender,
        asset: _asset,
        collateralReservationId: _collateralReservationId,
        xrplTxHash: _xrplTxHash,
        xrpAmount: _xrpAmount,
        fxrpAmount: fxrpAmount,
        requestedAt: block.timestamp,
        priceLocked: lockedPrice,
        hedgeId: hedgeId,
        status: MintingStatus.Pending,
        fdcRequestId: 0,
        matchedLP: address(0),
        haircutRate: 0,
        userAuthorizedFlip: _authorizeFlipExecution,
        mintingExecutor: _authorizeFlipExecution ? address(this) : msg.sender
    });
    
    emit MintingRequested(mintingId, msg.sender, _asset, _collateralReservationId, _xrplTxHash, _xrpAmount, fxrpAmount, block.timestamp);
    
    return mintingId;
}
```

### Key Points

1. **Reservation Validation**: FLIP verifies reservation exists and belongs to user
2. **Price Locking**: FLIP locks price same as redemption flow
3. **Amount Calculation**: FXRP amount calculated from XRP using locked price
4. **Authorization**: User grants permission during request (not during reservation)

---

## Question 6: ERC20 Liquidity in LP Registry

**Location in Plan**: Lines 270-318  
**Status**: ✅ **ANSWERED - Extension of Current Native Token Pattern**

### Current LP Registry Pattern

The current `LiquidityProviderRegistry` uses native FLR tokens (ETH-like). For minting, we need ERC20 support (FXRP tokens).

### Implementation Pattern

```solidity
// In LiquidityProviderRegistry.sol - Add ERC20 support
import "./interfaces/IERC20.sol";

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
) external {
    require(_token != address(0), "LiquidityProviderRegistry: invalid token");
    require(_amount > 0, "LiquidityProviderRegistry: invalid amount");
    require(_minHaircut <= 1000000, "LiquidityProviderRegistry: invalid haircut");
    require(_maxDelay > 0, "LiquidityProviderRegistry: invalid delay");
    
    // Transfer tokens from LP to registry
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    
    // Store the funds
    erc20Balances[msg.sender][_token] += _amount;
    
    LPPosition storage position = erc20Positions[msg.sender][_token];
    
    if (!position.active) {
        position.active = true;
        activeERC20LPs[_token].push(msg.sender);
    }
    
    position.lp = msg.sender;
    position.asset = _token;
    position.depositedAmount += _amount;
    position.availableAmount += _amount;
    position.minHaircut = _minHaircut;
    position.maxDelay = _maxDelay;
    
    emit ERC20LiquidityDeposited(msg.sender, _token, _amount, _minHaircut, _maxDelay);
}

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
) external onlyAuthorized returns (address lp, uint256 availableAmount) {
    // Same matching algorithm as native token, but for ERC20
    address[] memory lps = activeERC20LPs[_token];
    
    address bestLP = address(0);
    uint256 bestHaircut = type(uint256).max;
    
    for (uint256 i = 0; i < lps.length; i++) {
        LPPosition storage position = erc20Positions[lps[i]][_token];
        
        if (!position.active) continue;
        if (position.availableAmount < _amount) continue;
        if (position.minHaircut > _requestedHaircut) continue;
        
        // Prefer lower haircut (better UX)
        if (position.minHaircut < bestHaircut) {
            bestLP = lps[i];
            bestHaircut = position.minHaircut;
        }
    }
    
    if (bestLP == address(0)) {
        return (address(0), 0);
    }
    
    // Transfer matched amount to escrow
    LPPosition storage matchedPosition = erc20Positions[bestLP][_token];
    matchedPosition.availableAmount -= _amount;
    erc20Balances[bestLP][_token] -= _amount;
    
    // Transfer to EscrowVault (for minting escrow)
    IERC20(_token).transfer(escrowVault, _amount);
    
    return (bestLP, _amount);
}
```

### Key Differences from Native Token

1. **Transfer Pattern**: Uses `transferFrom` instead of `msg.value`
2. **Balance Tracking**: Separate `erc20Balances` mapping
3. **Position Tracking**: Separate `erc20Positions` mapping
4. **Matching Logic**: Same algorithm, different storage

---

## Question 7: Minting Escrow Structure

**Location in Plan**: Lines 320-376  
**Status**: ✅ **ANSWERED - Mirror of Redemption Escrow**

### Escrow Structure

Based on the current `EscrowVault` redemption escrow pattern:

```solidity
// In EscrowVault.sol
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
    Released,  // FDC success, LP claim recorded (will receive minted tokens)
    Failed,    // FDC failure, LP loses FXRP
    Timeout    // FDC timeout, LP refunded from minted tokens
}

mapping(uint256 => MintingEscrow) public mintingEscrows;
```

### Key Differences from Redemption Escrow

| Aspect | Redemption Escrow | Minting Escrow |
|--------|------------------|----------------|
| **Asset Held** | Native FLR (from LP or user) | ERC20 FXRP (from LP) |
| **User Receives** | XRP (via agent) | FXRP (from LP, instant) |
| **LP Provides** | Native FLR | ERC20 FXRP |
| **LP Repaid** | From escrow (FLR) | From minted tokens (FXRP) |
| **Failure Impact** | LP gets refund | LP loses FXRP (risk premium) |

---

## Question 8: Agent Service Updates for Minting

**Location in Plan**: Lines 705-708  
**Status**: ✅ **ANSWERED - Extension of Current Agent**

### Agent Event Monitoring

Based on `agent/event_monitor.go`:

```go
// Add new event type
type MintingRequestedEvent struct {
    MintingID              *big.Int
    User                   common.Address
    Asset                  common.Address
    CollateralReservationID *big.Int
    XRPLTxHash             string
    XRPAmount              *big.Int
    FXRPAmount              *big.Int
    Timestamp              *big.Int
}

// In agent/main.go - Add minting event subscription
func (a *Agent) monitorMintingEvents(ctx context.Context) error {
    // Subscribe to MintingRequested events
    query := ethereum.FilterQuery{
        Addresses: []common.Address{a.config.FLIPCoreAddress},
        Topics: [][]common.Hash{
            {crypto.Keccak256Hash([]byte("MintingRequested(uint256,address,address,uint256,string,uint256,uint256,uint256)"))},
        },
    }
    
    logs := make(chan types.Log)
    sub, err := a.client.SubscribeFilterLogs(ctx, query, logs)
    if err != nil {
        return err
    }
    
    for {
        select {
        case err := <-sub.Err():
            return err
        case log := <-logs:
            event := parseMintingRequestedEvent(log)
            if err := a.handleMintingRequested(ctx, event); err != nil {
                log.Error().Err(err).Msg("Failed to handle minting request")
            }
        }
    }
}
```

### FDC Submission for Minting

```go
// In agent/fdc_submitter.go - Add minting proof submission
func (f *FDCSubmitter) SubmitMintingProof(
    ctx context.Context,
    mintingID *big.Int,
    proof FDCProof,
) error {
    // Prepare transaction to call handleMintingFDCAttestation
    tx, err := f.flipCore.HandleMintingFDCAttestation(
        f.auth,
        mintingID,
        proof.RequestID,
        proof.Success,
    )
    if err != nil {
        return fmt.Errorf("failed to submit minting proof: %w", err)
    }
    
    // Wait for transaction confirmation
    receipt, err := bind.WaitMined(ctx, f.client, tx)
    if err != nil {
        return fmt.Errorf("failed to confirm transaction: %w", err)
    }
    
    if receipt.Status == 0 {
        return fmt.Errorf("transaction failed")
    }
    
    return nil
}
```

---

## Summary of Answers

| Question | Answer | Implementation Pattern |
|----------|--------|----------------------|
| **FAssets Integration** | Option B (FLIP executes on behalf) | User authorization + AssetManager.executeMinting() with LP as recipient |
| **FDC Integration** | Payment attestation type | Same as redemption, but verifies XRP payment to FAssets agent |
| **LP Repayment** | From minted tokens | AssetManager.executeMinting() mints directly to LP address |
| **User Authorization** | Explicit opt-in during requestMinting() | Boolean flag in MintingRequest struct |
| **Collateral Reservation** | Validate and use reservationId | Verify reservation belongs to user, use for minting execution |
| **ERC20 Liquidity** | Extension of current LP registry | Separate mappings for ERC20 balances and positions |
| **Minting Escrow** | Mirror of redemption escrow | Same structure, different asset type (ERC20 vs native) |
| **Agent Updates** | New event monitoring + FDC submission | Extend current agent with minting event handlers |

---

## Implementation Priority

Based on current state (85% complete for redemption):

1. **Phase 1** (High Priority): Contract updates
   - FLIPCore minting functions
   - LP Registry ERC20 support
   - EscrowVault minting escrow

2. **Phase 2** (Medium Priority): FDC integration
   - Agent minting event monitoring
   - FDC proof submission for minting

3. **Phase 3** (Medium Priority): Frontend updates
   - Mint page FLIP integration
   - Authorization UI

4. **Phase 4** (Low Priority): Testing
   - Unit tests for minting
   - Integration tests
   - E2E tests

---

**Last Updated**: January 2026  
**Status**: All open questions answered based on current implementation patterns

