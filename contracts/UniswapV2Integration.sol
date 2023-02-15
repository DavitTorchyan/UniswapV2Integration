// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./CoinStatsBaseV1.sol";
import "./Vault.sol";
import "contracts/IntegrationInterface.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "hardhat/console.sol";

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}

contract UniswapV2Integration is CoinStatsBaseV1, IntegrationInterface {
    using SafeERC20 for IERC20;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant UNISWAP_V2_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant UNISWAP_V2_FACTORY =
        0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address constant usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    mapping(address => mapping(address => uint256)) public liquidity;

    IUniswapV2Router02 public router = IUniswapV2Router02(UNISWAP_V2_ROUTER);
    IUniswapV2Factory public factory = IUniswapV2Factory(UNISWAP_V2_FACTORY);

    struct DepositData {
        uint256 initialOutputTokenBalance;
        uint256 outputTokensBought;
        address depositTokenAddress2;
    }

    struct WithdrawData {
        address targetWithdrawTokenAddress2;
        uint256 exitToken1AmountBefore;
        uint256 exitToken2AmountBefore;
        uint256 exitToken1Amount;
        uint256 exitToken2Amount;
        uint256 outputTokenAmount;
    }

    event Deposit(
        address indexed from,
        address indexed pool,
        address token,
        uint256 amount,
        address affiliate
    );

    event Withdraw(
        address indexed from,
        address indexed pool,
        address token,
        uint256 amount,
        address affiliate
    );

    event FillQuoteSwap(
        address swapTarget,
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        uint256 outputTokenAmount
    );

    constructor(
        uint256 _goodWill,
        uint256 _affiliateSplit,
        address _vaultAddress
    ) CoinStatsBaseV1(_goodWill, _affiliateSplit, _vaultAddress) {
        // 1inch router address
        approvedTargets[0x1111111254fb6c44bAC0beD2854e76F90643097d] = true;
        // for testing purposes affiliate is this contract itself
        affiliates[address(this)] = true;
    }

    function getBalance(
        address token,
        address account
    ) public view override returns (uint256) {
        return IERC20(token).balanceOf(account);
    }

    function getTotalSupply(address token) public view returns (uint256) {
        return IERC20(token).totalSupply();
    }

    function deposit(
        address entryTokenAddress,
        uint256 entryTokenAmount,
        address poolAddress,
        address depositTokenAddress,
        uint256 minExitTokenAmount,
        address,
        address,
        address swapTarget,
        bytes calldata swapData,
        address affiliate
    ) external payable override {
        DepositData memory depositData;

        if (entryTokenAddress != ETH_ADDRESS) {
            _pullTokens(entryTokenAddress, entryTokenAmount);
        }

        entryTokenAmount =
            entryTokenAmount -
            _subtractGoodwill(
                entryTokenAddress,
                entryTokenAmount,
                affiliate,
                true
            );

        depositData.initialOutputTokenBalance = _getBalance(
            depositTokenAddress
        );

        fillQuote(
            entryTokenAddress,
            entryTokenAmount,
            depositTokenAddress,
            swapTarget,
            swapData
        );

        depositData.outputTokensBought =
            _getBalance(depositTokenAddress) -
            depositData.initialOutputTokenBalance;

        if (IUniswapV2Pair(poolAddress).token0() == depositTokenAddress) {
            depositData.depositTokenAddress2 = IUniswapV2Pair(poolAddress)
                .token1();
        } else {
            depositData.depositTokenAddress2 = IUniswapV2Pair(poolAddress)
                .token0();
        }

        _deposit(
            depositTokenAddress,
            depositData.depositTokenAddress2,
            depositData.outputTokensBought,
            minExitTokenAmount
        );

        emit Deposit(
            msg.sender,
            poolAddress,
            entryTokenAddress,
            entryTokenAmount,
            affiliate
        );
    }

    function _deposit(
        address depositTokenAddress1,
        address depositTokenAddress2,
        uint256 outputTokensBought,
        uint256 minExitTokenAmount
    ) public payable {
        uint256 token2BalanceBefore = _getBalance(depositTokenAddress2);

        address pair = factory.getPair(
            depositTokenAddress1,
            depositTokenAddress2
        );

        uint256 reserve = IERC20(depositTokenAddress1).balanceOf(pair);
        uint256 tokenToTokenAmount = tokenToTokenSwapAmount(
            reserve,
            outputTokensBought
        );

        _approveToken(depositTokenAddress1, UNISWAP_V2_ROUTER);
        _approveToken(depositTokenAddress2, UNISWAP_V2_ROUTER);

        address[] memory path = new address[](2);
        path[0] = depositTokenAddress1;
        path[1] = depositTokenAddress2;

        router.swapExactTokensForTokens(
            tokenToTokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );

        uint256 token2BalanceAfter = _getBalance(depositTokenAddress2) -
            token2BalanceBefore;

        (, , uint256 exitTokenAmount) = router.addLiquidity(
            depositTokenAddress1,
            depositTokenAddress2,
            _getBalance(depositTokenAddress1),
            token2BalanceAfter,
            0,
            0,
            msg.sender,
            block.timestamp
        );

        require(
            exitTokenAmount >= minExitTokenAmount,
            "Deposit: Minimum amount of exit tokens not received!"
        );
    }

    function sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function tokenToTokenSwapAmount(
        uint256 reserve,
        uint256 amount
    ) public pure returns (uint256) {
        return
            (sqrt(reserve * (reserve * 3988009 + amount * 3988000)) -
                reserve *
                1997) / 1994;
    }

    function withdraw(
        address poolAddress,
        uint256 entryTokenAmount,
        address exitTokenAddress,
        uint256 minExitTokenAmount,
        address,
        address targetWithdrawTokenAddress,
        address swapTarget,
        bytes calldata swapData,
        address affiliate
    ) external payable override {
        WithdrawData memory withdrawData;

        if (
            targetWithdrawTokenAddress == IUniswapV2Pair(poolAddress).token0()
        ) {
            withdrawData.targetWithdrawTokenAddress2 = IUniswapV2Pair(
                poolAddress
            ).token1();
        } else {
            withdrawData.targetWithdrawTokenAddress2 = IUniswapV2Pair(
                poolAddress
            ).token0();
        }

        withdrawData.exitToken1AmountBefore = _getBalance(
            targetWithdrawTokenAddress
        );
        withdrawData.exitToken2AmountBefore = _getBalance(
            withdrawData.targetWithdrawTokenAddress2
        );

        _withdraw(
            targetWithdrawTokenAddress,
            withdrawData.targetWithdrawTokenAddress2,
            poolAddress,
            entryTokenAmount
        );

        withdrawData.exitToken1Amount =
            _getBalance(targetWithdrawTokenAddress) -
            withdrawData.exitToken1AmountBefore;
        withdrawData.exitToken2Amount =
            _getBalance(withdrawData.targetWithdrawTokenAddress2) -
            withdrawData.exitToken2AmountBefore;

        if (exitTokenAddress == targetWithdrawTokenAddress) {
            withdrawData.exitToken1Amount =
                withdrawData.exitToken1Amount -
                _subtractGoodwill(
                    targetWithdrawTokenAddress,
                    withdrawData.exitToken1Amount,
                    affiliate,
                    true
                );

            require(
                withdrawData.exitToken1Amount >= minExitTokenAmount,
                "Withdraw: Minimum amount of tokens not received!"
            );

            IERC20(targetWithdrawTokenAddress).safeTransfer(
                msg.sender,
                withdrawData.exitToken1Amount
            );

            emit Withdraw(
                msg.sender,
                poolAddress,
                targetWithdrawTokenAddress,
                withdrawData.exitToken2Amount,
                affiliate
            );
        } else {
            withdrawData.exitToken1Amount =
                withdrawData.exitToken1Amount -
                _subtractGoodwill(
                    targetWithdrawTokenAddress,
                    withdrawData.exitToken1Amount,
                    affiliate,
                    true
                );

            require(
                withdrawData.exitToken1Amount >= minExitTokenAmount,
                "Withdraw: Minimum amount of tokens not received!"
            );

            fillQuote(
                targetWithdrawTokenAddress,
                withdrawData.exitToken1Amount,
                exitTokenAddress,
                swapTarget,
                swapData
            );

            withdrawData.outputTokenAmount = _getBalance(exitTokenAddress);

            emit Withdraw(
                msg.sender,
                poolAddress,
                targetWithdrawTokenAddress,
                withdrawData.exitToken1Amount,
                affiliate
            );
        }
    }

    function _withdraw(
        address exitToken1Address,
        address exitToken2Address,
        address lpTokenAddress,
        uint256 entryTokenAmount
    ) internal {
        uint256 exitToken2AmountBefore = _getBalance(exitToken2Address);

        _approveToken(lpTokenAddress, UNISWAP_V2_ROUTER);

        removeLiquidity(
            exitToken1Address,
            exitToken2Address,
            entryTokenAmount,
            0,
            0,
            address(this),
            block.timestamp,
            lpTokenAddress
        );

        uint256 exitToken2Amount = _getBalance(exitToken2Address) -
            exitToken2AmountBefore;

        address[] memory path = new address[](2);

        _approveToken(exitToken2Address, UNISWAP_V2_ROUTER);
        path[0] = exitToken2Address;
        path[1] = exitToken1Address;
        router.swapExactTokensForTokens(
            exitToken2Amount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function fillQuote(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) public payable returns (uint256 outputTokensBought) {
        if (inputTokenAddress == outputTokenAddress) {
            return inputTokenAmount;
        }

        uint256 value;
        if (inputTokenAddress == ETH_ADDRESS) {
            value = inputTokenAmount;
        } else {
            _approveToken(inputTokenAddress, swapTarget);
        }

        uint256 initialOutputTokenBalance = _getBalance(outputTokenAddress);

        require(
            approvedTargets[swapTarget],
            "OneInchSwap: Target not approved."
        );

        (bool success, ) = swapTarget.call{value: value}(swapData);
        require(success, "OneInchSwap: Failed to swap tokens.");

        outputTokensBought =
            _getBalance(outputTokenAddress) -
            initialOutputTokenBalance;

        emit FillQuoteSwap(
            swapTarget,
            inputTokenAddress,
            inputTokenAmount,
            outputTokenAddress,
            outputTokensBought
        );
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public payable {
        if (tokenA == ETH_ADDRESS) {
            IERC20(tokenB).approve(UNISWAP_V2_ROUTER, amountBDesired);
            router.addLiquidityETH{value: msg.value}(
                tokenB,
                amountBDesired,
                amountBMin,
                amountAMin,
                to,
                deadline
            );
        } else if (tokenB == ETH_ADDRESS) {
            IERC20(tokenA).approve(UNISWAP_V2_ROUTER, amountADesired);
            router.addLiquidityETH{value: msg.value}(
                tokenA,
                amountADesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        } else {
            IERC20(tokenA).approve(UNISWAP_V2_ROUTER, amountADesired);
            IERC20(tokenB).approve(UNISWAP_V2_ROUTER, amountBDesired);
            router.addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidityAB,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        address lpToken
    ) public {
        IERC20(lpToken).transferFrom(msg.sender, address(this), liquidityAB);
        IERC20(lpToken).approve(UNISWAP_V2_ROUTER, liquidityAB);
        if (tokenA == ETH_ADDRESS) {
            router.removeLiquidityETH(
                tokenB,
                liquidityAB,
                amountBMin,
                amountAMin,
                to,
                deadline
            );
        } else if (tokenB == ETH_ADDRESS) {
            router.removeLiquidityETH(
                tokenA,
                liquidityAB,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        } else {
            router.removeLiquidity(
                tokenA,
                tokenB,
                liquidityAB,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        }
    }

    function removeAssetReturn(
        address poolAddress,
        address exitToken,
        uint256 liquidityAmount
    ) external view override returns (uint256) {
        IUniswapV2Pair pair = IUniswapV2Pair(poolAddress);
        address token1 = pair.token1();

        uint256 totalPairLiquidity = pair.totalSupply();

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        uint256 amount0 = (reserve0 * liquidityAmount) / totalPairLiquidity;
        uint256 amount1 = (reserve1 * liquidityAmount) / totalPairLiquidity;

        if (exitToken == token1) {
            amount1 += getAmountOut(
                amount0,
                reserve0 - amount0,
                reserve1 - amount1
            );
            return amount1;
        } else {
            amount0 += getAmountOut(
                amount1,
                reserve1 - amount1,
                reserve0 - amount0
            );
            return amount0;
        }
    }

    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        require(amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
        );
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
