require('dotenv').config(); const hre = require('hardhat');
(async ()=>{
  const signer = (await hre.ethers.getSigners())[0];
  const provider = hre.ethers.provider;
  const old = '0x70006B785AA87821331a974C3d5af81CdE5BB999';
  const iface = new hre.ethers.utils.Interface(['function payoutToRecipient()','function takeBalance()']);
  const data1 = iface.encodeFunctionData('payoutToRecipient', []);
  const data2 = iface.encodeFunctionData('takeBalance', []);
  try{
    let nonce = await provider.getTransactionCount(signer.address, 'latest');
    const gasPrice = await provider.getGasPrice();
    console.log('starting nonce', nonce, 'gasPrice', gasPrice.toString());

    console.log('sending payoutToRecipient()...');
    const tx1 = await signer.sendTransaction({ to: old, data: data1, nonce, gasLimit: 1000000, gasPrice });
    console.log('tx1', tx1.hash);
    const r1 = await tx1.wait();
    console.log('r1 status', r1.status, 'gasUsed', r1.gasUsed.toString());
  }catch(e){
    console.error('payoutToRecipient failed:', e && e.message ? e.message : e);
  }

  try{
    const nonce2 = await provider.getTransactionCount(signer.address, 'latest');
    const gasPrice2 = await provider.getGasPrice();
    console.log('next nonce', nonce2);
    console.log('sending takeBalance()...');
    const tx2 = await signer.sendTransaction({ to: old, data: data2, nonce: nonce2, gasLimit: 1000000, gasPrice: gasPrice2 });
    console.log('tx2', tx2.hash);
    const r2 = await tx2.wait();
    console.log('r2 status', r2.status, 'gasUsed', r2.gasUsed.toString());
  }catch(e){
    console.error('takeBalance failed:', e && e.message ? e.message : e);
  }
})();
