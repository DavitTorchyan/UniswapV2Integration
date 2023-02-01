import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import dotenv from "dotenv";
import { getBalance, approve, getSwapData } from "./helpers";

dotenv.config();

describe("Swap", () => {
  async function deploySwapFixture() {
    const [owner, acc1, acc2] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    const vaultAddress = vault.address;
    const Swap = await ethers.getContractFactory("Swap");
    const swap = await Swap.deploy(0, 0, vaultAddress);

    const eth = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const swapTarget = "0x1111111254fb6c44bAC0beD2854e76F90643097d";

    return { swap, vault, owner, acc1, acc2, eth, usdc, dai, swapTarget };
  }

  it("Should swap and add liquidity to usdc/eth pool correctly.", async () => {
    const { owner, swap, eth, usdc, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("0.5");
    const depositAmountDai = ethers.utils.parseEther("0.5");
    const swapDaiBalanceBefore = await getBalance(dai, swap.address);
    const swapUsdcBalanceBefore = await getBalance(usdc, swap.address);

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      swap.address
    );

    const swapData2 = await getSwapData(
      1,
      eth,
      depositAmountDai,
      dai,
      swap.address
    );

    await swap.deposit(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapData1.tx.data,
      { value: depositAmountUsdc }
    );
    await swap.deposit(
      eth,
      depositAmountDai,
      dai,
      swapTarget,
      swapData2.tx.data,
      { value: depositAmountDai }
    );

    const swapDaiBalanceAfter = await getBalance(dai, swap.address);
    const swapUsdcBalanceAfter = await getBalance(usdc, swap.address);

    expect(swapDaiBalanceAfter).to.be.greaterThan(swapDaiBalanceBefore);
    expect(swapUsdcBalanceAfter).to.be.greaterThan(swapUsdcBalanceBefore);

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await swap
      .connect(owner)
      .addLiquidity(
        dai,
        usdc,
        swapDaiBalanceAfter,
        swapUsdcBalanceAfter,
        0,
        0,
        owner.address,
        1677468954
      );

    const lpTokenBalanceAfter = await getBalance(lpToken, owner.address);
    expect(lpTokenBalanceAfter).to.be.greaterThan(lpTokenBalanceBefore);
  });

  it("Should withdraw correctly provided usdc/eth LP tokens.", async () => {
    const { owner, swap, eth, usdc, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("0.5");
    const depositAmountDai = ethers.utils.parseEther("0.5");
    const swapDaiBalanceBefore = await getBalance(dai, swap.address);
    const swapUsdcBalanceBefore = await getBalance(usdc, swap.address);

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      swap.address
    );

    const swapData2 = await getSwapData(
      1,
      eth,
      depositAmountDai,
      dai,
      swap.address
    );

    await swap.deposit(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapData1.tx.data,
      { value: depositAmountUsdc }
    );

    await swap.deposit(
      eth,
      depositAmountDai,
      dai,
      swapTarget,
      swapData2.tx.data,
      { value: depositAmountDai }
    );

    const swapDaiBalanceAfter = await getBalance(dai, swap.address);
    const swapUsdcBalanceAfter = await getBalance(usdc, swap.address);

    expect(swapDaiBalanceAfter).to.be.greaterThan(swapDaiBalanceBefore);
    expect(swapUsdcBalanceAfter).to.be.greaterThan(swapUsdcBalanceBefore);

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await swap
      .connect(owner)
      .addLiquidity(
        dai,
        usdc,
        swapDaiBalanceAfter,
        swapUsdcBalanceAfter,
        0,
        0,
        owner.address,
        1677468954
      );

    const lpTokenBalanceAfter = await getBalance(lpToken, owner.address);
    expect(lpTokenBalanceAfter).to.be.greaterThan(lpTokenBalanceBefore);

    const lpTokenContract = await ethers.getContractAt("IERC20", lpToken);
    await lpTokenContract
      .connect(owner)
      .approve(swap.address, lpTokenBalanceAfter);
    await swap.removeLiquidity(
      dai,
      usdc,
      lpTokenBalanceAfter,
      0,
      0,
      swap.address,
      1677468954,
      lpToken
    );

    const daiContract = await ethers.getContractAt("IERC20", dai);
    const usdcContract = await ethers.getContractAt("IERC20", usdc);
    const daiSwapAmount = await daiContract.balanceOf(swap.address);
    const usdcSwapAmount = await usdcContract.balanceOf(swap.address);

    const ownerEthBalanceBefore = await swap.provider.getBalance(owner.address);

    const swapData3 = await getSwapData(
      1,
      dai,
      daiSwapAmount,
      eth,
      owner.address
    );

    const swapData4 = await getSwapData(
      1,
      usdc,
      usdcSwapAmount,
      eth,
      owner.address
    );

    await swap.withdraw(dai, daiSwapAmount, eth, swapTarget, swapData3.tx.data);

    await swap.withdraw(
      usdc,
      usdcSwapAmount,
      eth,
      swapTarget,
      swapData4.tx.data
    );

    const ownerEthBalanceAfter = await swap.provider.getBalance(owner.address);
    expect(ownerEthBalanceAfter).to.be.greaterThan(ownerEthBalanceBefore);
  });

  it("Should deposit with usdc to dai/eth pool correctly.", async () => {
    const { owner, swap, eth, usdc, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("0.5");
    const usdcContract = await ethers.getContractAt("IERC20", usdc);
    const daiContract = await ethers.getContractAt("IERC20", dai);

    const swapDataEthUsdc = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      owner.address
    );

    await swap.oneInchSwap(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcAmount = await usdcContract.balanceOf(owner.address);
    const usdcToDaiAmount = ownerUsdcAmount.div(2);
    const usdcToEthAmount = ownerUsdcAmount.sub(usdcToDaiAmount);

    await usdcContract.connect(owner).approve(swap.address, ownerUsdcAmount);

    const swapDataUsdcDai = await getSwapData(
      1,
      usdc,
      usdcToDaiAmount,
      dai,
      swap.address
    );

    const swapDaiBalanceBefore = await getBalance(dai, swap.address);

    await swap.deposit(
      usdc,
      usdcToDaiAmount,
      dai,
      swapTarget,
      swapDataUsdcDai.tx.data
    );

    const swapDaiBalanceAfter = await getBalance(dai, swap.address);

    expect(swapDaiBalanceAfter).to.be.greaterThan(swapDaiBalanceBefore);

    const swapEthBalanceBefore = await swap.provider.getBalance(swap.address);

    const swapDataUsdcEth = await getSwapData(
      1,
      usdc,
      usdcToEthAmount,
      eth,
      swap.address
    );

    await swap.deposit(
      usdc,
      usdcToEthAmount,
      eth,
      swapTarget,
      swapDataUsdcEth.tx.data
    );
    const swapEthBalanceAfter = await swap.provider.getBalance(swap.address);

    expect(swapEthBalanceAfter).to.be.greaterThan(swapEthBalanceBefore);

    const daiBalanceAfterSwap = await daiContract.balanceOf(swap.address);
    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";
    const lpTokenContract = await ethers.getContractAt("IERC20", lpToken);

    const ownerLpTokenBalanceBefore = await lpTokenContract.balanceOf(
      owner.address
    );
    await swap.addLiquidity(
      dai,
      eth,
      daiBalanceAfterSwap,
      swapEthBalanceAfter,
      0,
      0,
      owner.address,
      1677468954,
      { value: swapEthBalanceAfter }
    );
    const ownerLpTokenBalanceAfter = await lpTokenContract.balanceOf(
      owner.address
    );

    expect(ownerLpTokenBalanceAfter).to.be.greaterThan(
      ownerLpTokenBalanceBefore
    );
  });

  it("Should withdraw correctly with dai/eth LP tokens provided.", async () => {
    const { owner, swap, eth, usdc, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("0.5");

    const usdcContract = await ethers.getContractAt("IERC20", usdc);
    const daiContract = await ethers.getContractAt("IERC20", dai);

    const ownerUsdcBalanceBefore = await usdcContract.balanceOf(owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      owner.address
    );

    await swap.oneInchSwap(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await usdcContract.balanceOf(owner.address);

    expect(ownerUsdcBalanceAfter).to.be.greaterThan(ownerUsdcBalanceBefore);

    const usdcToDaiAmount = ownerUsdcBalanceAfter.div(2);
    const usdcToEthAmount = ownerUsdcBalanceAfter.sub(usdcToDaiAmount);

    await usdcContract
      .connect(owner)
      .approve(swap.address, ownerUsdcBalanceAfter);

    const swapDaiBalanceBefore = await daiContract.balanceOf(swap.address);
    const swapDataUsdcDai = await getSwapData(
      1,
      usdc,
      usdcToDaiAmount,
      dai,
      swap.address
    );

    await swap.deposit(
      usdc,
      usdcToDaiAmount,
      dai,
      swapTarget,
      swapDataUsdcDai.tx.data
    );

    const swapDaiBalanceAfter = await daiContract.balanceOf(swap.address);

    expect(swapDaiBalanceAfter).to.be.greaterThan(swapDaiBalanceBefore);

    const swapEthBalanceBefore = await swap.provider.getBalance(swap.address);
    const swapDataUsdcEth = await getSwapData(
      1,
      usdc,
      usdcToEthAmount,
      eth,
      swap.address
    );

    await swap.deposit(
      usdc,
      usdcToEthAmount,
      eth,
      swapTarget,
      swapDataUsdcEth.tx.data
    );

    const swapEthBalanceAfter = await swap.provider.getBalance(swap.address);

    expect(swapEthBalanceAfter).to.be.greaterThan(swapEthBalanceBefore);

    const daiBalanceAfterSwap = await daiContract.balanceOf(swap.address);
    const ethBalanceAfterSwap = await swap.provider.getBalance(swap.address);
    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";
    const lpTokenContract = await ethers.getContractAt("IERC20", lpToken);

    const ownerLpTokenBalanceBefore = await lpTokenContract.balanceOf(
      owner.address
    );
    await swap.addLiquidity(
      dai,
      eth,
      daiBalanceAfterSwap,
      ethBalanceAfterSwap,
      0,
      0,
      owner.address,
      1677468954,
      { value: ethBalanceAfterSwap }
    );
    const ownerLpTokenBalanceAfter = await lpTokenContract.balanceOf(
      owner.address
    );

    expect(ownerLpTokenBalanceAfter).to.be.greaterThan(
      ownerLpTokenBalanceBefore
    );

    await lpTokenContract
      .connect(owner)
      .approve(swap.address, ownerLpTokenBalanceAfter.mul(2));

    const daiBalanceBefore = await daiContract.balanceOf(swap.address);
    const ethBalanceBefore = await swap.provider.getBalance(swap.address);
    await swap.removeLiquidity(
      dai,
      eth,
      ownerLpTokenBalanceAfter,
      0,
      0,
      swap.address,
      1677468954,
      lpToken
    );

    const daiBalanceAfter = await daiContract.balanceOf(swap.address);
    const ethBalanceAfter = await swap.provider.getBalance(swap.address);

    expect(daiBalanceAfter).to.be.greaterThan(daiBalanceBefore);
    expect(ethBalanceAfter).to.be.greaterThan(ethBalanceBefore);

    const usdcBalanceBefore = await usdcContract.balanceOf(owner.address);
    const swapDataDaiUsdc = await getSwapData(
      1,
      dai,
      daiBalanceAfter,
      usdc,
      owner.address
    );
    await swap.withdraw(
      dai,
      daiBalanceAfter,
      usdc,
      swapTarget,
      swapDataDaiUsdc.tx.data
    );
    const usdcBalanceAfter1 = await usdcContract.balanceOf(owner.address);

    expect(usdcBalanceAfter1).to.be.greaterThan(usdcBalanceBefore);

    const swapDataEthUsdcAfter = await getSwapData(
      1,
      eth,
      ethBalanceAfter,
      usdc,
      owner.address
    );
    await swap.withdraw(
      eth,
      ethBalanceAfter,
      usdc,
      swapTarget,
      swapDataEthUsdcAfter.tx.data,
      { value: ethBalanceAfter }
    );
    const usdcBalanceAfter2 = await usdcContract.balanceOf(owner.address);

    expect(usdcBalanceAfter2).to.be.greaterThan(usdcBalanceAfter1);
  });
});
