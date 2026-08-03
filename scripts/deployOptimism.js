const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const Factory = await hre.ethers.getContractFactory("MockTreasury");
  const contract = await Factory.deploy();

  console.log("Tx hash:", contract.deployTransaction.hash);
  const receipt = await contract.deployTransaction.wait();

  console.log("Deployed at:", contract.address);
  console.log("GasUsed", receipt.gasUsed.toString());

  const gasPrice = contract.deployTransaction.gasPrice || (await hre.ethers.provider.getGasPrice());
  const cost = gasPrice.mul(receipt.gasUsed);
  console.log("GasPrice", gasPrice.toString());
  console.log("Cost ETH", hre.ethers.utils.formatEther(cost));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
