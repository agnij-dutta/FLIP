// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OperatorRegistry
 * @notice Operator management with staking, slashing, and rewards
 * @dev Operators stake collateral and earn fees; face slashing on mispredictions
 */
contract OperatorRegistry {
    struct Operator {
        uint256 stake;
        uint256 totalPredictions;
        uint256 routingErrors;      // Incorrect routing decisions (FastLane when should QueueFDC)
        uint256 haircutErrors;       // Haircut too low (caused LP loss)
        uint256 rewards;
        bool active;
    }

    mapping(address => Operator) public operators;
    address[] public operatorList;
    uint256 public minStake;
    uint256 public totalStaked;
    address public owner;

    // Slashing parameters
    uint256 public constant SLASH_THRESHOLD_MISS_RATE = 10000; // 1% = 10000/1000000
    uint256 public constant SLASH_PENALTY_PERCENT = 200000; // 20% = 200000/1000000

    event OperatorStaked(address indexed operator, uint256 amount);
    event OperatorSlashed(address indexed operator, uint256 amount, string reason);
    event RewardsDistributed(address indexed operator, uint256 amount);
    event OperatorRegistered(address indexed operator);

    modifier onlyOwner() {
        require(msg.sender == owner, "OperatorRegistry: not owner");
        _;
    }

    constructor(uint256 _minStake) {
        owner = msg.sender;
        minStake = _minStake;
    }

    /**
     * @notice Register as operator and stake collateral
     * @param _amount Amount to stake
     */
    function stake(uint256 _amount) external payable {
        require(_amount >= minStake, "OperatorRegistry: stake below minimum");
        require(msg.value >= _amount, "OperatorRegistry: insufficient payment");

        if (!operators[msg.sender].active) {
            operators[msg.sender].active = true;
            operatorList.push(msg.sender);
            emit OperatorRegistered(msg.sender);
        }

        operators[msg.sender].stake += _amount;
        totalStaked += _amount;

        emit OperatorStaked(msg.sender, _amount);
    }

    /**
     * @notice Slash operator stake for routing or haircut errors
     * @dev Slashing only occurs for:
     *      - Routing errors: Operator recommended FastLane when should QueueFDC (caused incorrect routing)
     *      - Haircut errors: Operator suggested haircut too low (caused LP loss)
     *      Predictions are advisory - slashing is NOT for "incorrect predictions"
     * @param _operator Operator address
     * @param _amount Amount to slash
     * @param _reason Reason for slashing: "routing_error" or "haircut_error"
     */
    function slashOperator(
        address _operator,
        uint256 _amount,
        string memory _reason
    ) external {
        require(
            msg.sender == address(this) || msg.sender == owner,
            "OperatorRegistry: unauthorized"
        );
        require(operators[_operator].active, "OperatorRegistry: operator not active");
        require(
            keccak256(bytes(_reason)) == keccak256(bytes("routing_error")) ||
            keccak256(bytes(_reason)) == keccak256(bytes("haircut_error")),
            "OperatorRegistry: invalid reason"
        );

        uint256 availableStake = operators[_operator].stake;
        uint256 slashAmount = _amount > availableStake ? availableStake : _amount;

        operators[_operator].stake -= slashAmount;
        totalStaked -= slashAmount;

        // Track error type
        if (keccak256(bytes(_reason)) == keccak256(bytes("routing_error"))) {
            operators[_operator].routingErrors++;
        } else {
            operators[_operator].haircutErrors++;
        }

        // Check if error rate exceeds threshold (1% of predictions)
        uint256 totalErrors = operators[_operator].routingErrors + operators[_operator].haircutErrors;
        uint256 errorRate = (totalErrors * 1000000) / (operators[_operator].totalPredictions + 1);
        
        if (errorRate > SLASH_THRESHOLD_MISS_RATE) {
            // Additional 20% penalty
            uint256 penalty = (operators[_operator].stake * SLASH_PENALTY_PERCENT) / 1000000;
            if (penalty > 0 && penalty <= operators[_operator].stake) {
                operators[_operator].stake -= penalty;
                totalStaked -= penalty;
                slashAmount += penalty;
            }
        }

        emit OperatorSlashed(_operator, slashAmount, _reason);
    }

    /**
     * @notice Distribute rewards to operators
     */
    function distributeRewards() external {
        // In production, this would calculate and distribute fees
        // For now, it's a placeholder that can be called after successful predictions
    }

    /**
     * @notice Get operator statistics
     * @param _operator Operator address
     * @return operatorStake Current stake amount
     * @return routingErrors Number of routing errors
     * @return haircutErrors Number of haircut errors
     * @return errorRate Error rate (scaled: 1000000 = 100%)
     * @return rewards Accumulated rewards
     */
    function getOperatorStats(address _operator)
        external
        view
        returns (
            uint256 operatorStake,
            uint256 routingErrors,
            uint256 haircutErrors,
            uint256 errorRate,
            uint256 rewards
        )
    {
        Operator memory op = operators[_operator];
        operatorStake = op.stake;
        routingErrors = op.routingErrors;
        haircutErrors = op.haircutErrors;
        errorRate = op.totalPredictions > 0
            ? ((op.routingErrors + op.haircutErrors) * 1000000) / op.totalPredictions
            : 0;
        rewards = op.rewards;
    }

    /**
     * @notice Check if address is an active operator
     * @param _operator Operator address
     * @return True if active operator
     */
    function isOperator(address _operator) external view returns (bool) {
        return operators[_operator].active && operators[_operator].stake >= minStake;
    }

    /**
     * @notice Record a prediction (called by OracleRelay)
     * @param _operator Operator address
     */
    function recordPrediction(address _operator) external {
        operators[_operator].totalPredictions++;
    }
}

