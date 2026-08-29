// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal oracle interface used by the vault for NAV display and swap-slippage bounds.
interface IPriceOracle {
    /// @return price USD price of one whole unit of `asset`, scaled to 1e18
    /// @return updatedAt unix timestamp the price was last refreshed
    function getPriceUSD(address asset) external view returns (uint256 price, uint256 updatedAt);
}
