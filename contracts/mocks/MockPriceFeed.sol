// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IChainlinkFeed} from "../interfaces/IChainlinkFeed.sol";

/// @notice Settable Chainlink-shaped feed for local tests and testnet demos.
/// Never deploy to mainnet — swap in a real Pyth/Chainlink/Chronicle feed there.
contract MockPriceFeed is IChainlinkFeed {
    int256 private _answer;
    uint256 private _updatedAt;
    uint8 private immutable _decimals;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
    }

    function setAnswer(int256 newAnswer) external {
        _answer = newAnswer;
        _updatedAt = block.timestamp;
    }

    function setStale(uint256 secondsAgo) external {
        _updatedAt = block.timestamp > secondsAgo ? block.timestamp - secondsAgo : 0;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }
}
