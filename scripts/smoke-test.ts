import { ethers } from "hardhat";
// Deployment manifests are shared with the Next app from app/lib. The prior
// app/src path was left over from an earlier project layout, so this script
// could never reach the live smoke test.
import deployment from "../app/lib/deployments/monadTestnet.json";

/**
 * One-off sanity check that mint/redeem actually work against the live network
 * (not just our local Hardhat simulation). Not part of the test suite — run
 * manually: npx hardhat run scripts/smoke-test.ts --network monadTestnet
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const entryToken = await ethers.getContractAt("MockERC20", deployment.entryToken.address, signer);
  const vault = await ethers.getContractAt("IndexVault", deployment.demoVault, signer);

  const balBefore: bigint = await entryToken.balanceOf(signer.address);
  console.log("mMON balance:", ethers.formatEther(balBefore));

  const depositAmount = ethers.parseEther("50");

  console.log("Approving...");
  await (await entryToken.approve(deployment.demoVault, depositAmount)).wait();

  console.log("Minting...");
  const mintTx = await vault.mint(depositAmount, 0);
  const mintReceipt = await mintTx.wait();
  console.log("Mint tx:", mintReceipt?.hash);

  const shares: bigint = await vault.balanceOf(signer.address);
  const nav: bigint = await vault.navPerShare();
  console.log("Shares held:", ethers.formatEther(shares));
  console.log("NAV per share (USD, 1e18):", ethers.formatEther(nav));

  console.log("Redeeming half...");
  const redeemTx = await vault.redeem(shares / 2n);
  const redeemReceipt = await redeemTx.wait();
  console.log("Redeem tx:", redeemReceipt?.hash);

  const sharesAfter: bigint = await vault.balanceOf(signer.address);
  console.log("Shares remaining:", ethers.formatEther(sharesAfter));
  console.log("\nSmoke test passed: mint and redeem both settled on Monad testnet.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
