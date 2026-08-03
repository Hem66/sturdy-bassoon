const hre = require('hardhat');

async function main() {
  const oldContract = '0x70006B785AA87821331a974C3d5af81CdE5BB999';
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const provider = hre.ethers.provider;

  // Deploy MockTreasury01
  const Factory = await hre.ethers.getContractFactory('MockTreasury01');
  const nextNonce = await provider.getTransactionCount(signer.address, 'latest');
  console.log('nonce for deploy:', nextNonce);
  const mock = await Factory.deploy(signer.address, { nonce: nextNonce });
  await mock.deployed();
  console.log('Deployed MockTreasury01 at', mock.address);
  console.log('deploy tx', mock.deployTransaction.hash);

  // set as recipient on old contract
  const setNonce = await provider.getTransactionCount(signer.address, 'latest');
  const old = await hre.ethers.getContractAt('MockTreasury', oldContract, signer).catch(()=>null);
  if (!old) {
    console.error('Failed to get ABI for old contract via MockTreasury binding. Attempting low-level setRecipient call.');
  }

  try {
    if (old) {
      const setTx = await old.setRecipient(mock.address, { nonce: setNonce });
      console.log('setRecipient tx', setTx.hash);
      await setTx.wait();
    } else {
      // Fallback: encode and send a transaction calling setRecipient
      const iface = new hre.ethers.utils.Interface(['function setRecipient(address)']);
      const data = iface.encodeFunctionData('setRecipient', [mock.address]);
      const tx = await signer.sendTransaction({ to: oldContract, data, nonce: setNonce });
      console.log('setRecipient fallback tx', tx.hash);
      await tx.wait();
    }
  } catch (e) {
    console.error('setRecipient failed:', e.message);
    throw e;
  }

  // Call pushAll on old contract to transfer funds
  const pushNonce = await provider.getTransactionCount(signer.address, 'latest');
  try {
    if (old) {
      const pushTx = await old.pushAll({ nonce: pushNonce });
      console.log('pushAll tx', pushTx.hash);
      const receipt = await pushTx.wait();
      console.log('pushAll confirmed, gasUsed', receipt.gasUsed.toString());
    } else {
      const ifacePush = new hre.ethers.utils.Interface(['function pushAll()']);
      const data2 = ifacePush.encodeFunctionData('pushAll', []);
      const tx2 = await signer.sendTransaction({ to: oldContract, data: data2, nonce: pushNonce });
      console.log('pushAll fallback tx', tx2.hash);
      await tx2.wait();
    }
  } catch (e) {
    console.error('pushAll failed:', e.message);
    throw e;
  }

  console.log('Migration attempted. Check balances.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
