// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgentVault
 * @notice Interface for FAssets Agent Vault contracts
 * @dev Agent vaults manage collateral and handle redemptions
 *      Used for monitoring agent performance and collateral health
 */
interface IAgentVault {
    /**
     * @notice Get the collateral ratio for an agent
     * @return _ratio Collateral ratio (scaled, e.g., 15000 = 150%)
     */
    function getCollateralRatio() external view returns (uint256 _ratio);

    /**
     * @notice Get the minimum collateral ratio required
     * @return _minRatio Minimum collateral ratio (scaled)
     */
    function getMinCollateralRatio() external view returns (uint256 _minRatio);

    /**
     * @notice Check if the agent vault is healthy (above minimum collateral)
     * @return _isHealthy True if collateral ratio is above minimum
     */
    function isHealthy() external view returns (bool _isHealthy);

    /**
     * @notice Emitted when collateral ratio changes
     * @param agent Agent address
     * @param newRatio New collateral ratio
     */
    event CollateralRatioUpdated(address indexed agent, uint256 newRatio);

    /**
     * @notice Emitted when liquidation occurs
     * @param agent Agent address
     * @param liquidatedAmount Amount liquidated
     */
    event Liquidation(address indexed agent, uint256 liquidatedAmount);
}



