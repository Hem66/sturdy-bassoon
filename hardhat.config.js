require("dotenv").config();
require("@nomiclabs/hardhat-ethers");

const {
  SEPOLIA_URL,
  INFURA_SEPOLIA_URL,
  ALCHEMY_SEPOLIA_URL,
  PRIVATE_KEY,
  DEPLOYER_PRIVATE_KEY,
} = process.env;

const sepoliaUrl = SEPOLIA_URL || INFURA_SEPOLIA_URL || ALCHEMY_SEPOLIA_URL;
const optimismUrl =
  process.env.OPTIMISM_URL ||
  process.env.OPTIMISM_MAINNET_URL ||
  process.env.OPTIMISM_RPC_URL;

const commonAccounts = PRIVATE_KEY
  ? [PRIVATE_KEY]
  : DEPLOYER_PRIVATE_KEY
  ? [DEPLOYER_PRIVATE_KEY]
  : [];

const networks = {};

// Live/testnet networks — only used for actual deployment scripts,
// NOT for running the test suite.
if (sepoliaUrl) {
  networks.sepolia = {
    url: sepoliaUrl,
    chainId: 11155420, // NOTE: this is OP Sepolia's chain ID, not Ethereum Sepolia (11155111).
                        // Double check sepoliaUrl actually points to an OP Sepolia RPC.
    accounts: commonAccounts,
  };
}

if (optimismUrl) {
  networks.optimism = {
    url: optimismUrl,
    chainId: 10,
    accounts: commonAccounts,
  };
}

// Local/test network — forks Optimism mainnet so contract tests get
// realistic on-chain state without needing real funds.
if (optimismUrl) {
  networks.hardhat = {
    forking: {
      url: optimismUrl,
      // blockNumber: 123456789, // optional: pin a block for reproducible tests
    },
  };
}

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
};