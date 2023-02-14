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
    const Swap = await ethers.getContractFactory("UniswapV2Integration");
    const swap = await Swap.deploy(0, 0, vaultAddress);
    const router = await ethers.getContractAt(
      "IUniswapV2Router02",
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    );

    const eth = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const swapTarget = "0x1111111254fb6c44bAC0beD2854e76F90643097d";

    return {
      swap,
      vault,
      router,
      owner,
      acc1,
      acc2,
      eth,
      usdc,
      usdt,
      dai,
      weth,
      swapTarget,
    };
  }

  it("Should enter with eth and add liquidity to usdc/dai pool correctly.", async () => {
    const { owner, swap, eth, usdc, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmount = ethers.utils.parseEther("1");

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmount,
      usdc,
      swap.address
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpTokenAmountBefore = await getBalance(lpToken, owner.address);

    await swap.deposit(
      eth,
      depositAmount,
      usdc,
      dai,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      swapTarget,
      swapData1.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    expect(await getBalance(lpToken, owner.address)).to.be.greaterThan(
      lpTokenAmountBefore
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(usdc, swap.address)).toString()
    );
  });

  it("Should enter with usdc and add liquidity to dai/eth pool correctly.", async () => {
    const { owner, swap, eth, usdc, dai, weth, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(usdc, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      owner.address
    );

    await swap.fillQuote(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(usdc, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    // *** owner has usdc now, test case begins. ***

    await approve(owner, usdc, swap.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      usdc,
      ownerUsdcAmount,
      dai,
      swap.address
    );

    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await swap
      .connect(owner)
      .deposit(
        usdc,
        ownerUsdcAmount,
        dai,
        weth,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(lpToken, owner.address)).to.be.greaterThan(
      lpTokenBalanceBefore
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Weth left on contract: ",
      (await getBalance(weth, swap.address)).toString()
    );
  });

  it.only("Should enter with eth to weth/dai pool, and withdraw correctly.", async () => {
    const { owner, swap, eth, usdc, usdt, dai, weth, swapTarget } =
      await loadFixture(deploySwapFixture);

    const pair = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    const depositAmount = ethers.utils.parseEther("1");

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmount,
      dai,
      swap.address
    );

    await swap.deposit(
      eth,
      depositAmount,
      dai,
      weth,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      swapTarget,
      swapData1.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, swap.address, lpTokenAmount);

    const amount = await swap.removeAssetReturn(lpToken, usdc, lpTokenAmount);

    const swapData2 = await getSwapData(1, dai, amount, usdc, owner.address);

    await approve(owner, pair, swap.address, lpTokenAmount);
    const usdcBalanceBefore = await getBalance(usdc, owner.address);

    await swap
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        usdc,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData2.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(usdc, owner.address)).to.be.greaterThan(
      usdcBalanceBefore
    );
    console.log(
      "Weth left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
  });

  it("Should enter with usdc to dai/usdt pool, and withdraw correctly.", async () => {
    const { owner, swap, eth, usdc, usdt, dai, swapTarget } = await loadFixture(
      deploySwapFixture
    );

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(usdc, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      owner.address
    );

    await swap.fillQuote(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(usdc, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    await approve(owner, usdc, swap.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      usdc,
      ownerUsdcAmount,
      dai,
      swap.address
    );

    const pair = "0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405";
    const lpToken = "0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await swap
      .connect(owner)
      .deposit(
        usdc,
        ownerUsdcAmount,
        dai,
        usdt,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData.tx.data,
        ethers.constants.AddressZero
      );

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    const amount = await swap.removeAssetReturn(lpToken, usdc, lpTokenAmount);

    const swapData2 = await getSwapData(1, dai, amount, usdc, owner.address);

    await approve(owner, pair, swap.address, lpTokenAmount);
    const usdcBalanceBefore = await getBalance(usdc, owner.address);

    await swap
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        usdc,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData2.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(usdc, owner.address)).to.be.greaterThan(
      usdcBalanceBefore
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
  });

  it("Should withdraw correctly when providing usdc/dai lp tokens.", async () => {
    const { owner, swap, eth, usdc, usdt, dai, weth, swapTarget } =
      await loadFixture(deploySwapFixture);

    const pair = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    const depositAmount = ethers.utils.parseEther("1");

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmount,
      usdc,
      swap.address
    );

    await swap.deposit(
      eth,
      depositAmount,
      usdc,
      dai,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      swapTarget,
      swapData1.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, swap.address, lpTokenAmount);

    const amount = await swap.removeAssetReturn(lpToken, usdt, lpTokenAmount);
    console.log("Amount: ", amount.toString());

    const swapData2 = await getSwapData(1, dai, amount, usdt, owner.address);

    await approve(owner, pair, swap.address, lpTokenAmount);
    const usdtBalanceBefore = await getBalance(usdt, owner.address);

    await swap
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        usdt,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData2.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(usdt, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(usdt, swap.address)).toString()
    );
  });

  it("Should withdraw with eth/dai lp tokens correctly.", async () => {
    const { owner, swap, eth, usdc, usdt, dai, weth, swapTarget } =
      await loadFixture(deploySwapFixture);

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(usdc, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      eth,
      depositAmountUsdc,
      usdc,
      owner.address
    );

    await swap.fillQuote(
      eth,
      depositAmountUsdc,
      usdc,
      swapTarget,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(usdc, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    await approve(owner, usdc, swap.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      usdc,
      ownerUsdcAmount,
      weth,
      swap.address
    );

    await swap
      .connect(owner)
      .deposit(
        usdc,
        ownerUsdcAmount,
        weth,
        dai,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData.tx.data,
        ethers.constants.AddressZero,
        { value: 0 }
      );

    const daiEthLpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    const lpTokens = await getBalance(daiEthLpToken, owner.address);
    const wethBalanceBefore = await getBalance(weth, owner.address);

    const pair = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    await approve(owner, pair, swap.address, lpTokens);

    const amount = await swap.removeAssetReturn(daiEthLpToken, usdt, lpTokens);

    const swapData2 = await getSwapData(1, dai, amount, usdt, owner.address);

    const usdtBalanceBefore = await getBalance(usdt, owner.address);

    await swap
      .connect(owner)
      .withdraw(
        daiEthLpToken,
        lpTokens,
        usdt,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData2.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(usdt, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );
    console.log(
      "Dai on contract after: ",
      (await getBalance(dai, swap.address)).toString()
    );
    console.log(
      "Weth on contract after: ",
      (await getBalance(weth, swap.address)).toString()
    );
    console.log(
      "Usdt on contract after: ",
      (await getBalance(usdt, swap.address)).toString()
    );
  });

  it.only("Should deposit and withdraw with goodWill subtraction correctly.", async () => {
    const [owner, acc1, acc2] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    const vaultAddress = vault.address;
    const Swap = await ethers.getContractFactory("UniswapV2Integration");
    const swap = await Swap.deploy(100, 1, vaultAddress);
    const router = await ethers.getContractAt(
      "IUniswapV2Router02",
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    );

    const eth = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const swapTarget = "0x1111111254fb6c44bAC0beD2854e76F90643097d";

    //------------------------------------------------------------------

    await vault.setIntegrationProtocol([swap.address], [true]);

    const depositAmount = ethers.utils.parseEther("1");
    const depositAmountSwapdata = depositAmount.sub(depositAmount.div(100));
    console.log("SwapData deposit amount: ", depositAmountSwapdata.toString());

    const swapData1 = await getSwapData(
      1,
      eth,
      depositAmountSwapdata,
      usdc,
      swap.address
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    await swap.deposit(
      eth,
      depositAmount,
      usdc,
      dai,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      swapTarget,
      swapData1.tx.data,
      swap.address,
      { value: depositAmount }
    );

    const vaultEthBalance = await getBalance(eth, vault.address);
    expect(vaultEthBalance).to.eq(depositAmount.div(100));

    expect(await vault.affiliateBalance(swap.address, eth)).to.eq(
      vaultEthBalance.div(100)
    );

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, swap.address, lpTokenAmount);

    const amount = await swap.removeAssetReturn(lpToken, usdt, lpTokenAmount);
    const amountAfterGoodWill = amount.sub(amount.div(100));

    const swapData2 = await getSwapData(
      1,
      dai,
      amountAfterGoodWill,
      usdt,
      owner.address
    );

    await approve(owner, lpToken, swap.address, lpTokenAmount);
    const usdtBalanceBefore = await getBalance(usdt, owner.address);

    await swap
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        usdt,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        swapTarget,
        swapData2.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(usdt, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );

    const daiAmountVault = await getBalance(dai, vault.address);
    expect(daiAmountVault).to.eq(amount.div(100));
    console.log(await vault.affiliateBalance(swap.address, dai));
    
    // expect(await vault.affiliateBalance(swap.address, dai)).to.eq(
    //   daiAmountVault.div(100)
    // );
  });
});
