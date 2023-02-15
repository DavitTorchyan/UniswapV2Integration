// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;


import {CoinStatsBaseV1, SafeERC20, IERC20} from "./CoinStatsBaseV1.sol";
import {IntegrationInterface} from "./IntegrationInterface.sol";

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}


interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amount0, uint256 amount1, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amuntA, uint256 amount1);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 _blockTimestampLast
        );

    function totalSupply() external view returns (uint256);

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes memory data
    ) external;
}

interface IUniswapV2Factory {
    function getPair(
        address token0,
        address token1
    ) external view returns (address);
}

contract UniswapV2Integration is CoinStatsBaseV1, IntegrationInterface {
    using SafeERC20 for IERC20;

    IUniswapV2Router public uniswapV2Router =
        IUniswapV2Router(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IUniswapV2Factory public uniswapV2Factory =
        IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    address immutable WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

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
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
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

    function getSwapAmountOut(
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

    function getBalance(
        address poolAddress,
        address account
    ) public view override returns (uint256) {
        return IERC20(poolAddress).balanceOf(account);
    }

    function _getSwapAmount(
        uint256 r,
        uint256 a
    ) internal pure returns (uint256) {
        return (_sqrt(r * (r * 3988009 + a * 3988000)) - r * 1997) / 1994;
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

        if (entryTokenAddress == address(0)) {
            entryTokenAddress = ETH_ADDRESS;
        }

        entryTokenAmount = _pullTokens(entryTokenAddress, entryTokenAmount);

        entryTokenAmount -= _subtractGoodwill(
            entryTokenAddress,
            entryTokenAmount,
            affiliate,
            true
        );

        entryTokenAmount = _fillQuote(
            entryTokenAddress,
            entryTokenAmount,
            depositTokenAddress,
            swapTarget,
            swapData
        );


        uint256 initialLiquidityBalance = _getBalance(poolAddress);
        uint256 liquidityReceived = _addUniswapV2Liquidity(
            poolAddress,
            depositTokenAddress,
            entryTokenAmount
        );

        require(liquidityReceived >= minExitTokenAmount, "Hight slippage");

        IERC20(poolAddress).safeTransfer(
            msg.sender,
            _getBalance(poolAddress) - initialLiquidityBalance
        );

        emit Deposit(
            msg.sender,
            poolAddress,
            entryTokenAddress,
            entryTokenAmount,
            affiliate
        );
    }


    function _addUniswapV2Liquidity(
        address poolAddress,
        address depositToken,
        uint256 amount
    ) private returns (uint256 lpReceived) {
        address token0 = IUniswapV2Pair(poolAddress).token0();
        address token1 = IUniswapV2Pair(poolAddress).token1();

        address pair = uniswapV2Factory.getPair(token0, token1);

        require(pair != address(0), "Invalid pool address provided");

        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair)
            .getReserves();

        uint256 swapAmount;
        if (token0 == depositToken) {
            swapAmount = _getSwapAmount(reserve0, amount);
            _makeUniswapV2Swap(token0, token1, swapAmount);
        } else {
            swapAmount = _getSwapAmount(reserve1, amount);
            _makeUniswapV2Swap(token1, token0, swapAmount);
        }

        _addLiquidity(token0, token1);

        return _getBalance(poolAddress);
    }

    function _addLiquidity(address token0, address token1) private {
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));

        IERC20(token0).approve(address(uniswapV2Router), bal0);
        IERC20(token1).approve(address(uniswapV2Router), bal1);

        uniswapV2Router.addLiquidity(
            token0,
            token1,
            bal0,
            bal1,
            0,
            0,
            address(this),
            block.timestamp
        );
    }

    function _makeUniswapV2Swap(
        address _from,
        address _to,
        uint256 _amount
    ) private returns (uint256 amountOut) {
        _approveToken(_from, address(uniswapV2Router), _amount);

        address[] memory path = new address[](2);
        path[0] = _from;
        path[1] = _to;

        return
            uniswapV2Router.swapExactTokensForTokens(
                _amount,
                1,
                path,
                address(this),
                block.timestamp
            )[1];
    }

    function _removeUniswapV2Liquidity(
        address poolAddress,
        uint256 liquidityAmount,
        address exitTokenAddress
    ) private returns (uint256 underlyingReceived) {
        address token0 = IUniswapV2Pair(poolAddress).token0();
        address token1 = IUniswapV2Pair(poolAddress).token1();

        require(
            exitTokenAddress == token0 || exitTokenAddress == token1,
            "Invalid exit token"
        );

        (uint256 amount0, uint256 amount1) = uniswapV2Router.removeLiquidity(
            token0,
            token1,
            liquidityAmount,
            0,
            0,
            address(this),
            block.timestamp
        );

        uint256 swapTokenReceived;
        if (exitTokenAddress == token0) {
            swapTokenReceived = _makeUniswapV2Swap(token1, token0, amount1);
        } else {
            swapTokenReceived = _makeUniswapV2Swap(token0, token1, amount0);
        }

        return _getBalance(exitTokenAddress);
    }

    function withdraw(
        address poolAddress,
        uint256 wihdrawLiquidityAmount,
        address exitTokenAddress,
        uint256 minExitTokenAmount,
        address,
        address targetWithdrawTokenAddress,
        address swapTarget,
        bytes calldata swapData,
        address affiliate
    ) external payable override {

        wihdrawLiquidityAmount = _pullTokens(
            poolAddress,
            wihdrawLiquidityAmount
        );

        _approveToken(
            poolAddress,
            address(uniswapV2Router),
            wihdrawLiquidityAmount
        );

        uint256 lpExitTokenAmount = _removeUniswapV2Liquidity(
            poolAddress,
            wihdrawLiquidityAmount,
            targetWithdrawTokenAddress
        );

        uint256 exitTokenAmount = _fillQuote(
            targetWithdrawTokenAddress,
            lpExitTokenAmount,
            exitTokenAddress,
            swapTarget,
            swapData
        );

        require(
            exitTokenAmount >= minExitTokenAmount,
            "Withdraw: High Slippage"
        );

        exitTokenAmount -= _subtractGoodwill(
            exitTokenAddress,
            exitTokenAmount,
            affiliate,
            true
        );

        if (exitTokenAddress == ETH_ADDRESS) {
            (bool success, ) = msg.sender.call{value: exitTokenAmount}("");
            require(
                success,
                "Address: unable to send value, recipient may have reverted"
            );
        } else {
            IERC20(exitTokenAddress).safeTransfer(msg.sender, exitTokenAmount);
        }

        emit Withdraw(
            msg.sender,
            poolAddress,
            exitTokenAddress,
            exitTokenAmount,
            affiliate
        );
    }

    function _fillQuote(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) internal returns (uint256 outputTokensBought) {
        if (swapTarget == address(0)) {
            return inputTokenAmount;
        }

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
            _approveToken(inputTokenAddress, swapTarget, inputTokenAmount);
        }

        uint256 initialOutputTokenBalance = _getBalance(outputTokenAddress);

        // solhint-disable-next-line reason-string
        require(
            approvedTargets[swapTarget],
            "FillQuote: Target is not approved"
        );

        (bool success, ) = swapTarget.call{value: value}(swapData);
        require(success, "FillQuote: Failed to swap tokens");

        outputTokensBought =
            _getBalance(outputTokenAddress) -
            initialOutputTokenBalance;

        // solhint-disable-next-line reason-string
        require(outputTokensBought > 0, "FillQuote: Swapped to invalid token");

        emit FillQuoteSwap(
            swapTarget,
            inputTokenAddress,
            inputTokenAmount,
            outputTokenAddress,
            outputTokensBought
        );
    }

    function removeAssetReturn(
        address poolAddress,
        address exitToken,
        uint256 liquidityAmount
    ) external view override returns (uint256) {
        require(liquidityAmount > 0, "RAR: Zero amount return");

        IUniswapV2Pair pair = IUniswapV2Pair(poolAddress);
        (address _token0, address _token1) = (pair.token0(), pair.token1());

        uint256 _balance0 = IERC20(_token0).balanceOf(poolAddress);
        uint256 _balance1 = IERC20(_token1).balanceOf(poolAddress);

        uint256 _totalSupply = pair.totalSupply();

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        uint256 amount0 = (liquidityAmount * _balance0) / _totalSupply;
        uint256 amount1 = (liquidityAmount * _balance1) / _totalSupply;

        if (exitToken == _token0) {
            return
                getSwapAmountOut(
                    amount1,
                    reserve1 - amount1,
                    reserve0 - amount0
                ) + amount0;
        } else {
            return
                getSwapAmountOut(
                    amount0,
                    reserve0 - amount0,
                    reserve1 - amount1
                ) + amount1;
        }
    }

}
