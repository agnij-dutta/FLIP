// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBlazeSwapRouter
 * @notice UniswapV2-compatible router interface for BlazeSwap on Flare/Coston2
 * @dev BlazeSwap Router on Coston2: 0x8D29b61C41CF318d15d031BE2928F79630e068e6
 */
interface IBlazeSwapRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);

    function getAmountsIn(
        uint amountOut,
        address[] calldata path
    ) external view returns (uint[] memory amounts);

    function wNat() external view returns (address);
}
