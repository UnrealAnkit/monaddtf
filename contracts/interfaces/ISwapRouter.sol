// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Uniswap V2-compatible router surface — matches the router Uniswap and
/// most Monad-native DEXs (e.g. Kuru's AMM mode) expose, so the vault can target either.
interface ISwapRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
