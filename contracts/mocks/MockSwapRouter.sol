// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Deterministic oracle-priced swap stand-in for local tests, since a real
/// AMM pool's output depends on live liquidity. Swap in Uniswap's or Kuru's real
/// router address for testnet/mainnet deployment.
// NOTE: pricing math below assumes both tokens use 18 decimals, which holds for
// every MockERC20 in this repo. Only used for local tests, never for deployment.
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    IPriceOracle public immutable oracle;
    uint256 public feeBps; // e.g. 30 = 0.3%, simulates AMM fee/slippage

    constructor(IPriceOracle oracle_, uint256 feeBps_) {
        oracle = oracle_;
        feeBps = feeBps_;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(path.length == 2, "MockSwapRouter: path must be [tokenIn, tokenOut]");
        address tokenIn = path[0];
        address tokenOut = path[1];

        (uint256 priceIn, ) = oracle.getPriceUSD(tokenIn);
        (uint256 priceOut, ) = oracle.getPriceUSD(tokenOut);

        uint256 valueUSD = amountIn * priceIn;
        uint256 amountOut = (valueUSD / priceOut) * (10_000 - feeBps) / 10_000;
        require(amountOut >= amountOutMin, "MockSwapRouter: slippage");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}
