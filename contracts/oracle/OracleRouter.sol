// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {IChainlinkFeed} from "../interfaces/IChainlinkFeed.sol";

/// @notice Routes each basket asset to its own Chainlink-compatible feed (Pyth,
/// Chainlink, Chronicle, Supra and Switchboard all expose this interface on Monad),
/// normalizes to 1e18 USD, and rejects stale answers.
contract OracleRouter is IPriceOracle, Ownable {
    struct FeedConfig {
        address feed;
        uint256 maxStaleness; // seconds
    }

    mapping(address => FeedConfig) public feeds;

    event FeedSet(address indexed asset, address indexed feed, uint256 maxStaleness);

    error FeedNotSet(address asset);
    error StalePrice(address asset, uint256 updatedAt, uint256 maxStaleness);
    error InvalidPrice(address asset, int256 answer);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setFeed(address asset, address feed, uint256 maxStaleness) external onlyOwner {
        feeds[asset] = FeedConfig({feed: feed, maxStaleness: maxStaleness});
        emit FeedSet(asset, feed, maxStaleness);
    }

    function getPriceUSD(address asset) external view returns (uint256 price, uint256 updatedAt) {
        FeedConfig memory cfg = feeds[asset];
        if (cfg.feed == address(0)) revert FeedNotSet(asset);

        (, int256 answer, , uint256 lastUpdated, ) = IChainlinkFeed(cfg.feed).latestRoundData();
        if (answer <= 0) revert InvalidPrice(asset, answer);
        if (block.timestamp - lastUpdated > cfg.maxStaleness) {
            revert StalePrice(asset, lastUpdated, cfg.maxStaleness);
        }

        uint8 feedDecimals = IChainlinkFeed(cfg.feed).decimals();
        price = uint256(answer) * 10 ** (18 - feedDecimals);
        updatedAt = lastUpdated;
    }
}
