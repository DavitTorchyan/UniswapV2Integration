import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { addresses, uniswapV2Pools } from "./constatns";
import {
  approve,
  getBalance,
  getOneInchApiResponse,
  WETHContractAddress,
  wrapEther,
} from "./helpers";

describe("UniswapV2Integration", function () {
  async function deployUniswapIntegration() {
    const [deployer, otherAccount] = await ethers.getSigners();

    const goodwill = 0;
    const affiliateSplit = 0;

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();

    const UniswapV2Integration = await ethers.getContractFactory(
      "contracts/UniswapV2Integration.sol:UniswapV2Integration"
    );
    const uniswapV2Integration = await UniswapV2Integration.deploy(
      goodwill,
      affiliateSplit,
      vault.address
    );

    return {
      deployer,
      otherAccount,
      vault,
      goodwill,
      affiliateSplit,
      uniswapV2Integration,
    };
  }

  describe("Deposits", () => {
    describe("Deposits in ETH", () => {
      it("Should deposit ETH to WETH-DAI pool. [ETH - WETH - WETH-DAI]", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        // Deposit
        const entryTokenAddress = addresses.ETH;
        const entryTokenAmount = ethers.utils.parseEther("10");
        const poolAddress = uniswapV2Pools.WETH_DAI;
        const depositTokenAddress = addresses.WETH;
        const minExitTokenAmount = 0;
        const underlyingTarget = addresses.ZERO_ADDRESS;
        const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
        const swapTarget = addresses.ONE_INCH;

        const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

        const swapTargetApiResponse = await getOneInchApiResponse(
          ethers.provider.network.chainId,
          entryTokenAddress,
          entryTokenAmount.sub(goodwillPortion),
          depositTokenAddress,
          uniswapV2Integration.address
        );

        const swapData = swapTargetApiResponse.tx.data;
        const affiliate = addresses.ZERO_ADDRESS;

        console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
        await expect(
          uniswapV2Integration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate,
              {
                value: entryTokenAmount,
              }
            )
        ).to.be.fulfilled;
        console.log(`...done`);
      });
    });

    describe("Deposits in ERC20", () => {
      it("Should deposit WETH to WETH-DAI pool. [WETH - WETH-DAI]", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        // Deposit
        const entryTokenAddress = addresses.WETH;
        const entryTokenAmount = ethers.utils.parseEther("10");
        await wrapEther(
          otherAccount,
          WETHContractAddress.ETH,
          entryTokenAmount
        );
        const poolAddress = uniswapV2Pools.WETH_DAI;
        const depositTokenAddress = addresses.WETH;
        const minExitTokenAmount = 0;
        const underlyingTarget = addresses.ZERO_ADDRESS;
        const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
        const swapTarget = addresses.ZERO_ADDRESS;

        const swapData = addresses.ZERO_ADDRESS;
        const affiliate = addresses.ZERO_ADDRESS;

        await approve(
          otherAccount,
          addresses.WETH,
          uniswapV2Integration.address,
          entryTokenAmount
        );

        console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
        await expect(
          uniswapV2Integration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate
            )
        ).to.be.fulfilled;
        console.log(`...done`);
      });
    });
  });

  describe("Withdrawals", () => {
    describe("Withdrawals in ETH", () => {
      it("Should withdraw ETH from WETH-DAI pool. [WETH-DAI - WETH - ETH]", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          // Deposit
          const entryTokenAddress = addresses.ETH;
          const entryTokenAmount = ethers.utils.parseEther("10");
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const depositTokenAddress = addresses.WETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate,
                {
                  value: entryTokenAmount,
                }
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );
          const exitTokenAddress = addresses.ETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.WETH;
          const swapTarget = addresses.ONE_INCH;

          const underlyingReturnAmount =
            await uniswapV2Integration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });

      it("Sould withdraw ETH from DAI-USDC pool.", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          // Deposit
          const entryTokenAddress = addresses.ETH;
          const entryTokenAmount = ethers.utils.parseEther("10");
          const poolAddress = uniswapV2Pools.USDC_DAI;
          const depositTokenAddress = addresses.USDC;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate,
                {
                  value: entryTokenAmount,
                }
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.USDC_DAI;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );

          const exitTokenAddress = addresses.ETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.DAI;
          const swapTarget = addresses.ONE_INCH;

          const underlyingReturnAmount =
            await uniswapV2Integration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });

      it("Should deposit DAI and withdraw ETH from USDC-USDT pool.", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          const swapDataX = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            addresses.ETH,
            ethers.utils.parseEther("10"),
            addresses.DAI,
            otherAccount.address
          );

          const unsignedTransaction = {
            from: otherAccount.address,
            to: addresses.ONE_INCH,
            data: swapDataX.tx.data,
            value: ethers.utils.parseEther("10"),
          };

          await otherAccount.sendTransaction(unsignedTransaction);

          // Deposit
          const entryTokenAddress = addresses.DAI;
          const entryTokenAmount = await getBalance(
            addresses.DAI,
            otherAccount.address
          );

          const poolAddress = uniswapV2Pools.USDC_USDT;
          const depositTokenAddress = addresses.USDC;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            addresses.DAI,
            uniswapV2Integration.address,
            entryTokenAmount
          );

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
          await uniswapV2Integration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate
            );
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.USDC_USDT;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );

          const exitTokenAddress = addresses.ETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.USDC;
          const swapTarget = addresses.ONE_INCH;

          const underlyingReturnAmount =
            await uniswapV2Integration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });
    });

    describe("Withdrawals in ERC20", () => {
      it("Should withdraw WETH from WETH-DAI pool. [WETH-DAI - WETH]", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          // Deposit
          const entryTokenAddress = addresses.ETH;
          const entryTokenAmount = ethers.utils.parseEther("10");
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const depositTokenAddress = addresses.WETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate,
                {
                  value: entryTokenAmount,
                }
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );
          const exitTokenAddress = addresses.WETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.WETH;
          const swapTarget = addresses.ZERO_ADDRESS;
          const swapData = addresses.ZERO_ADDRESS;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });

      it("Should deposit ETH and withdraw USDC from WETH-DAI pool.", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          // Deposit
          const entryTokenAddress = addresses.ETH;
          const entryTokenAmount = ethers.utils.parseEther("10");
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const depositTokenAddress = addresses.WETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate,
                {
                  value: entryTokenAmount,
                }
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.WETH_DAI;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );
          const exitTokenAddress = addresses.USDC;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.WETH;
          const swapTarget = addresses.ONE_INCH;

          const underlyingReturnAmount =
            await uniswapV2Integration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });

      it("Should deposit ETH and withdraw USDT from DAI-USDC pool.", async () => {
        const { otherAccount, goodwill, uniswapV2Integration } =
          await loadFixture(deployUniswapIntegration);

        {
          // Deposit
          const entryTokenAddress = addresses.ETH;
          const entryTokenAmount = ethers.utils.parseEther("10");
          const poolAddress = uniswapV2Pools.USDC_DAI;
          const depositTokenAddress = addresses.USDC;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;

          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate,
                {
                  value: entryTokenAmount,
                }
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }

        {
          // Withdraw
          const poolAddress = uniswapV2Pools.USDC_DAI;
          const liquidityAmount = await uniswapV2Integration.getBalance(
            poolAddress,
            otherAccount.address
          );
          const exitTokenAddress = addresses.USDT;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.USDC;
          const swapTarget = addresses.ONE_INCH;

          const underlyingReturnAmount =
            await uniswapV2Integration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            uniswapV2Integration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            uniswapV2Integration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);
          await expect(
            uniswapV2Integration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;
          console.log(`...done`);
        }
      });
    });
  });
});
