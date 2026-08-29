import { expect } from "chai";
import { ethers } from "hardhat";
import { IndexFactory, MockERC20, OracleRouter, MockSwapRouter, MockPriceFeed } from "../typechain-types";

describe("IndexFactory", () => {
  it("deploys a new IndexVault and records it in the registry", async () => {
    const [deployer, guardian] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const entry = (await ERC20Factory.deploy("Entry", "ENTRY")) as unknown as MockERC20;
    const assetA = (await ERC20Factory.deploy("A", "A")) as unknown as MockERC20;

    const OracleRouterFactory = await ethers.getContractFactory("OracleRouter");
    const oracle = (await OracleRouterFactory.deploy(deployer.address)) as unknown as OracleRouter;

    const FeedFactory = await ethers.getContractFactory("MockPriceFeed");
    const feed = (await FeedFactory.deploy(8, 1_00000000n)) as unknown as MockPriceFeed;
    await oracle.setFeed(await entry.getAddress(), await feed.getAddress(), 3600);
    await oracle.setFeed(await assetA.getAddress(), await feed.getAddress(), 3600);

    const SwapRouterFactory = await ethers.getContractFactory("MockSwapRouter");
    const swapRouter = (await SwapRouterFactory.deploy(await oracle.getAddress(), 0)) as unknown as MockSwapRouter;

    const FactoryFactory = await ethers.getContractFactory("IndexFactory");
    const factory = (await FactoryFactory.deploy()) as unknown as IndexFactory;

    expect(await factory.vaultsCount()).to.equal(0);

    const tx = await factory.createIndex(
      "Single Asset Index",
      "SAI",
      [await assetA.getAddress()],
      [10_000],
      await entry.getAddress(),
      await swapRouter.getAddress(),
      await oracle.getAddress(),
      guardian.address
    );
    await tx.wait();

    expect(await factory.vaultsCount()).to.equal(1);
    const vaults = await factory.getAllVaults();
    expect(vaults.length).to.equal(1);
    expect(vaults[0]).to.properAddress;
  });
});
