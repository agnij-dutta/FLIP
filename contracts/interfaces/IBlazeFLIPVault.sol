// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBlazeFLIPVault
 * @notice Interface for the BlazeSwap-FLIP liquidity backstop vault
 * @dev Called by LiquidityProviderRegistry when no direct LP matches
 */
interface IBlazeFLIPVault {
    /// @notice Provide just-in-time native token liquidity for a redemption backstop
    /// @param _asset Asset being redeemed
    /// @param _amount FLR amount needed
    /// @param _requestedHaircut Haircut offered (scaled: 1000000 = 100%)
    /// @return success Whether backstop could fulfill the request
    /// @return providedAmount Amount actually provided
    function provideBackstopLiquidity(
        address _asset,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external returns (bool success, uint256 providedAmount);

    /// @notice Provide just-in-time ERC20 liquidity for minting via BlazeSwap JIT swap
    /// @param _token ERC20 token address (e.g. FXRP)
    /// @param _amount Amount of token needed
    /// @param _requestedHaircut Haircut offered (scaled: 1000000 = 100%)
    /// @return success Whether backstop could fulfill the request
    /// @return providedAmount Amount actually provided
    function provideBackstopERC20Liquidity(
        address _token,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external returns (bool success, uint256 providedAmount);

    /// @notice Record haircut earnings from a successful settlement
    /// @param _amount Haircut fee earned (in native token)
    function recordHaircutEarnings(uint256 _amount) external payable;
}
