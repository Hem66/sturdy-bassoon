const hre = require('hardhat');

async function main() {
  const contractAddress = '0x998EdB44120175b781661c2AA2f744eFD4945c36';
  const [signer] = await hre.ethers.getSigners();
  console.log('Using signer', signer.address);

  const treasury = await hre.ethers.getContractAt('MockTreasury', contractAddress, signer);
  const provider = hre.ethers.provider;
  const nextNonce = await provider.getTransactionCount(signer.address, 'latest');
  console.log('Using nonce', nextNonce);

  const tx = await treasury.pushAll({ nonce: nextNonce });
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed. GasUsed:', receipt.gasUsed.toString());
  const gasPrice = receipt.effectiveGasPrice || (await hre.ethers.provider.getGasPrice());
  const cost = gasPrice.mul(receipt.gasUsed);
  console.log('GasPrice:', gasPrice.toString());
  console.log('Cost ETH:', hre.ethers.utils.formatEther(cost));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
