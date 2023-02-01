// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "./CoinStatsBaseV1.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}

interface ISavingsContractV2 {
    function depositSavings(
        uint256 _amount,
        address _beneficiary
    ) external returns (uint256 creditsIssued);

    function redeemCredits(
        uint256 _amount
    ) external returns (uint256 underlyingReturned);

    function creditsToUnderlying(
        uint256 _underlying
    ) external view returns (uint256 credits);
}

contract Swap is CoinStatsBaseV1 {
    using SafeERC20 for IERC20;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant UNISWAP_V2_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant UNISWAP_V2_FACTORY =
        0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;

    IUniswapV2Router02 public router = IUniswapV2Router02(UNISWAP_V2_ROUTER);
    IUniswapV2Factory public factory = IUniswapV2Factory(UNISWAP_V2_FACTORY);

    constructor(
        uint256 _goodWill,
        uint256 _affiliateSplit,
        address _vaultAddress
    ) CoinStatsBaseV1(_goodWill, _affiliateSplit, _vaultAddress) {
        // 1inch router address
        approvedTargets[0x1111111254fb6c44bAC0beD2854e76F90643097d] = true;
    }

    function getBalance(
        address savingsContractAddress,
        address account
    ) public view returns (uint256) {
        return IERC20(savingsContractAddress).balanceOf(account);
    }

    function getTotalSupply(
        address savingsContractAddress
    ) public view returns (uint256) {
        return IERC20(savingsContractAddress).totalSupply();
    }

    function deposit(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) public payable {
        if (inputTokenAddress != ETH_ADDRESS) {
            IERC20(inputTokenAddress).transferFrom(
                msg.sender,
                address(this),
                inputTokenAmount
            );
        }

        uint256 initialOutputTokenBalance = _getBalance(outputTokenAddress);
        oneInchSwap(
            inputTokenAddress,
            inputTokenAmount,
            outputTokenAddress,
            swapTarget,
            swapData
        );

        uint256 outputTokensBought = _getBalance(outputTokenAddress) -
            initialOutputTokenBalance;
        require(
            outputTokensBought > 0,
            "OneInchSwap: Swapped to invalid token."
        );
    }

    function withdraw(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) public payable {
        oneInchSwap(
            inputTokenAddress,
            inputTokenAmount,
            outputTokenAddress,
            swapTarget,
            swapData
        );
    }

    function oneInchSwap(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) public payable returns (uint256 outputTokensBought) {
        if (inputTokenAddress == outputTokenAddress) {
            return inputTokenAmount;
        }

        if (swapTarget == WETH) {
            if (
                outputTokenAddress == address(0) ||
                outputTokenAddress == ETH_ADDRESS
            ) {
                IWETH(WETH).withdraw(inputTokenAmount);
                return inputTokenAmount;
            } else {
                IWETH(WETH).deposit{value: inputTokenAmount}();
                return inputTokenAmount;
            }
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
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        address lpToken
    ) public {
        IERC20(lpToken).transferFrom(msg.sender, address(this), liquidity);
        IERC20(lpToken).approve(UNISWAP_V2_ROUTER, liquidity);
        if (tokenA == ETH_ADDRESS) {
            router.removeLiquidityETH(
                tokenB,
                liquidity,
                amountBMin,
                amountAMin,
                to,
                deadline
            );
        } else if (tokenB == ETH_ADDRESS) {
            router.removeLiquidityETH(
                tokenA,
                liquidity,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        } else {
            router.removeLiquidity(
                tokenA,
                tokenB,
                liquidity,
                amountAMin,
                amountBMin,
                to,
                deadline
            );
        }
    }
}
