import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import dotenv from "dotenv";
import { getBalance, approve, getSwapData } from "./helpers";

dotenv.config();

describe("UniswapV2Integration", () => {
  async function deployUniswapV2Integration() {
    const [owner, acc1, acc2] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();

    const goodwill = 100;
    const affiliateSplit = 50;

    const UniswapV2Integration = await ethers.getContractFactory(
      "UniswapV2Integration"
    );
    const uniswapV2Integration = await UniswapV2Integration.deploy(
      goodwill,
      affiliateSplit,
      vault.address
    );

    const uniswapv2Router = await ethers.getContractAt(
      "IUniswapV2Router02",
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    );


    return {
      uniswapV2Integration,
      vault,
      uniswapv2Router,
      owner,
      acc1,
      acc2,
      ETH,
      USDC,
      USDT,
      DAI,
      WETH,
      ONE_INCH,
    };
  }

  it("Should enter with ETH and add liquidity to USDC/DAI pool correctly.", async () => {
    const { owner, uniswapV2Integration, ETH, USDC, DAI, ONE_INCH } =
      await loadFixture(deployUniswapV2Integration);

    const depositAmount = ethers.utils.parseEther("1");

    const depositSwapData = await getSwapData(
      1,
      ETH,
      depositAmount,
      USDC,
      uniswapV2Integration.address
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpTokenAmountBefore = await getBalance(lpToken, owner.address);

    await uniswapV2Integration.deposit(
      ETH,
      depositAmount,
      USDC,
      DAI,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ONE_INCH,
      depositSwapData.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    expect(await getBalance(lpToken, owner.address)).to.be.greaterThan(
      lpTokenAmountBefore
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(USDC, uniswapV2Integration.address)).toString()
    );
  });

  it("Should enter with USDC and add liquidity to DAI/ETH pool correctly.", async () => {
    const { owner, uniswapV2Integration, ETH, USDC, DAI, WETH, ONE_INCH } =
      await loadFixture(deployUniswapV2Integration);

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(USDC, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      ETH,
      depositAmountUsdc,
      USDC,
      owner.address
    );

    await uniswapV2Integration.fillQuote(
      ETH,
      depositAmountUsdc,
      USDC,
      ONE_INCH,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(USDC, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    // *** owner has USDC now, test case begins. ***

    await approve(owner, USDC, uniswapV2Integration.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      USDC,
      ownerUsdcAmount,
      DAI,
      uniswapV2Integration.address
    );

    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .deposit(
        USDC,
        ownerUsdcAmount,
        DAI,
        WETH,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        swapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(lpToken, owner.address)).to.be.greaterThan(
      lpTokenBalanceBefore
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Weth left on contract: ",
      (await getBalance(WETH, uniswapV2Integration.address)).toString()
    );
  });

  it("Should enter with ETH to WETH/DAI pool, and withdraw correctly.", async () => {
    const {
      owner,
      uniswapV2Integration,
      ETH,
      USDC,
      USDT,
      DAI,
      WETH,
      ONE_INCH,
    } = await loadFixture(deployUniswapV2Integration);

    const pair = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
    const lpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    const depositAmount = ethers.utils.parseEther("1");

    const depositSwapData = await getSwapData(
      1,
      ETH,
      depositAmount,
      DAI,
      uniswapV2Integration.address
    );

    await uniswapV2Integration.deposit(
      ETH,
      depositAmount,
      DAI,
      WETH,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ONE_INCH,
      depositSwapData.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, uniswapV2Integration.address, lpTokenAmount);

    const amount = await uniswapV2Integration.removeAssetReturn(
      lpToken,
      USDC,
      lpTokenAmount
    );

    const withdrawSwapData = await getSwapData(
      1,
      DAI,
      amount,
      USDC,
      owner.address
    );

    await approve(owner, pair, uniswapV2Integration.address, lpTokenAmount);
    const usdcBalanceBefore = await getBalance(USDC, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        USDC,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        withdrawSwapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(USDC, owner.address)).to.be.greaterThan(
      usdcBalanceBefore
    );
    console.log(
      "Weth left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
  });

  it("Should enter with USDC to DAI/USDT pool, and withdraw correctly.", async () => {
    const { owner, uniswapV2Integration, ETH, USDC, USDT, DAI, ONE_INCH } =
      await loadFixture(deployUniswapV2Integration);

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(USDC, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      ETH,
      depositAmountUsdc,
      USDC,
      owner.address
    );

    await uniswapV2Integration.fillQuote(
      ETH,
      depositAmountUsdc,
      USDC,
      ONE_INCH,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(USDC, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    await approve(owner, USDC, uniswapV2Integration.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      USDC,
      ownerUsdcAmount,
      DAI,
      uniswapV2Integration.address
    );

    const pair = "0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405";
    const lpToken = "0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405";
    const lpTokenBalanceBefore = await getBalance(lpToken, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .deposit(
        USDC,
        ownerUsdcAmount,
        DAI,
        USDT,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        swapData.tx.data,
        ethers.constants.AddressZero
      );

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    const amount = await uniswapV2Integration.removeAssetReturn(
      lpToken,
      USDC,
      lpTokenAmount
    );

    const withdrawSwapData = await getSwapData(
      1,
      DAI,
      amount,
      USDC,
      owner.address
    );

    await approve(owner, pair, uniswapV2Integration.address, lpTokenAmount);
    const usdcBalanceBefore = await getBalance(USDC, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        USDC,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        withdrawSwapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(USDC, owner.address)).to.be.greaterThan(
      usdcBalanceBefore
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
  });

  it("Should withdraw correctly when providing USDC/DAI lp tokens.", async () => {
    const {
      owner,
      uniswapV2Integration,
      ETH,
      USDC,
      USDT,
      DAI,
      WETH,
      ONE_INCH,
    } = await loadFixture(deployUniswapV2Integration);

    const pair = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    const depositAmount = ethers.utils.parseEther("1");

    const depositSwapData = await getSwapData(
      1,
      ETH,
      depositAmount,
      USDC,
      uniswapV2Integration.address
    );

    await uniswapV2Integration.deposit(
      ETH,
      depositAmount,
      USDC,
      DAI,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ONE_INCH,
      depositSwapData.tx.data,
      ethers.constants.AddressZero,
      { value: depositAmount }
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, uniswapV2Integration.address, lpTokenAmount);

    const amount = await uniswapV2Integration.removeAssetReturn(
      lpToken,
      USDT,
      lpTokenAmount
    );
    console.log("Amount: ", amount.toString());

    const withdrawSwapData = await getSwapData(
      1,
      DAI,
      amount,
      USDT,
      owner.address
    );

    await approve(owner, pair, uniswapV2Integration.address, lpTokenAmount);
    const usdtBalanceBefore = await getBalance(USDT, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        USDT,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        withdrawSwapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(USDT, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );
    console.log(
      "Usdc left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Dai left on contract: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Usdt left on contract: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
  });

  it("Should withdraw with ETH/DAI lp tokens correctly.", async () => {
    const {
      owner,
      uniswapV2Integration,
      ETH,
      USDC,
      USDT,
      DAI,
      WETH,
      ONE_INCH,
    } = await loadFixture(deployUniswapV2Integration);

    const depositAmountUsdc = ethers.utils.parseEther("1");

    const ownerUsdcBalanceBefore = await getBalance(USDC, owner.address);

    const swapDataEthUsdc = await getSwapData(
      1,
      ETH,
      depositAmountUsdc,
      USDC,
      owner.address
    );

    await uniswapV2Integration.fillQuote(
      ETH,
      depositAmountUsdc,
      USDC,
      ONE_INCH,
      swapDataEthUsdc.tx.data,
      { value: depositAmountUsdc }
    );

    const ownerUsdcBalanceAfter = await getBalance(USDC, owner.address);
    const ownerUsdcAmount = ownerUsdcBalanceAfter.sub(ownerUsdcBalanceBefore);

    await approve(owner, USDC, uniswapV2Integration.address, ownerUsdcAmount);

    const swapData = await getSwapData(
      1,
      USDC,
      ownerUsdcAmount,
      WETH,
      uniswapV2Integration.address
    );

    await uniswapV2Integration
      .connect(owner)
      .deposit(
        USDC,
        ownerUsdcAmount,
        WETH,
        DAI,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        swapData.tx.data,
        ethers.constants.AddressZero,
        { value: 0 }
      );

    const daiEthLpToken = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    const lpTokens = await getBalance(daiEthLpToken, owner.address);
    const wethBalanceBefore = await getBalance(WETH, owner.address);

    const pair = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

    await approve(owner, pair, uniswapV2Integration.address, lpTokens);

    const amount = await uniswapV2Integration.removeAssetReturn(
      daiEthLpToken,
      USDT,
      lpTokens
    );

    const withdrawSwapData = await getSwapData(
      1,
      DAI,
      amount,
      USDT,
      owner.address
    );

    const usdtBalanceBefore = await getBalance(USDT, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .withdraw(
        daiEthLpToken,
        lpTokens,
        USDT,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        withdrawSwapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(USDT, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );
    console.log(
      "Dai on contract after: ",
      (await getBalance(DAI, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Weth on contract after: ",
      (await getBalance(WETH, uniswapV2Integration.address)).toString()
    );
    console.log(
      "Usdt on contract after: ",
      (await getBalance(USDT, uniswapV2Integration.address)).toString()
    );
  });

  it.only("Should deposit and withdraw with goodWill subtraction correctly.", async () => {
    // const [owner, acc1, acc2, vault] = await ethers.getSigners();

    // const UniswapV2Integration = await ethers.getContractFactory(
    //   "UniswapV2Integration"
    // );
    // const uniswapV2Integration = await UniswapV2Integration.deploy(
    //   100,
    //   1,
    //   vaultAddress
    // );
    // const uniswapv2Router = await ethers.getContractAt(
    //   "IUniswapV2Router02",
    //   "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    // );

    // const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    // const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    // const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    // const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    // const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    // const ONE_INCH = "0x1111111254fb6c44bAC0beD2854e76F90643097d";

    //------------------------------------------------------------------

    const {
      owner,
      vault,
      uniswapV2Integration,
      ETH,
      USDC,
      DAI,
      ONE_INCH,
      USDT,
    } = await loadFixture(deployUniswapV2Integration);

    await vault.setIntegrationProtocol([uniswapV2Integration.address], [true]);

    const depositAmount = ethers.utils.parseEther("1");
    const depositAmountSwapdata = depositAmount.sub(depositAmount.div(100));
    console.log("SwapData deposit amount: ", depositAmountSwapdata.toString());

    const depositSwapData = await getSwapData(
      1,
      ETH,
      depositAmountSwapdata,
      USDC,
      uniswapV2Integration.address
    );

    const lpToken = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

    await uniswapV2Integration.deposit(
      ETH,
      depositAmount,
      USDC,
      DAI,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ONE_INCH,
      depositSwapData.tx.data,
      uniswapV2Integration.address,
      { value: depositAmount }
    );

    const vaultEthBalance = await getBalance(ETH, vault.address);
    expect(vaultEthBalance).to.eq(depositAmount.div(100));

    expect(
      await vault.affiliateBalance(uniswapV2Integration.address, ETH)
    ).to.eq(vaultEthBalance.div(100));

    const lpTokenAmount = await getBalance(lpToken, owner.address);
    await approve(owner, lpToken, uniswapV2Integration.address, lpTokenAmount);

    const amount = await uniswapV2Integration.removeAssetReturn(
      lpToken,
      USDT,
      lpTokenAmount
    );
    const amountAfterGoodWill = amount.sub(amount.div(100));

    const withdrawSwapData = await getSwapData(
      1,
      DAI,
      amountAfterGoodWill,
      USDT,
      owner.address
    );

    await approve(owner, lpToken, uniswapV2Integration.address, lpTokenAmount);
    const usdtBalanceBefore = await getBalance(USDT, owner.address);

    await uniswapV2Integration
      .connect(owner)
      .withdraw(
        lpToken,
        lpTokenAmount,
        USDT,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ONE_INCH,
        withdrawSwapData.tx.data,
        ethers.constants.AddressZero
      );

    expect(await getBalance(USDT, owner.address)).to.be.greaterThan(
      usdtBalanceBefore
    );

    const daiAmountVault = await getBalance(DAI, vault.address);
    expect(daiAmountVault).to.eq(amount.div(100));
    console.log(
      await vault.affiliateBalance(uniswapV2Integration.address, DAI)
    );

    // expect(await vault.affiliateBalance(uniswapV2Integration.address, DAI)).to.eq(
    //   daiAmountVault.div(100)
    // );
  });
});
