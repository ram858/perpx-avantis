// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import {ITradingStorage} from "./ITradingStorage.sol";

interface IPairInfos {

    struct PairParams {
        uint onePercentDepthAbove; // USDC
        uint onePercentDepthBelow; // USDC
        uint rolloverFeePerBlockP; // PRECISION
    }

    // Pair acc rollover fees
    struct PairRolloverFees {
        uint accPerOiLong; // 1e6 (USDC)
        uint accPerOiShort; // 1e6 (USDC)
        uint lastUpdateBlock;
    }


    struct TradeInitialAccFees {
        uint rollover; // 1e6 (USDC)
        bool openedAfterUpdate;
    }


    event ManagerUpdated(address value);
    event MaxNegativePnlOnOpenPUpdated(uint value);
    event MultiplierUpdated(uint minMultiplierRate, uint maxMultiplierRate, uint groupId);
    event CoeffUpdated(uint multiplierCoeffMax, uint groupId);
    event DenomUpdated(uint multiplierDenom, uint groupId);
    event PairParamsUpdated(uint pairIndex, PairParams value);
    event OnePercentDepthUpdated(uint pairIndex, uint valueAbove, uint valueBelow);
    event RolloverFeePerBlockPUpdated(uint pairIndex, uint fee);
    event TradeInitialAccFeesStored(address trader, uint pairIndex, uint index, uint rollover);
    event AccRolloverFeesStored(uint pairIndex, uint valueLong, uint valueShort);
    event LiqThresholdUpdated(uint newThreshold);
    event FeesCharged(
        bool buy,
        uint collateral, 
        uint leverage,
        int percentProfit,
        uint r,
        uint closingFee,
        uint lossProtection
    );

    event KeeperUpdated(address keeper);
    event LossProtectionConfigSet(uint numTiers, uint[] longSkewConfig, uint[] shortSkewConfig);
    event PairStorageUpdated(address newPairStorage);
    
    function storeTradeInitialAccFees(address trader, uint pairIndex, uint index, bool long) external;

    function getTradePriceImpact(
        uint openPrice, 
        uint pairIndex,
        bool long,
        uint openInterest,
        bool isPnl
    )   
        external 
        view
        returns (
            uint priceAfterImpact 
        );

    function getTradeLiquidationPrice(
        address trader,
        uint pairIndex,
        uint index,
        uint openPrice, 
        bool long,
        uint collateral, 
        uint leverage
    ) external view returns (uint);

    function getTradeValue(
        ITradingStorage.Trade memory _trade,
        uint collateral,
        int percentProfit, 
        uint closingFee
    ) external returns (uint, int, uint); 

    // Funding fee value
    function getTradeRolloverFee(
        address trader,
        uint pairIndex,
        uint index,
        bool long,
        uint collateral, 
        uint leverage
    ) external view returns (uint);
  
    function lossProtectionTier(ITradingStorage.Trade memory _trade, bool _isPnl) external view returns (uint _tier);

    function resetTradeInitialAccess(address trader, uint pairIndex, uint index) external;
}
