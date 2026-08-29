// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndexVault} from "./IndexVault.sol";

/// @notice Deploys new IndexVault instances and keeps a registry of them. Baskets are
/// immutable once created, so a new strategy or reweighting ships as a new vault here
/// rather than a change to an existing one — existing holders' basket never shifts
/// under them.
contract IndexFactory {
    address[] public allVaults;

    event IndexCreated(
        address indexed vault,
        string name,
        string symbol,
        address[] assets,
        uint256[] targetWeightsBps,
        address entryAsset
    );

    function createIndex(
        string memory name,
        string memory symbol,
        address[] memory assets,
        uint256[] memory targetWeightsBps,
        address entryAsset,
        address swapRouter,
        address oracleRouter,
        address guardian
    ) external returns (address vault) {
        vault = address(
            new IndexVault(name, symbol, assets, targetWeightsBps, entryAsset, swapRouter, oracleRouter, guardian)
        );
        allVaults.push(vault);
        emit IndexCreated(vault, name, symbol, assets, targetWeightsBps, entryAsset);
    }

    function vaultsCount() external view returns (uint256) {
        return allVaults.length;
    }

    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }
}
