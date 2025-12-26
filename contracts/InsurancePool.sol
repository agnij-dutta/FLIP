// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InsurancePool
 * @notice Settlement Guarantee Pool (SGP) with auto-pause logic
 * @dev Capital pool that underwrites failed redemptions
 */
contract InsurancePool {
    uint256 public poolBalance;
    uint256 public totalEarmarked; // Coverage currently earmarked
    uint256 public monthlyLiabilityEstimate; // Estimated worst-case monthly liability
    uint256 public constant PAUSE_THRESHOLD_MULTIPLIER = 3; // Pause if pool < 3× monthly liability
    bool public paused;
    
    address public owner;
    mapping(uint256 => uint256) public earmarkedCoverage; // redemptionId => amount

    event CoverageEarmarked(uint256 indexed redemptionId, uint256 amount);
    event CoverageReleased(uint256 indexed redemptionId);
    event ClaimPaid(uint256 indexed redemptionId, uint256 amount);
    event PoolReplenished(uint256 amount);
    event PoolPaused();
    event PoolUnpaused();

    modifier onlyOwner() {
        require(msg.sender == owner, "InsurancePool: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "InsurancePool: paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Earmark coverage for a redemption
     * @param _redemptionId Redemption ID
     * @param _amount Amount to earmark
     */
    function earmarkCoverage(uint256 _redemptionId, uint256 _amount) external whenNotPaused {
        require(_amount > 0, "InsurancePool: invalid amount");
        require(poolBalance >= totalEarmarked + _amount, "InsurancePool: insufficient pool");

        earmarkedCoverage[_redemptionId] = _amount;
        totalEarmarked += _amount;

        _checkPauseCondition();

        emit CoverageEarmarked(_redemptionId, _amount);
    }

    /**
     * @notice Release earmarked coverage (redemption succeeded)
     * @param _redemptionId Redemption ID
     */
    function releaseCoverage(uint256 _redemptionId) external {
        uint256 amount = earmarkedCoverage[_redemptionId];
        require(amount > 0, "InsurancePool: no coverage to release");

        earmarkedCoverage[_redemptionId] = 0;
        totalEarmarked -= amount;

        emit CoverageReleased(_redemptionId);
    }

    /**
     * @notice Claim failure and pay out insurance
     * @param _redemptionId Redemption ID
     * @param _amount Amount to pay out
     * @return payout Actual payout amount
     */
    function claimFailure(uint256 _redemptionId, uint256 _amount)
        external
        returns (uint256 payout)
    {
        uint256 earmarked = earmarkedCoverage[_redemptionId];
        require(earmarked > 0, "InsurancePool: no coverage earmarked");

        // Release earmark and pay from pool
        earmarkedCoverage[_redemptionId] = 0;
        totalEarmarked -= earmarked;

        payout = _amount <= poolBalance ? _amount : poolBalance;
        poolBalance -= payout;

        _checkPauseCondition();

        emit ClaimPaid(_redemptionId, payout);
        return payout;
    }

    /**
     * @notice Replenish pool with capital
     */
    function replenishPool() external payable {
        require(msg.value > 0, "InsurancePool: invalid amount");
        poolBalance += msg.value;
        emit PoolReplenished(msg.value);
        
        // Unpause if conditions met
        if (paused && poolBalance >= monthlyLiabilityEstimate * PAUSE_THRESHOLD_MULTIPLIER) {
            paused = false;
            emit PoolUnpaused();
        }
    }

    /**
     * @notice Get pool utilization ratio
     * @return utilization Utilization (scaled: 1000000 = 100%)
     */
    function getPoolUtilization() external view returns (uint256 utilization) {
        if (poolBalance == 0) return 0;
        return (totalEarmarked * 1000000) / poolBalance;
    }

    /**
     * @notice Get current pool balance
     * @return balance Pool balance
     */
    function getPoolBalance() external view returns (uint256 balance) {
        return poolBalance;
    }

    /**
     * @notice Set monthly liability estimate
     * @param _estimate Estimated worst-case monthly liability
     */
    function setMonthlyLiabilityEstimate(uint256 _estimate) external onlyOwner {
        monthlyLiabilityEstimate = _estimate;
        _checkPauseCondition();
    }

    /**
     * @notice Check pause condition and pause if needed
     */
    function _checkPauseCondition() internal {
        uint256 threshold = monthlyLiabilityEstimate * PAUSE_THRESHOLD_MULTIPLIER;
        if (!paused && poolBalance < threshold) {
            paused = true;
            emit PoolPaused();
        }
    }

    /**
     * @notice Manual pause (owner only)
     */
    function pause() external onlyOwner {
        paused = true;
        emit PoolPaused();
    }

    /**
     * @notice Manual unpause (owner only)
     */
    function unpause() external onlyOwner {
        require(
            poolBalance >= monthlyLiabilityEstimate * PAUSE_THRESHOLD_MULTIPLIER,
            "InsurancePool: insufficient balance to unpause"
        );
        paused = false;
        emit PoolUnpaused();
    }
}



