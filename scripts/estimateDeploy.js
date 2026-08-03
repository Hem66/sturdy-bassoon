const dotenv = require('dotenv');
dotenv.config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = 'artifacts/contracts/MockTreasury.sol/MockTreasury.json';

if (!fs.existsSync(path)) {
  console.error('artifact not found:', path);
  process.exit(1);
}
const artifact = JSON.parse(fs.readFileSync(path, 'utf8'));
const url = process.env.OPTIMISM_URL || process.env.OPTIMISM_RPC_URL || process.env.OPTIMISM_MAINNET_URL;
if (!url) {
  console.error('OPTIMISM RPC URL not configured in .env');
  process.exit(1);
}

(async () => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(url);
    const pk = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const wallet = pk ? new ethers.Wallet(pk, provider) : null;
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet || provider);
    const tx = factory.getDeployTransaction();
    const from = wallet ? wallet.address : undefined;
    const estimate = await provider.estimateGas({ from, data: tx.data, value: tx.value || 0 });
    const gasPrice = await provider.getGasPrice();
    const estCost = estimate.mul(gasPrice);
    console.log('estimateGas', estimate.toString());
    console.log('gasPrice', gasPrice.toString());
    console.log('estCostETH', ethers.utils.formatEther(estCost));
    if (wallet) console.log('from', wallet.address);
  } catch (e) {
    console.error('ERROR', e.message);
    process.exit(1);
  }
})();
