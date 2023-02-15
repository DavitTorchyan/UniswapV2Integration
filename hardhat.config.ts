import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
      },
      {
        version: "0.6.6",
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 10,
        accountsBalance: "10000000000000000000000000",
      },
      forking: {
        url: process.env.MAINNET_URL || "",
      },
      chainId: 1,
    },
    goerli: {
      url: process.env.GOERLI_URL,
      accounts: process.env.DEV_PRIVKEY ? [process.env.DEV_PRIVKEY] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL,
      accounts: process.env.DEV_PRIVKEY ? [process.env.DEV_PRIVKEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 10000000000,
  },
};

export default config;
