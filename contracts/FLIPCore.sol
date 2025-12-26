// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IFAsset.sol";
import "./interfaces/IStateConnector.sol";
import "./interfaces/IFtsoRegistry.sol";
import "./InsurancePool.sol";
import "./PriceHedgePool.sol";
import "./OperatorRegistry.sol";
import "./OracleRelay.sol";

/**
 * @title FLIPCore
 * @notice Main redemption handler with provisional settlement logic
 * @dev Coordinates redemption flow: user request → FTSO price lock → Oracle prediction → 
 *      Provisional settlement → FDC finalization
 */
contract FLIPCore {
    // Dependencies
    IFtsoRegistry public immutable ftsoRegistry;
    IStateConnector public immutable stateConnector;
    InsurancePool public immutable insurancePool;
    PriceHedgePool public immutable priceHedgePool;
    OperatorRegistry public immutable operatorRegistry;
    OracleRelay public immutable oracleRelay;

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
    }

    enum RedemptionStatus {
        Pending,           // Awaiting oracle prediction
        QueuedForFDC,      // Low confidence, waiting for FDC
        ProvisionallySettled, // High confidence, user paid
        Finalized,         // FDC confirmed success
        Failed,            // FDC confirmed failure
        InsuranceClaimed   // Failure with insurance payout
    }

    mapping(uint256 => Redemption) public redemptions;
    uint256 public nextRedemptionId;

    // Events
    event RedemptionRequested(
        uint256 indexed redemptionId,
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 timestamp
    );

    event ProvisionalSettlement(
        uint256 indexed redemptionId,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event RedemptionFinalized(
        uint256 indexed redemptionId,
        bool success,
        uint256 timestamp
    );

    event RedemptionFailed(
        uint256 indexed redemptionId,
        uint256 insurancePayout,
        uint256 timestamp
    );

    event FDCAttestationReceived(
        uint256 indexed redemptionId,
        uint256 indexed requestId,
        bytes32 merkleRoot,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyOperator() {
        require(operatorRegistry.isOperator(msg.sender), "FLIPCore: not operator");
        _;
    }

    constructor(
        address _ftsoRegistry,
        address _stateConnector,
        address _insurancePool,
        address _priceHedgePool,
        address _operatorRegistry,
        address _oracleRelay
    ) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        stateConnector = IStateConnector(_stateConnector);
        insurancePool = InsurancePool(_insurancePool);
        priceHedgePool = PriceHedgePool(_priceHedgePool);
        operatorRegistry = OperatorRegistry(_operatorRegistry);
        oracleRelay = OracleRelay(_oracleRelay);
    }

    /**
     * @notice Request redemption of FAsset tokens
     * @param _amount Amount of FAsset to redeem
     * @param _asset FAsset contract address
     * @return redemptionId Unique redemption ID
     */
    function requestRedemption(uint256 _amount, address _asset)
        external
        returns (uint256 redemptionId)
    {
        require(_amount > 0, "FLIPCore: amount must be > 0");
        require(_asset != address(0), "FLIPCore: invalid asset");

        IFAsset fAsset = IFAsset(_asset);
        
        // Burn FAsset tokens from user
        fAsset.burn(_amount);

        redemptionId = nextRedemptionId++;
        
        // Lock price via FTSO and create price hedge
        string memory symbol = _getAssetSymbol(_asset);
        (uint256 price, uint256 timestamp) = ftsoRegistry.getCurrentPriceWithDecimals(symbol);
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
            provisionalSettled: false
        });

        emit RedemptionRequested(redemptionId, msg.sender, _asset, _amount, block.timestamp);
        
        return redemptionId;
    }

    /**
     * @notice Finalize provisional settlement based on oracle prediction
     * @param _redemptionId Redemption ID
     * @param _oracleVerdict Oracle prediction data (from OracleRelay)
     */
    function finalizeProvisional(uint256 _redemptionId, bytes calldata _oracleVerdict)
        external
        onlyOperator
    {
        Redemption storage redemption = redemptions[_redemptionId];
        require(
            redemption.status == RedemptionStatus.Pending,
            "FLIPCore: invalid status"
        );

        // Verify oracle prediction
        OracleRelay.Prediction memory prediction = oracleRelay.getLatestPrediction(_redemptionId);
        require(prediction.confidenceLower >= 997000, "FLIPCore: confidence too low"); // 0.997 = 997000/1000000

        // Earmark insurance coverage
        insurancePool.earmarkCoverage(_redemptionId, redemption.amount);

        // Transfer provisional settlement to user
        // In production, this would transfer stablecoin/collateral
        // For now, we mark as provisionally settled
        redemption.status = RedemptionStatus.ProvisionallySettled;
        redemption.provisionalSettled = true;

        emit ProvisionalSettlement(
            _redemptionId,
            redemption.user,
            redemption.amount,
            block.timestamp
        );
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
            redemption.status == RedemptionStatus.ProvisionallySettled ||
            redemption.status == RedemptionStatus.QueuedForFDC,
            "FLIPCore: invalid status"
        );

        redemption.fdcRequestId = _requestId;

        if (_success) {
            // FDC confirmed success
            redemption.status = RedemptionStatus.Finalized;
            insurancePool.releaseCoverage(_redemptionId);
            
            // Reward operator
            operatorRegistry.distributeRewards();
            
            // Settle price hedge
            priceHedgePool.settleHedge(redemption.hedgeId);

            emit RedemptionFinalized(_redemptionId, true, block.timestamp);
        } else {
            // FDC confirmed failure - trigger insurance payout
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
            redemption.status == RedemptionStatus.ProvisionallySettled ||
            redemption.status == RedemptionStatus.Failed,
            "FLIPCore: invalid status for claim"
        );

        redemption.status = RedemptionStatus.InsuranceClaimed;
        
        // Insurance pool pays out (user already received funds)
        uint256 payout = insurancePool.claimFailure(_redemptionId, redemption.amount);
        
        // Slash operator who made incorrect prediction
        address operator = oracleRelay.getLatestPrediction(_redemptionId).operator;
        operatorRegistry.slashOperator(operator, redemption.amount);
        
        // Settle price hedge
        priceHedgePool.settleHedge(redemption.hedgeId);

        emit RedemptionFailed(_redemptionId, payout, block.timestamp);
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
    function _getAssetSymbol(address _asset) internal pure returns (string memory) {
        // In production, this would be a mapping or registry lookup
        // For now, return placeholder - will be configured per deployment
        return "XRP/USD"; // Default, should be configurable
    }
}

