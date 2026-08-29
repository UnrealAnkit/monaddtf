import { ethers } from "hardhat";

/** Send a small amount of native Monad testnet MON to a demo wallet for gas. */
async function main() {
  const recipient = process.env.TEST_RECIPIENT;
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error("Set TEST_RECIPIENT to a valid EVM address.");
  }
  const amount = process.env.TEST_AMOUNT ?? "0.05";

  const [sender] = await ethers.getSigners();
  const tx = await sender.sendTransaction({ to: recipient, value: ethers.parseEther(amount) });
  const receipt = await tx.wait();
  console.log(`Funded ${recipient} with ${amount} testnet MON: ${receipt?.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
