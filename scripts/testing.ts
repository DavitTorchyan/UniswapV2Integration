import contract from "../artifacts/contracts/Swap.sol/Swap.json";
import * as dotenv from "dotenv";
import { ethers, BigNumber } from "ethers";
import { Bytes, FunctionFragment } from "ethers/lib/utils";
import { getBalance, approve, getSwapData } from "../test/helpers";

dotenv.config();

const SWAP_ADDRESS = "0xAb0EEb2206e4538b2BE236066aa0A3A0c80448Ca";

const {
    DEV_PRIVKEY, 
    ACC1_PRIVKEY
} = process.env;

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("https://goerli.infura.io/v3/742f343587964019b49762859344f231");
    const signer = new ethers.Wallet(DEV_PRIVKEY as string, provider);
    const acc1 = new ethers.Wallet(ACC1_PRIVKEY as string, provider);
    const swapContract = new ethers.Contract(SWAP_ADDRESS, contract.abi, signer);

    const usdcAddress = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";
    const token1Address = "0xD00706d33E9779A4e4a87ceb77aD601470209d18";
    const token2Address = "0x66593b8f5ABd59dA37d01D40201a65a0606451f3";

    // await approve(signer, usdcAddress, acc1, 100);

    const swapData = await getSwapData(1, "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", ethers.utils.parseEther("1"), "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", signer.address);
    console.log("SWAP DATA: ", swapData);
    

    const balance1 = await getBalance(token1Address, signer.address);
    console.log(balance1);
    
}

main();
