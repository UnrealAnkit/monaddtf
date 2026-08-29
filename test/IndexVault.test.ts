import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockERC20, MockPriceFeed, OracleRouter, MockSwapRouter, IndexVault } from "../typechain-types";

const BPS = 10_000n;
const ONE = ethers.parseEther("1");

async function deployFeed(price: number, decimals = 8) {
  const Feed = await ethers.getContractFactory("MockPriceFeed");
  return (await Feed.deploy(decimals, BigInt(price) * 10n ** BigInt(decimals))) as unknown as MockPriceFeed;
}

describe("IndexVault", () => {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let guardian: HardhatEthersSigner;

  let entryToken: MockERC20;
  let assetA: MockERC20; // 50%
  let assetB: MockERC20; // 30%
  let assetC: MockERC20; // 20%
  let oracleRouter: OracleRouter;
  let swapRouter: MockSwapRouter;
  let vault: IndexVault;

  beforeEach(async () => {
    [deployer, alice, guardian] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    entryToken = (await ERC20Factory.deploy("Entry", "ENTRY")) as unknown as MockERC20;
    assetA = (await ERC20Factory.deploy("Asset A", "AAA")) as unknown as MockERC20;
    assetB = (await ERC20Factory.deploy("Asset B", "BBB")) as unknown as MockERC20;
    assetC = (await ERC20Factory.deploy("Asset C", "CCC")) as unknown as MockERC20;

    const OracleRouterFactory = await ethers.getContractFactory("OracleRouter");
    oracleRouter = (await OracleRouterFactory.deploy(deployer.address)) as unknown as OracleRouter;

    // all priced at $1 for simple math, except assetB at $2 to exercise cross-asset value math
    const entryFeed = await deployFeed(1);
    const feedA = await deployFeed(1);
    const feedB = await deployFeed(2);
    const feedC = await deployFeed(1);

    await oracleRouter.setFeed(await entryToken.getAddress(), await entryFeed.getAddress(), 3600);
    await oracleRouter.setFeed(await assetA.getAddress(), await feedA.getAddress(), 3600);
    await oracleRouter.setFeed(await assetB.getAddress(), await feedB.getAddress(), 3600);
    await oracleRouter.setFeed(await assetC.getAddress(), await feedC.getAddress(), 3600);

    const SwapRouterFactory = await ethers.getContractFactory("MockSwapRouter");
    swapRouter = (await SwapRouterFactory.deploy(await oracleRouter.getAddress(), 0)) as unknown as MockSwapRouter;

    // fund the swap router with basket assets so it can pay out swaps
    for (const token of [assetA, assetB, assetC]) {
      await token.mint(await swapRouter.getAddress(), ethers.parseEther("1000000"));
    }

    const VaultFactory = await ethers.getContractFactory("IndexVault");
    vault = (await VaultFactory.deploy(
      "Test Index",
      "TIDX",
      [await assetA.getAddress(), await assetB.getAddress(), await assetC.getAddress()],
      [5_000, 3_000, 2_000],
      await entryToken.getAddress(),
      await swapRouter.getAddress(),
      await oracleRouter.getAddress(),
      guardian.address
    )) as unknown as IndexVault;

    await entryToken.mint(alice.address, ethers.parseEther("10000"));
    await entryToken.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("rejects a basket whose weights don't sum to 10000 bps", async () => {
    const VaultFactory = await ethers.getContractFactory("IndexVault");
    await expect(
      VaultFactory.deploy(
        "Bad",
        "BAD",
        [await assetA.getAddress(), await assetB.getAddress()],
        [5_000, 3_000], // sums to 8000, not 10000
        await entryToken.getAddress(),
        await swapRouter.getAddress(),
        await oracleRouter.getAddress(),
        guardian.address
      )
    ).to.be.revertedWithCustomError(VaultFactory, "WeightsMustSumToBps");
  });

  it("bootstraps first mint at 1 share = $1 of value added", async () => {
    const depositAmount = ethers.parseEther("100"); // $100 of entry token
    await vault.connect(alice).mint(depositAmount, 0);

    const shares = await vault.balanceOf(alice.address);
    // $100 in, all assets ~$1 (weighted avg), so shares should be very close to 100e18
    expect(shares).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("0.01"));
  });

  it("splits deposit across assets by target weight", async () => {
    const depositAmount = ethers.parseEther("1000");
    await vault.connect(alice).mint(depositAmount, 0);

    const balA = await assetA.balanceOf(await vault.getAddress());
    const balB = await assetB.balanceOf(await vault.getAddress());
    const balC = await assetC.balanceOf(await vault.getAddress());

    // assetA: 50% of $1000 = $500 @ $1 = 500 tokens
    expect(balA).to.be.closeTo(ethers.parseEther("500"), ethers.parseEther("0.01"));
    // assetB: 30% of $1000 = $300 @ $2 = 150 tokens
    expect(balB).to.be.closeTo(ethers.parseEther("150"), ethers.parseEther("0.01"));
    // assetC: 20% of $1000 = $200 @ $1 = 200 tokens
    expect(balC).to.be.closeTo(ethers.parseEther("200"), ethers.parseEther("0.01"));
  });

  it("mints proportionally to NAV on a second deposit", async () => {
    await vault.connect(alice).mint(ethers.parseEther("1000"), 0);
    const sharesAfterFirst = await vault.balanceOf(alice.address);

    await entryToken.mint(deployer.address, ethers.parseEther("1000"));
    await entryToken.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.mint(ethers.parseEther("1000"), 0); // deployer deposits same amount

    const deployerShares = await vault.balanceOf(deployer.address);
    // same USD value deposited into an unchanged-price vault -> ~same shares minted
    expect(deployerShares).to.be.closeTo(sharesAfterFirst, sharesAfterFirst / 1000n);
  });

  it("redeems pro-rata across every basket asset and burns shares", async () => {
    await vault.connect(alice).mint(ethers.parseEther("1000"), 0);
    const shares = await vault.balanceOf(alice.address);

    const half = shares / 2n;
    await vault.connect(alice).redeem(half);

    expect(await vault.balanceOf(alice.address)).to.equal(shares - half);

    const balA = await assetA.balanceOf(await vault.getAddress());
    // vault should retain ~half of what it held (250 of the original 500 assetA)
    expect(balA).to.be.closeTo(ethers.parseEther("250"), ethers.parseEther("0.5"));
  });

  it("never blocks redeem even while mint is paused", async () => {
    await vault.connect(alice).mint(ethers.parseEther("1000"), 0);
    const shares = await vault.balanceOf(alice.address);

    await vault.connect(guardian).pauseMint();
    await expect(vault.connect(alice).mint(ethers.parseEther("1"), 0)).to.be.revertedWithCustomError(
      vault,
      "MintIsPaused"
    );

    // redeem must still work while paused
    await expect(vault.connect(alice).redeem(shares)).to.not.be.reverted;
  });

  it("only the guardian can pause or unpause minting", async () => {
    await expect(vault.connect(alice).pauseMint()).to.be.revertedWithCustomError(vault, "NotGuardian");
  });

  it("rounds share issuance down, favoring the vault", async () => {
    await vault.connect(alice).mint(ethers.parseEther("1000"), 0);
    const nav = await vault.navPerShare();
    // NAV should be at or just above $1 (never below, since rounding favors the vault)
    expect(nav).to.be.gte(ONE - 10n);
  });
});
