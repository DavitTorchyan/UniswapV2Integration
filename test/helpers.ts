import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import axios from "axios";

async function getBalance(tokenAddress: string, account: string) {
  if (tokenAddress != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
    const tokenContract = await ethers.getContractAt("IERC20", tokenAddress);
    return tokenContract.balanceOf(account);
  } else {
    return BigNumber.from(
      await network.provider.request({
        method: "eth_getBalance",
        params: [account],
      })
    );
  }
}

async function approve(
  account: SignerWithAddress,
  tokenAddress: string,
  spender: string,
  amount: BigNumber
) {
  const pool = await ethers.getContractAt("IERC20", tokenAddress, account);
  await pool.approve(spender, amount);
}

async function getSwapData(
  chainId: number = 1,
  fromTokenAddress: string,
  amount: BigNumber,
  toTokenAddress: string,
  destReceiver: string,
  slippage: number = 10,
  excludeProtcols: Array<string> = [],
  version: number = 4,
  debug: boolean = true
) {
  const requestURL = `https://api.1inch.io/v${version}.0/${chainId}/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=0x0000000000000000000000000000000000000000&slippage=${slippage}&disableEstimate=true&destReceiver=${destReceiver}`;
  if (debug) console.log(requestURL);
  const response = await axios.get(requestURL);
  return response.data;
}


export { getBalance, approve, getSwapData };