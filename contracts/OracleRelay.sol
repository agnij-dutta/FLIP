// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OracleRelay
 * @notice Advisory-only oracle predictions for routing decisions
 * @dev Operators submit signed predictions; predictions are ADVISORY ONLY
 *      They determine fast-lane eligibility, queue ordering, and haircut sizing
 *      They do NOT directly unlock capital - FLIPCore makes final decisions
 */
contract OracleRelay {
    struct Prediction {
        address operator;
        uint256 redemptionId;
        uint256 score;              // Advisory score (scaled: 1000000 = 100%)
        uint256 suggestedHaircut;   // Suggested haircut (scaled: 1000000 = 100%)
        uint8 routingDecision;      // 0=QueueFDC, 1=FastLane
        uint256 timestamp;
        bytes signature;
    }

    mapping(uint256 => Prediction[]) public predictions; // redemptionId => predictions
    mapping(address => bool) public operators; // Authorized operators
    address public owner;

    event PredictionSubmitted(
        uint256 indexed redemptionId,
        address indexed operator,
        uint256 score,
        uint256 suggestedHaircut,
        uint8 routingDecision
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
     * @notice Submit an advisory prediction for a redemption
     * @dev Predictions are ADVISORY ONLY - they do not trigger capital allocation
     *      FLIPCore uses these for routing decisions, queue ordering, and haircut sizing
     * @param _redemptionId Redemption ID
     * @param _score Advisory score (scaled: 1000000 = 100%)
     * @param _suggestedHaircut Suggested haircut rate (scaled: 1000000 = 100%)
     * @param _routingDecision Routing decision: 0=QueueFDC, 1=FastLane
     * @param _signature Operator signature
     */
    function submitPrediction(
        uint256 _redemptionId,
        uint256 _score,
        uint256 _suggestedHaircut,
        uint8 _routingDecision,
        bytes calldata _signature
    ) external onlyOperator {
        require(_score <= 1000000, "OracleRelay: invalid score");
        require(_suggestedHaircut <= 1000000, "OracleRelay: invalid haircut");
        require(_routingDecision <= 1, "OracleRelay: invalid routing decision");

        // Verify signature (simplified - in production use EIP-712)
        bytes32 messageHash = keccak256(
            abi.encodePacked(_redemptionId, _score, _suggestedHaircut, _routingDecision, block.timestamp)
        );
        // Signature verification would happen here

        Prediction memory prediction = Prediction({
            operator: msg.sender,
            redemptionId: _redemptionId,
            score: _score,
            suggestedHaircut: _suggestedHaircut,
            routingDecision: _routingDecision,
            timestamp: block.timestamp,
            signature: _signature
        });

        predictions[_redemptionId].push(prediction);

        emit PredictionSubmitted(_redemptionId, msg.sender, _score, _suggestedHaircut, _routingDecision);
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
        // For now, return the most recent high-score prediction
        uint256 bestIdx = 0;
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].score > bestScore) {
                bestScore = preds[i].score;
                bestIdx = i;
            }
        }

        return preds[bestIdx];
    }
    
    /**
     * @notice Get all predictions for a redemption
     * @param _redemptionId Redemption ID
     * @return preds Array of predictions
     */
    function getPredictions(uint256 _redemptionId)
        external
        view
        returns (Prediction[] memory preds)
    {
        return predictions[_redemptionId];
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



