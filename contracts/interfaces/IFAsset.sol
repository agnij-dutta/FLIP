// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFAsset
 * @notice Interface for FAssets (FXRP, FBTC, FDOGE, etc.)
 * @dev FAssets are over-collateralized ERC-20 representations of native assets
 *      Redemptions require agent processing and FDC attestation
 */
interface IFAsset {
    /**
     * @notice Request redemption of FAsset tokens
     * @param _amount Amount of FAsset to redeem
     * @return _redemptionId Unique redemption request ID
     */
    function requestRedemption(uint256 _amount) external returns (uint256 _redemptionId);

    /**
     * @notice Get redemption details
     * @param _redemptionId The redemption ID to query
     * @return _agent Address of the agent handling the redemption
     * @return _amount Amount being redeemed
     * @return _startTime Timestamp when redemption was requested
     */
    function getRedemption(uint256 _redemptionId)
        external
        view
        returns (address _agent, uint256 _amount, uint256 _startTime);

    /**
     * @notice Burn FAsset tokens (typically called during redemption)
     * @param _amount Amount to burn
     */
    function burn(uint256 _amount) external;

    /**
     * @notice Emitted when a redemption is requested
     * @param user Address requesting redemption
     * @param amount Amount being redeemed
     * @param redemptionId Unique redemption ID
     */
    event RedemptionRequested(address indexed user, uint256 amount, uint256 indexed redemptionId);

    /**
     * @notice Emitted when a redemption is completed
     * @param user Address that requested redemption
     * @param amount Amount that was redeemed
     * @param redemptionId Unique redemption ID
     */
    event RedemptionCompleted(address indexed user, uint256 amount, uint256 indexed redemptionId);

    /**
     * @notice Emitted when a redemption fails
     * @param user Address that requested redemption
     * @param amount Amount that failed to redeem
     * @param redemptionId Unique redemption ID
     */
    event RedemptionFailed(address indexed user, uint256 amount, uint256 indexed redemptionId);
}



