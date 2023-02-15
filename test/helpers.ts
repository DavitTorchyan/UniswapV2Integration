import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import axios from "axios";
import { TransactionResponse } from "@ethersproject/providers";

export enum WETHContractAddress {
  MATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  ETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  AVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  FTM = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
  OP = "0x4200000000000000000000000000000000000006",
  ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
}

export const wrapEther = async (
  signer: SignerWithAddress,
  contractAddress: WETHContractAddress,
  amount: BigNumber | number | bigint
): Promise<TransactionResponse> => {
  const methodId = "0xd0e30db0";

  return signer.sendTransaction({
    from: signer.address,
    to: contractAddress,
    data: methodId,
    value: amount,
  });
};

export const getBalance = async (tokenAddress: string, account: string) => {
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
};

export const approve = async (
  account: SignerWithAddress,
  tokenAddress: string,
  spender: string,
  amount: BigNumber
) => {
  const pool = await ethers.getContractAt("IERC20", tokenAddress, account);
  await pool.approve(spender, amount);
};

// TODO: add return interface
export const getOneInchApiResponse = async function (
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
};
