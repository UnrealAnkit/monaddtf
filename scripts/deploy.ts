import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Bootstraps a demo index using self-issued mock ERC20s standing in for ecosystem
 * assets, mock price feeds (swap in real Pyth/Chainlink feed addresses once
 * available for the assets you pick), and a mock swap router (swap in Uniswap's or
 * Kuru's deployed router address on Monad testnet).
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network localhost      (local demo)
 *   npx hardhat run scripts/deploy.ts --network monadTestnet   (real testnet)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} with:`, deployer.address);

  const ERC20 = await ethers.getContractFactory("MockERC20");
  const entryToken = await ERC20.deploy("Mock Wrapped MON", "mMON");
  const assetGov = await ERC20.deploy("Mock DEX Governance Token", "mGOV");
  const assetLst = await ERC20.deploy("Mock Liquid Staked MON", "mLSMON");
  const assetStable = await ERC20.deploy("Mock USD Stable", "mUSD");
  await Promise.all([
    entryToken.waitForDeployment(),
    assetGov.waitForDeployment(),
    assetLst.waitForDeployment(),
    assetStable.waitForDeployment(),
  ]);

  const OracleRouter = await ethers.getContractFactory("OracleRouter");
  const oracleRouter = await OracleRouter.deploy(deployer.address);
  await oracleRouter.waitForDeployment();

  const Feed = await ethers.getContractFactory("MockPriceFeed");
  // MockPriceFeed values are deliberately static. A short staleness window
  // makes every testnet deployment unusable an hour later because no keeper
  // exists to publish a new round. Real oracle deployments must use a finite
  // window; the self-issued demo assets use this non-expiring setting.
  const MOCK_FEED_MAX_STALENESS = ethers.MaxUint256;
  const prices: [any, number][] = [
    [entryToken, 1],
    [assetGov, 3],
    [assetLst, 1],
    [assetStable, 1],
  ];
  for (const [token, price] of prices) {
    const feed = await Feed.deploy(8, BigInt(price) * 10n ** 8n);
    await feed.waitForDeployment();
    const tokenAddr = await token.getAddress();
    await (await oracleRouter.setFeed(tokenAddr, await feed.getAddress(), MOCK_FEED_MAX_STALENESS)).wait();
  }

  const SwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const swapRouter = await SwapRouter.deploy(await oracleRouter.getAddress(), 30); // 0.3% fee
  await swapRouter.waitForDeployment();

  // fund the swap router so it can pay out mint swaps in the demo
  const supply = ethers.parseEther("10000000");
  for (const token of [assetGov, assetLst, assetStable]) {
    await (await token.mint(await swapRouter.getAddress(), supply)).wait();
  }
  await (await entryToken.mint(deployer.address, ethers.parseEther("100000"))).wait();

  const Factory = await ethers.getContractFactory("IndexFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const basketAssets = [
    { symbol: "mGOV", weightBps: 4_000, contract: assetGov },
    { symbol: "mLSMON", weightBps: 4_000, contract: assetLst },
    { symbol: "mUSD", weightBps: 2_000, contract: assetStable },
  ];

  const tx = await factory.createIndex(
    "Demo Ecosystem Index",
    "DEMO",
    await Promise.all(basketAssets.map((a) => a.contract.getAddress())),
    basketAssets.map((a) => a.weightBps),
    await entryToken.getAddress(),
    await swapRouter.getAddress(),
    await oracleRouter.getAddress(),
    deployer.address
  );
  const receipt = await tx.wait();
  const vaults = await factory.getAllVaults();
  const vaultAddress = vaults[vaults.length - 1];

  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  const deployment = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    entryToken: { symbol: "mMON", address: await entryToken.getAddress() },
    assets: await Promise.all(
      basketAssets.map(async (a) => ({
        symbol: a.symbol,
        address: await a.contract.getAddress(),
        weightBps: a.weightBps,
      }))
    ),
    oracleRouter: await oracleRouter.getAddress(),
    swapRouter: await swapRouter.getAddress(),
    factory: await factory.getAddress(),
    demoVault: vaultAddress,
    txHash: receipt?.hash,
  };

  const fileName = `${network.name}.json`;
  const repoOutDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(repoOutDir, { recursive: true });
  fs.writeFileSync(path.join(repoOutDir, fileName), JSON.stringify(deployment, null, 2));

  const appOutDir = path.join(__dirname, "..", "app", "lib", "deployments");
  fs.mkdirSync(appOutDir, { recursive: true });
  fs.writeFileSync(path.join(appOutDir, fileName), JSON.stringify(deployment, null, 2));

  console.log(JSON.stringify(deployment, null, 2));
  console.log(`\nSaved to deployments/${fileName} and app/lib/deployments/${fileName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
