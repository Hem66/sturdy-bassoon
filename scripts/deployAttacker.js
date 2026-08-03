const hre = require('hardhat');

async function main() {
  const treasuryAddress = '0x998EdB44120175b781661c2AA2f744eFD4945c36'; // existing deployed treasury
  const [signer] = await hre.ethers.getSigners();
  console.log('Deployer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('ReentrantForwarder');
  const provider = hre.ethers.provider;
  const nextNonce = await provider.getTransactionCount(signer.address, 'latest');
  console.log('Using nonce for deploy:', nextNonce);
  const attacker = await Factory.deploy(treasuryAddress, signer.address, { nonce: nextNonce });
  await attacker.deployed();
  console.log('Attacker deployed at:', attacker.address);
  console.log('Tx hash:', attacker.deployTransaction.hash);
  // Set recipient in treasury to attacker
  const treasury = await hre.ethers.getContractAt('MockTreasury', treasuryAddress, signer);
  const setNonce = await provider.getTransactionCount(signer.address, 'latest');
  console.log('Using nonce for setRecipient:', setNonce);
  const setTx = await treasury.setRecipient(attacker.address, { nonce: setNonce });
  console.log('setRecipient tx:', setTx.hash);
  const rec = await setTx.wait();
  console.log('setRecipient confirmed, gasUsed:', rec.gasUsed.toString());

  console.log('DONE — attacker deployed and set as recipient. No attack triggered.');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
