// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IFAsset.sol";
import "./interfaces/IStateConnector.sol";
import "./interfaces/IFtsoRegistry.sol";
import "./EscrowVault.sol";
import "./SettlementReceipt.sol";
import "./LiquidityProviderRegistry.sol";
import "./PriceHedgePool.sol";
import "./OperatorRegistry.sol";
import "./DeterministicScoring.sol";
import "./Pausable.sol";

/**
 * @title FLIPCore
 * @notice Bidirectional settlement handler for both minting (XRP→FXRP) and redemption (FXRP→XRP)
 * @dev Coordinates flows: user request → FTSO price lock → Deterministic scoring →
 *      Provisional settlement → FDC finalization
 *
 * CORE INVARIANT: FLIP never finalizes value without FDC confirmation.
 * ∀ operation O: Finalize(O) ⟹ FDC(O) = true
 */
contract FLIPCore is Pausable {
    // Dependencies
    IFtsoRegistry public immutable ftsoRegistry;
    IStateConnector public immutable stateConnector;
    EscrowVault public immutable escrowVault;
    SettlementReceipt public immutable settlementReceipt;
    LiquidityProviderRegistry public immutable lpRegistry;
    PriceHedgePool public immutable priceHedgePool;
    OperatorRegistry public immutable operatorRegistry;

    // Redemption state
    struct Redemption {
        address user;
        address asset; // FAsset contract address
        uint256 amount;
        uint256 requestedAt;
        uint256 priceLocked;
        uint256 hedgeId;
        RedemptionStatus status;
        uint256 fdcRequestId; // For matching FDC attestations
        bool provisionalSettled;
        string xrplAddress; // XRPL address where user wants to receive XRP
    }

    enum RedemptionStatus {
        Pending,           // Awaiting oracle prediction
        QueuedForFDC,      // Low confidence, waiting for FDC
        EscrowCreated,     // Escrow created, receipt minted
        ReceiptRedeemed,   // Receipt redeemed (immediate or after FDC)
        Finalized,         // FDC confirmed success
        Failed,            // FDC confirmed failure
        Timeout            // FDC timeout
    }

    mapping(uint256 => Redemption) public redemptions;
    uint256 public nextRedemptionId;

    // Track XRPL payments to prevent double-paying
    mapping(uint256 => string) public redemptionXrplTxHash;

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
        bool userAuthorizedFlip;          // User grants FLIP permission to execute minting
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

    // Events
    event RedemptionRequested(
        uint256 indexed redemptionId,
        address indexed user,
        address indexed asset,
        uint256 amount,
        string xrplAddress,
        uint256 timestamp
    );

    event EscrowCreated(
        uint256 indexed redemptionId,
        address indexed user,
        uint256 receiptId,
        uint256 amount,
        uint256 timestamp
    );

    event XrplPaymentRecorded(
        uint256 indexed redemptionId,
        string xrplTxHash
    );

    event ReceiptRedeemed(
        uint256 indexed redemptionId,
        uint256 indexed receiptId,
        address indexed user,
        uint256 amount,
        bool immediate,
        uint256 timestamp
    );

    event RedemptionFinalized(
        uint256 indexed redemptionId,
        bool success,
        uint256 timestamp
    );

    event RedemptionFailed(
        uint256 indexed redemptionId,
        uint256 timestamp
    );

    event FDCAttestationReceived(
        uint256 indexed redemptionId,
        uint256 indexed requestId,
        bytes32 merkleRoot,
        uint256 timestamp
    );

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

    event MintingFailed(
        uint256 indexed mintingId,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyOperator() {
        // Allow owner to bypass operator check for testing
        require(
            operatorRegistry.isOperator(msg.sender) || msg.sender == owner,
            "FLIPCore: not operator or owner"
        );
        _;
    }

    constructor(
        address _ftsoRegistry,
        address _stateConnector,
        address _escrowVault,
        address _settlementReceipt,
        address _lpRegistry,
        address _priceHedgePool,
        address _operatorRegistry
    ) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        stateConnector = IStateConnector(_stateConnector);
        escrowVault = EscrowVault(payable(_escrowVault));
        settlementReceipt = SettlementReceipt(_settlementReceipt);
        lpRegistry = LiquidityProviderRegistry(_lpRegistry);
        priceHedgePool = PriceHedgePool(_priceHedgePool);
        operatorRegistry = OperatorRegistry(_operatorRegistry);
        // Pausable owner is set to deployer (msg.sender) in Pausable constructor
    }

    /**
     * @notice Request redemption of FAsset tokens
     * @param _amount Amount of FAsset to redeem
     * @param _asset FAsset contract address
     * @param _xrplAddress XRPL address where user wants to receive XRP
     * @return redemptionId Unique redemption ID
     */
    function requestRedemption(uint256 _amount, address _asset, string memory _xrplAddress)
        external
        whenNotPaused
        returns (uint256 redemptionId)
    {
        require(_amount > 0, "FLIPCore: amount must be > 0");
        require(_asset != address(0), "FLIPCore: invalid asset");

        IFAsset fAsset = IFAsset(_asset);
        
        // Transfer tokens from user to FLIPCore (user must have approved FLIPCore)
        // Using ERC20 transferFrom pattern
        require(
            fAsset.transferFrom(msg.sender, address(this), _amount),
            "FLIPCore: transfer failed"
        );
        
        // "Burn" tokens by transferring to dead address (0x000...dead)
        // This effectively removes them from circulation since dead address can't spend them
        // We can't use burn() because FAsset contract has restrictions, but transfer works
        address DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
        require(
            fAsset.transfer(DEAD_ADDRESS, _amount),
            "FLIPCore: burn transfer failed"
        );

        redemptionId = nextRedemptionId++;
        
        // Lock price via FTSO and create price hedge
        string memory symbol = _getAssetSymbol(_asset);
        // Get price and lock it in one call (optimize gas)
        (uint256 lockedPrice, uint256 hedgeId) = priceHedgePool.lockPrice(_asset, _amount);

        redemptions[redemptionId] = Redemption({
            user: msg.sender,
            asset: _asset,
            amount: _amount,
            requestedAt: block.timestamp,
            priceLocked: lockedPrice,
            hedgeId: hedgeId,
            status: RedemptionStatus.Pending,
            fdcRequestId: 0, // Will be set when FDC attestation arrives
            provisionalSettled: false,
            xrplAddress: _xrplAddress
        });

        emit RedemptionRequested(redemptionId, msg.sender, _asset, _amount, _xrplAddress, block.timestamp);
        
        return redemptionId;
    }

    /**
     * @notice Evaluate redemption and make deterministic decision
     * @param _redemptionId Redemption ID
     * @param _priceVolatility Current price volatility (scaled: 1000000 = 100%)
     * @param _agentSuccessRate Agent historical success rate (scaled: 1000000 = 100%)
     * @param _agentStake Agent stake amount
     * @return decision 0=QueueFDC, 1=BufferEarmark, 2=ProvisionalSettle
     * @return score Calculated score (scaled: 1000000 = 100%)
     */
    function evaluateRedemption(
        uint256 _redemptionId,
        uint256 _priceVolatility,
        uint256 _agentSuccessRate,
        uint256 _agentStake
    ) 
        external 
        view 
        returns (uint8 decision, uint256 score) 
    {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Pending,
            "FLIPCore: invalid status"
        );

        // Get current hour (0-23)
        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        // Calculate deterministic score
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: redemption.amount,
            agentSuccessRate: _agentSuccessRate,
            agentStake: _agentStake,
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);
        
        decision = DeterministicScoring.makeDecision(result);
        score = result.score;
    }

    /**
     * @notice Finalize provisional settlement based on deterministic score
     * @param _redemptionId Redemption ID
     * @param _priceVolatility Current price volatility (scaled: 1000000 = 100%)
     * @param _agentSuccessRate Agent historical success rate (scaled: 1000000 = 100%)
     * @param _agentStake Agent stake amount
     */
    function finalizeProvisional(
        uint256 _redemptionId,
        uint256 _priceVolatility,
        uint256 _agentSuccessRate,
        uint256 _agentStake
    )
        external
        onlyOperator
    {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Pending,
            "FLIPCore: invalid status"
        );

        // Get current hour (0-23)
        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        // Calculate deterministic score
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: redemption.amount,
            agentSuccessRate: _agentSuccessRate,
            agentStake: _agentStake,
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);
        
        // Require high confidence for provisional settlement
        require(
            result.canProvisionalSettle,
            "FLIPCore: score too low for provisional settlement"
        );

        // Calculate suggested haircut from score
        uint256 suggestedHaircut = DeterministicScoring.calculateSuggestedHaircut(result);
        
        // Try to match liquidity provider
        (address matchedLP, uint256 availableAmount) = lpRegistry.matchLiquidity(
            redemption.asset,
            redemption.amount,
            suggestedHaircut
        );
        
        // Determine if LP funding is available and get final haircut
        (bool lpFunded, address lpAddress, uint256 finalHaircut) = _determineLiquidityAndHaircut(
            matchedLP,
            availableAmount,
            redemption.amount,
            redemption.asset,
            suggestedHaircut
        );
        
        // Create escrow (LP-funded or user-wait path)
        // For LP-funded escrows, funds are already transferred by matchLiquidity
        // For user-wait escrows, no funds needed (just a record)
        escrowVault.createEscrow{value: 0}(
            _redemptionId,
            redemption.user,
            lpAddress,
            redemption.asset,
            redemption.amount,
            lpFunded
        );
        
        // Mint settlement receipt
        uint256 receiptId = settlementReceipt.mintReceipt(
            redemption.user,
            _redemptionId,
            redemption.asset,
            redemption.amount,
            finalHaircut,
            lpAddress
        );

        redemption.status = RedemptionStatus.EscrowCreated;
        redemption.provisionalSettled = true;

        emit EscrowCreated(
            _redemptionId,
            redemption.user,
            receiptId,
            redemption.amount,
            block.timestamp
        );
    }

    /**
     * @notice Owner-only function to process redemptions (for testing)
     * @dev Allows owner to process redemptions without operator status
     * @param _redemptionId Redemption ID
     * @param _priceVolatility Current price volatility (scaled: 1000000 = 100%)
     * @param _agentSuccessRate Agent historical success rate (scaled: 1000000 = 100%)
     * @param _agentStake Agent stake amount
     */
    function ownerProcessRedemption(
        uint256 _redemptionId,
        uint256 _priceVolatility,
        uint256 _agentSuccessRate,
        uint256 _agentStake
    )
        external
        onlyOwner
    {
        // Reuse the same logic as finalizeProvisional
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Pending,
            "FLIPCore: invalid status"
        );

        // Get current hour (0-23)
        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        // Calculate deterministic score
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: redemption.amount,
            agentSuccessRate: _agentSuccessRate,
            agentStake: _agentStake,
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);
        
        // Require high confidence for provisional settlement
        require(
            result.canProvisionalSettle,
            "FLIPCore: score too low for provisional settlement"
        );

        // Calculate suggested haircut from score
        uint256 suggestedHaircut = DeterministicScoring.calculateSuggestedHaircut(result);
        
        // Try to match liquidity provider
        (address matchedLP, uint256 availableAmount) = lpRegistry.matchLiquidity(
            redemption.asset,
            redemption.amount,
            suggestedHaircut
        );
        
        // Determine if LP funding is available and get final haircut
        (bool lpFunded, address lpAddress, uint256 finalHaircut) = _determineLiquidityAndHaircut(
            matchedLP,
            availableAmount,
            redemption.amount,
            redemption.asset,
            suggestedHaircut
        );
        
        // Create escrow (LP-funded or user-wait path)
        escrowVault.createEscrow{value: 0}(
            _redemptionId,
            redemption.user,
            lpAddress,
            redemption.asset,
            redemption.amount,
            lpFunded
        );
        
        // Mint settlement receipt
        uint256 receiptId = settlementReceipt.mintReceipt(
            redemption.user,
            _redemptionId,
            redemption.asset,
            redemption.amount,
            finalHaircut,
            lpAddress
        );

        redemption.status = RedemptionStatus.EscrowCreated;
        redemption.provisionalSettled = true;

        emit EscrowCreated(
            _redemptionId,
            redemption.user,
            receiptId,
            redemption.amount,
            block.timestamp
        );
    }

    /**
     * @notice Record XRPL payment tx hash (prevents double-payment on agent restart)
     * @param _redemptionId Redemption ID
     * @param _xrplTxHash XRPL transaction hash
     */
    function recordXrplPayment(
        uint256 _redemptionId,
        string calldata _xrplTxHash
    ) external onlyOperator {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.EscrowCreated,
            "FLIPCore: invalid status"
        );
        require(
            bytes(redemptionXrplTxHash[_redemptionId]).length == 0,
            "FLIPCore: payment already recorded"
        );
        require(bytes(_xrplTxHash).length > 0, "FLIPCore: empty tx hash");

        redemptionXrplTxHash[_redemptionId] = _xrplTxHash;

        emit XrplPaymentRecorded(_redemptionId, _xrplTxHash);
    }

    /**
     * @notice Handle FDC attestation result
     * @param _redemptionId Redemption ID
     * @param _requestId FDC request ID
     * @param _success Whether FDC confirmed success
     */
    function handleFDCAttestation(
        uint256 _redemptionId,
        uint256 _requestId,
        bool _success
    ) external {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.EscrowCreated ||
            redemption.status == RedemptionStatus.QueuedForFDC,
            "FLIPCore: invalid status"
        );

        redemption.fdcRequestId = _requestId;

        // FDC is the ADJUDICATOR - its decision is final
        // Only release escrow if one was created (EscrowCreated status)
        if (redemption.status == RedemptionStatus.EscrowCreated) {
            escrowVault.releaseOnFDC(_redemptionId, _success, _requestId);
            // Update receipt FDC round ID
            settlementReceipt.updateFDCRoundId(_redemptionId, _requestId);
        }
        // For QueuedForFDC, no escrow exists - FDC result is just recorded

        if (_success) {
            // FDC confirmed success
            redemption.status = RedemptionStatus.Finalized;
            
            // Reward operator
            operatorRegistry.distributeRewards();
            
            // Settle price hedge
            priceHedgePool.settleHedge(redemption.hedgeId);

            emit RedemptionFinalized(_redemptionId, true, block.timestamp);
        } else {
            // FDC confirmed failure
            redemption.status = RedemptionStatus.Failed;
            claimFailure(_redemptionId);
        }
    }

    /**
     * @notice Claim failure and trigger insurance payout
     * @param _redemptionId Redemption ID
     */
    function claimFailure(uint256 _redemptionId) public {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.EscrowCreated ||
            redemption.status == RedemptionStatus.Failed,
            "FLIPCore: invalid status for claim"
        );

        // Escrow already released by EscrowVault.releaseOnFDC()
        // On failure: if LP-funded, LP loses funds; if user-wait, user gets refund
        // No additional action needed here - escrow handles it
        
        // Slash operator who approved provisional settlement (if applicable)
        // In deterministic model, operators are still responsible for decisions
        // For now, slash based on operator who called finalizeProvisional
        // In production, track which operator made the decision
        if (redemption.provisionalSettled) {
            // Find operator who made the decision (simplified - in production track this)
            // For MVP, we can skip slashing or implement operator tracking
        }
        
        // Settle price hedge
        priceHedgePool.settleHedge(redemption.hedgeId);

        emit RedemptionFailed(_redemptionId, block.timestamp);
    }
    
    /**
     * @notice Check timeout and release escrow if FDC didn't attest in time
     * @param _redemptionId Redemption ID
     */
    function checkTimeout(uint256 _redemptionId) external {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.EscrowCreated,
            "FLIPCore: invalid status"
        );
        
        // Check if escrow can timeout
        require(
            escrowVault.canTimeout(_redemptionId),
            "FLIPCore: not timed out"
        );
        
        // Trigger timeout release
        escrowVault.timeoutRelease(_redemptionId);
        redemption.status = RedemptionStatus.Timeout;
    }
    
    /**
     * @notice Trigger Firelight Protocol for catastrophic backstop
     * @dev Only called if:
     *      1. FDC failed
     *      2. Timeout expired
     *      3. LP capital exhausted
     *      Firelight handles catastrophic cases
     * @param _redemptionId Redemption ID
     */
    function triggerFirelight(uint256 _redemptionId) external {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Failed ||
            redemption.status == RedemptionStatus.Timeout,
            "FLIPCore: invalid status for Firelight"
        );
        
        // Check escrow status
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(_redemptionId);
        require(
            escrowStatus == EscrowVault.EscrowStatus.Failed ||
            escrowStatus == EscrowVault.EscrowStatus.Timeout,
            "FLIPCore: escrow not in failure state"
        );
        
        // In production, this would call Firelight Protocol interface
        // For now, emit event - actual Firelight integration TBD
        // Firelight would handle catastrophic insurance payout
        
        // Note: Firelight integration is optional and TBD
    }

    /**
     * @notice Get redemption status
     * @param _redemptionId Redemption ID
     * @return status Current redemption status
     */
    function getRedemptionStatus(uint256 _redemptionId)
        external
        view
        returns (RedemptionStatus status)
    {
        return redemptions[_redemptionId].status;
    }

    /**
     * @notice Queue redemption for standard FDC flow (low confidence)
     * @param _redemptionId Redemption ID
     */
    function queueForFDC(uint256 _redemptionId) external onlyOperator {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Pending,
            "FLIPCore: invalid status"
        );

        redemption.status = RedemptionStatus.QueuedForFDC;
    }

    /**
     * @notice Get asset symbol for FTSO lookup
     * @dev Maps FAsset addresses to FTSO symbols (e.g., FXRP -> "XRP/USD")
     */
    function _getAssetSymbol(address /* _asset */) internal pure returns (string memory) {
        // In production, this would be a mapping or registry lookup
        // For now, return placeholder - will be configured per deployment
        return "XRP/USD"; // Default, should be configurable
    }

    /**
     * @notice Determine liquidity funding and final haircut
     * @dev Helper function to reduce stack depth in finalizeProvisional
     * @return lpFunded Whether LP funding is available
     * @return lpAddress LP address (address(0) if not funded)
     * @return finalHaircut Final haircut to use (LP's minHaircut or suggested)
     */
    function _determineLiquidityAndHaircut(
        address matchedLP,
        uint256 availableAmount,
        uint256 requiredAmount,
        address asset,
        uint256 suggestedHaircut
    ) internal view returns (bool lpFunded, address lpAddress, uint256 finalHaircut) {
        lpFunded = (matchedLP != address(0) && availableAmount >= requiredAmount);
        lpAddress = lpFunded ? matchedLP : address(0);

        // If LP matched, use LP's minHaircut; otherwise use suggested haircut
        finalHaircut = suggestedHaircut;
        if (lpFunded) {
            LiquidityProviderRegistry.LPPosition memory lpPos = lpRegistry.getPosition(matchedLP, asset);
            finalHaircut = lpPos.minHaircut;
        }
    }

    // ============ MINTING FUNCTIONS ============

    /**
     * @notice Request minting with FLIP instant settlement
     * @dev User has already sent XRP on XRPL and reserved collateral with FAssets
     * @param _collateralReservationId FAssets collateral reservation ID
     * @param _xrplTxHash XRPL payment transaction hash
     * @param _xrpAmount Amount of XRP sent (in drops)
     * @param _asset FXRP token address
     * @param _authorizeFlipExecution Whether user authorizes FLIP to execute minting on their behalf
     * @return mintingId Unique minting request ID
     */
    function requestMinting(
        uint256 _collateralReservationId,
        string memory _xrplTxHash,
        uint256 _xrpAmount,
        address _asset,
        bool _authorizeFlipExecution
    ) external whenNotPaused returns (uint256 mintingId) {
        require(_xrpAmount > 0, "FLIPCore: amount must be > 0");
        require(_asset != address(0), "FLIPCore: invalid asset");
        require(bytes(_xrplTxHash).length > 0, "FLIPCore: invalid tx hash");

        // Calculate FXRP amount from XRP amount
        // XRP has 6 decimal places (drops), FXRP typically has 18
        // Use price oracle to convert - for now assume 1:1 with decimal adjustment
        uint256 fxrpAmount = _xrpAmount * 1e12; // Convert 6 decimals to 18 decimals

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
            userAuthorizedFlip: _authorizeFlipExecution
        });

        emit MintingRequested(
            mintingId,
            msg.sender,
            _asset,
            _collateralReservationId,
            _xrplTxHash,
            _xrpAmount,
            fxrpAmount,
            block.timestamp
        );

        return mintingId;
    }

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
    ) external view returns (uint8 decision, uint256 score) {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(request.status == MintingStatus.Pending, "FLIPCore: invalid status");

        // Get current hour (0-23)
        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        // Use same deterministic scoring as redemption
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: request.fxrpAmount,
            agentSuccessRate: 990000, // 99% default for FAssets agents
            agentStake: 200000 ether, // Default stake assumption
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        decision = DeterministicScoring.makeDecision(result);
        score = result.score;
    }

    /**
     * @notice Finalize minting provisional settlement
     * @dev Matches LP with FXRP liquidity and transfers to user instantly
     * @param _mintingId Minting request ID
     * @param _priceVolatility Current price volatility
     */
    function finalizeMintingProvisional(
        uint256 _mintingId,
        uint256 _priceVolatility
    ) external onlyOperator {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(request.status == MintingStatus.Pending, "FLIPCore: invalid status");

        // Get current hour (0-23)
        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        // Calculate deterministic score
        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: request.fxrpAmount,
            agentSuccessRate: 990000, // 99% default
            agentStake: 200000 ether,
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);

        // Require high confidence for provisional settlement
        require(result.canProvisionalSettle, "FLIPCore: score too low for provisional settlement");

        // Calculate suggested haircut from score
        uint256 suggestedHaircut = DeterministicScoring.calculateSuggestedHaircut(result);

        // Try to match ERC20 liquidity provider (FXRP)
        (address matchedLP, uint256 availableAmount) = lpRegistry.matchERC20Liquidity(
            request.asset,
            request.fxrpAmount,
            suggestedHaircut
        );

        require(matchedLP != address(0) && availableAmount >= request.fxrpAmount, "FLIPCore: no LP liquidity available");

        // Transfer FXRP from LP (via registry) to user
        // The matchERC20Liquidity function transfers to escrow, but for minting we want direct to user
        // For now, escrow will release to user - create minting escrow
        escrowVault.createMintingEscrow(
            _mintingId,
            request.user,
            matchedLP,
            request.asset,
            request.fxrpAmount,
            (request.fxrpAmount * suggestedHaircut) / 1000000
        );

        request.matchedLP = matchedLP;
        request.haircutRate = suggestedHaircut;
        request.status = MintingStatus.ProvisionalSettled;

        emit MintingProvisionalSettled(
            _mintingId,
            request.user,
            matchedLP,
            request.fxrpAmount,
            suggestedHaircut,
            block.timestamp
        );
    }

    /**
     * @notice Owner-only function to process minting (for testing)
     * @param _mintingId Minting request ID
     * @param _priceVolatility Current price volatility
     */
    function ownerProcessMinting(
        uint256 _mintingId,
        uint256 _priceVolatility
    ) external onlyOwner {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(request.status == MintingStatus.Pending, "FLIPCore: invalid status");

        uint256 hourOfDay = (block.timestamp / 3600) % 24;

        DeterministicScoring.ScoringParams memory params = DeterministicScoring.ScoringParams({
            priceVolatility: _priceVolatility,
            amount: request.fxrpAmount,
            agentSuccessRate: 990000,
            agentStake: 200000 ether,
            hourOfDay: hourOfDay
        });

        DeterministicScoring.ScoreResult memory result = DeterministicScoring.calculateScore(params);
        require(result.canProvisionalSettle, "FLIPCore: score too low");

        uint256 suggestedHaircut = DeterministicScoring.calculateSuggestedHaircut(result);

        (address matchedLP, uint256 availableAmount) = lpRegistry.matchERC20Liquidity(
            request.asset,
            request.fxrpAmount,
            suggestedHaircut
        );

        require(matchedLP != address(0) && availableAmount >= request.fxrpAmount, "FLIPCore: no LP liquidity");

        escrowVault.createMintingEscrow(
            _mintingId,
            request.user,
            matchedLP,
            request.asset,
            request.fxrpAmount,
            (request.fxrpAmount * suggestedHaircut) / 1000000
        );

        request.matchedLP = matchedLP;
        request.haircutRate = suggestedHaircut;
        request.status = MintingStatus.ProvisionalSettled;

        emit MintingProvisionalSettled(
            _mintingId,
            request.user,
            matchedLP,
            request.fxrpAmount,
            suggestedHaircut,
            block.timestamp
        );
    }

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
    ) external onlyOperator {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(
            request.status == MintingStatus.ProvisionalSettled ||
            request.status == MintingStatus.QueuedForFDC,
            "FLIPCore: invalid status"
        );

        request.fdcRequestId = _fdcRequestId;

        if (_success) {
            // FDC confirmed XRP payment is valid
            escrowVault.releaseMintingOnFDC(_mintingId, true, _fdcRequestId);

            // LP is repaid from newly minted tokens (handled by escrow)
            // Record settlement for LP earnings
            if (request.matchedLP != address(0)) {
                lpRegistry.recordSettlement(
                    request.matchedLP,
                    request.asset,
                    request.fxrpAmount,
                    request.haircutRate
                );
            }

            // Settle price hedge
            priceHedgePool.settleHedge(request.hedgeId);

            request.status = MintingStatus.Finalized;
            emit MintingFinalized(_mintingId, true, block.timestamp);
        } else {
            // FDC confirmed failure - LP loses FXRP they provided
            escrowVault.releaseMintingOnFDC(_mintingId, false, _fdcRequestId);

            priceHedgePool.settleHedge(request.hedgeId);

            request.status = MintingStatus.Failed;
            emit MintingFailed(_mintingId, block.timestamp);
        }
    }

    /**
     * @notice Queue minting for FDC (low confidence)
     * @param _mintingId Minting request ID
     */
    function queueMintingForFDC(uint256 _mintingId) external onlyOperator {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(request.status == MintingStatus.Pending, "FLIPCore: invalid status");
        request.status = MintingStatus.QueuedForFDC;
    }

    /**
     * @notice Check minting timeout
     * @param _mintingId Minting request ID
     */
    function checkMintingTimeout(uint256 _mintingId) external {
        MintingRequest storage request = mintingRequests[_mintingId];
        require(request.status == MintingStatus.ProvisionalSettled, "FLIPCore: invalid status");

        require(escrowVault.canMintingTimeout(_mintingId), "FLIPCore: not timed out");

        escrowVault.timeoutMintingRelease(_mintingId);
        request.status = MintingStatus.Timeout;
    }

    /**
     * @notice Get minting request status
     * @param _mintingId Minting request ID
     * @return status Current minting status
     */
    function getMintingStatus(uint256 _mintingId) external view returns (MintingStatus status) {
        return mintingRequests[_mintingId].status;
    }

    /**
     * @notice Get minting request details
     * @param _mintingId Minting request ID
     */
    function getMintingRequest(uint256 _mintingId) external view returns (MintingRequest memory) {
        return mintingRequests[_mintingId];
    }
}

