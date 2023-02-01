import { ethers } from "hardhat";

async function main() {

  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();

  console.log(`Vault successfuly deployed to address: ${vault.address}`);

  const Swap = await ethers.getContractFactory("Swap");
  const swap = await Swap.deploy(1, 1, vault.address);

  console.log(`Swap successfuly deployed to address: ${swap.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Vault address: 0x80eddc98fb7FAf900257215A3Ece67728292ac4b
// Swap address: 0xAb0EEb2206e4538b2BE236066aa0A3A0c80448Ca