// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OracleRelay
 * @notice On-chain interface for oracle predictions with aggregation
 * @dev Operators submit signed predictions; contract aggregates and verifies
 */
contract OracleRelay {
    struct Prediction {
        address operator;
        uint256 redemptionId;
        uint256 probability; // Scaled: 1000000 = 100%
        uint256 confidenceLower; // Lower bound of confidence interval (scaled)
        uint256 confidenceUpper; // Upper bound of confidence interval (scaled)
        uint256 timestamp;
        bytes signature;
    }

    mapping(uint256 => Prediction[]) public predictions; // redemptionId => predictions
    mapping(address => bool) public operators; // Authorized operators
    address public owner;

    event PredictionSubmitted(
        uint256 indexed redemptionId,
        address indexed operator,
        uint256 probability,
        uint256 confidenceLower
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "OracleRelay: not owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], "OracleRelay: not operator");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Submit a prediction for a redemption
     * @param _redemptionId Redemption ID
     * @param _probability Success probability (scaled: 1000000 = 100%)
     * @param _confidenceLower Lower confidence bound (scaled)
     * @param _confidenceUpper Upper confidence bound (scaled)
     * @param _signature Operator signature
     */
    function submitPrediction(
        uint256 _redemptionId,
        uint256 _probability,
        uint256 _confidenceLower,
        uint256 _confidenceUpper,
        bytes calldata _signature
    ) external onlyOperator {
        require(_probability <= 1000000, "OracleRelay: invalid probability");
        require(_confidenceLower <= _confidenceUpper, "OracleRelay: invalid confidence");
        require(_confidenceLower <= _probability && _probability <= _confidenceUpper, "OracleRelay: probability out of bounds");

        // Verify signature (simplified - in production use EIP-712)
        bytes32 messageHash = keccak256(
            abi.encodePacked(_redemptionId, _probability, _confidenceLower, _confidenceUpper, block.timestamp)
        );
        // Signature verification would happen here

        Prediction memory prediction = Prediction({
            operator: msg.sender,
            redemptionId: _redemptionId,
            probability: _probability,
            confidenceLower: _confidenceLower,
            confidenceUpper: _confidenceUpper,
            timestamp: block.timestamp,
            signature: _signature
        });

        predictions[_redemptionId].push(prediction);

        emit PredictionSubmitted(_redemptionId, msg.sender, _probability, _confidenceLower);
    }

    /**
     * @notice Get latest prediction for a redemption (aggregated from multiple operators)
     * @param _redemptionId Redemption ID
     * @return prediction Aggregated prediction
     */
    function getLatestPrediction(uint256 _redemptionId)
        external
        view
        returns (Prediction memory prediction)
    {
        Prediction[] memory preds = predictions[_redemptionId];
        require(preds.length > 0, "OracleRelay: no predictions");

        // Aggregate: use weighted average or median
        // For now, return the most recent high-confidence prediction
        uint256 bestIdx = 0;
        uint256 bestConfidence = 0;
        
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].confidenceLower > bestConfidence) {
                bestConfidence = preds[i].confidenceLower;
                bestIdx = i;
            }
        }

        return preds[bestIdx];
    }

    /**
     * @notice Add operator
     * @param _operator Operator address
     */
    function addOperator(address _operator) external onlyOwner {
        operators[_operator] = true;
    }

    /**
     * @notice Remove operator
     * @param _operator Operator address
     */
    function removeOperator(address _operator) external onlyOwner {
        operators[_operator] = false;
    }
}



