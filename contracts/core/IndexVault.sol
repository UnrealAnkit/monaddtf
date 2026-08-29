// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @title IndexVault
/// @notice One ERC20 share token backed by a fixed-weight basket of assets.
/// Deposit a single entry asset and it is split and swapped across the basket in
/// one transaction; shares are minted proportional to USD value added. Composition
/// and target weights are fixed at deployment — to change them, the factory deploys
/// a new vault rather than mutating this one, so redeemers always know exactly what
/// a share represents. Redemption always returns a pro-rata slice of every held
/// asset directly (no swap needed) and can never be paused; only new minting can be.
contract IndexVault is ERC20 {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 200; // 2% max tolerated swap slippage

    address[] public assets;
    uint256[] public targetWeightsBps;
    address public immutable entryAsset;
    ISwapRouter public immutable swapRouter;
    IPriceOracle public immutable oracleRouter;
    address public guardian;
    bool public mintPaused;

    event Minted(address indexed minter, uint256 amountIn, uint256 sharesOut, uint256 valueAddedUSD);
    event Redeemed(address indexed redeemer, uint256 sharesIn, uint256[] amountsOut);
    event MintPaused(address indexed by);
    event MintUnpaused(address indexed by);
    event GuardianUpdated(address indexed newGuardian);

    error WeightsMustSumToBps();
    error LengthMismatch();
    error ZeroAddress();
    error ZeroAmount();
    error MintIsPaused();
    error InsufficientShares();
    error SlippageExceeded();
    error NotGuardian();

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotGuardian();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address[] memory assets_,
        uint256[] memory targetWeightsBps_,
        address entryAsset_,
        address swapRouter_,
        address oracleRouter_,
        address guardian_
    ) ERC20(name_, symbol_) {
        if (assets_.length != targetWeightsBps_.length) revert LengthMismatch();
        if (entryAsset_ == address(0) || swapRouter_ == address(0) || oracleRouter_ == address(0) || guardian_ == address(0)) {
            revert ZeroAddress();
        }

        uint256 sum;
        for (uint256 i = 0; i < targetWeightsBps_.length; i++) {
            if (assets_[i] == address(0)) revert ZeroAddress();
            sum += targetWeightsBps_[i];
        }
        if (sum != BPS) revert WeightsMustSumToBps();

        assets = assets_;
        targetWeightsBps = targetWeightsBps_;
        entryAsset = entryAsset_;
        swapRouter = ISwapRouter(swapRouter_);
        oracleRouter = IPriceOracle(oracleRouter_);
        guardian = guardian_;
    }

    /// @notice Deposit `amountIn` of the entry asset; it is split by target weight and
    /// swapped into each basket asset, then shares are minted proportional to the USD
    /// value actually added. Reverts if the resulting shares are below `minSharesOut`.
    function mint(uint256 amountIn, uint256 minSharesOut) external returns (uint256 sharesOut) {
        if (mintPaused) revert MintIsPaused();
        if (amountIn == 0) revert ZeroAmount();

        IERC20(entryAsset).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 valueBeforeUSD = totalSupply() == 0 ? 0 : _totalValueUSD();
        uint256 valueAddedUSD = _splitAndSwap(amountIn);

        if (totalSupply() == 0) {
            sharesOut = valueAddedUSD;
        } else {
            sharesOut = (valueAddedUSD * totalSupply()) / valueBeforeUSD;
        }
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        _mint(msg.sender, sharesOut);
        emit Minted(msg.sender, amountIn, sharesOut, valueAddedUSD);
    }

    /// @notice Burn `shares` for a pro-rata slice of every basket asset. Never pausable.
    function redeem(uint256 shares) external returns (uint256[] memory amountsOut) {
        if (shares == 0) revert ZeroAmount();
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();

        uint256 supply = totalSupply();
        _burn(msg.sender, shares);

        amountsOut = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 bal = IERC20(assets[i]).balanceOf(address(this));
            uint256 amountOut = (bal * shares) / supply;
            amountsOut[i] = amountOut;
            if (amountOut > 0) {
                IERC20(assets[i]).safeTransfer(msg.sender, amountOut);
            }
        }
        emit Redeemed(msg.sender, shares, amountsOut);
    }

    /// @notice Current NAV per share in USD, scaled to 1e18. Zero supply returns zero.
    function navPerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (_totalValueUSD() * 1e18) / supply;
    }

    function totalValueUSD() external view returns (uint256) {
        return _totalValueUSD();
    }

    function basketLength() external view returns (uint256) {
        return assets.length;
    }

    function pauseMint() external onlyGuardian {
        mintPaused = true;
        emit MintPaused(msg.sender);
    }

    function unpauseMint() external onlyGuardian {
        mintPaused = false;
        emit MintUnpaused(msg.sender);
    }

    function setGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        guardian = newGuardian;
        emit GuardianUpdated(newGuardian);
    }

    function _splitAndSwap(uint256 amountIn) private returns (uint256 valueAddedUSD) {
        uint256 n = assets.length;
        uint256 allocated;

        for (uint256 i = 0; i < n; i++) {
            address asset = assets[i];
            // last asset absorbs rounding dust so the full amountIn is always allocated
            uint256 portionIn = (i == n - 1) ? (amountIn - allocated) : (amountIn * targetWeightsBps[i]) / BPS;
            allocated += portionIn;
            if (portionIn == 0) continue;

            uint256 receivedAmount;
            if (asset == entryAsset) {
                receivedAmount = portionIn;
            } else {
                receivedAmount = _swap(entryAsset, asset, portionIn);
            }

            (uint256 price, ) = oracleRouter.getPriceUSD(asset);
            uint8 decimals = IERC20Metadata(asset).decimals();
            valueAddedUSD += (receivedAmount * price) / (10 ** decimals);
        }
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn) private returns (uint256 amountOut) {
        (uint256 priceIn, ) = oracleRouter.getPriceUSD(tokenIn);
        (uint256 priceOut, ) = oracleRouter.getPriceUSD(tokenOut);
        uint8 decimalsIn = IERC20Metadata(tokenIn).decimals();
        uint8 decimalsOut = IERC20Metadata(tokenOut).decimals();

        uint256 expectedValueUSD = (amountIn * priceIn) / (10 ** decimalsIn);
        uint256 expectedOut = (expectedValueUSD * (10 ** decimalsOut)) / priceOut;
        uint256 minOut = (expectedOut * (BPS - MAX_SLIPPAGE_BPS)) / BPS;

        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts = swapRouter.swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            block.timestamp
        );
        amountOut = amounts[amounts.length - 1];
    }

    function _totalValueUSD() private view returns (uint256 total) {
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 bal = IERC20(assets[i]).balanceOf(address(this));
            if (bal == 0) continue;
            (uint256 price, ) = oracleRouter.getPriceUSD(assets[i]);
            uint8 decimals = IERC20Metadata(assets[i]).decimals();
            total += (bal * price) / (10 ** decimals);
        }
    }
}
