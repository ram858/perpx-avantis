// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPriceAggregator.sol";
import "./IVaultManager.sol";
import "./IPausable.sol";
import "./ICallbacks.sol";

interface ITradingStorage {

    enum LimitOrder{
        TP,
        SL,
        LIQ,
        OPEN
    }

    enum updateType{
        DEPOSIT,
        WITHDRAW
    }

    struct Trader{
        uint leverageUnlocked;
        address referral;
        uint referralRewardsTotal; 
    }

    struct Trade{
        address trader;
        uint pairIndex;
        uint index;
        uint initialPosToken; 
        uint positionSizeUSDC; 
        uint openPrice; 
        bool buy;
        uint leverage;
        uint tp; 
        uint sl; 
        uint timestamp;
    }

    struct TradeInfo{
        uint openInterestUSDC; 
        uint tpLastUpdated;
        uint slLastUpdated;
        bool beingMarketClosed;
        uint lossProtection;
    }

    struct OpenLimitOrder{
        address trader;
        uint pairIndex;
        uint index;
        uint positionSize;
        bool buy;
        uint leverage;
        uint tp; 
        uint sl; 
        uint price; 
        uint slippageP;
        uint block;
        uint executionFee;
    }

    struct PendingMarketOrder{
        Trade trade;
        uint block;
        uint wantedPrice; 
        uint slippageP; 
    }

    struct PendingLimitOrder{
        address trader;
        uint pairIndex;
        uint index;
        LimitOrder orderType;
    }

    event SupportedTokenAdded(address a);
    event TradingContractAdded(address a);
    event TradingContractRemoved(address a);
    event AddressUpdated(string name, address a);
    event NumberUpdated(string name, uint value);
    event NumberUpdatedPair(string name, uint pairIndex, uint value);
    event TradeReferred(
        address _trader, 
        address _referrer, 
        uint _leveragedPosition, 
        uint _traderFeePostDiscount, 
        uint _startingFees,
        uint _referrerRebate,
        uint _pairIndex
    );
    event FeesCharged(address _trader, uint _pairIndex, bool _buy, uint fee);
    event OIUpdated(
        bool _open,
        bool _long, 
        uint _pairIndex,
        uint _leveragedPos,
        uint _price
    );
    
    event MarketOpenCanceled(
        uint orderId, 
        address indexed trader, 
        uint pairIndex
    );

    event FeesClaimed(address govTreasury, uint govFees, address devTreasury, uint256 devFees);
    event RebateClaimed(address referrer, uint amount);
    event FeesDecremented(uint256 devAmount, uint256 govAmount);
    
    function gov() external view returns (address);

    function dev() external view returns (address);

    function usdc() external view returns (IERC20);

    function priceAggregator() external view returns (IPriceAggregator);

    function vaultManager() external view returns (IVaultManager);

    function trading() external view returns (address);

    function callbacks() external view returns (address);

    function transferUSDC(address, address, uint) external;

    function unregisterTrade(address, uint, uint) external;

    function registerPartialTrade(address, uint, uint, uint) external;

    function unregisterPendingMarketOrder(uint, bool) external;

    function unregisterOpenLimitOrder(address, uint, uint) external;

    function hasOpenLimitOrder(address, uint, uint) external view returns (bool);

    function storePendingMarketOrder(PendingMarketOrder memory, uint, bool) external;

    function openTrades(address, uint, uint) external view returns (Trade memory);

    function openTradesInfo(address, uint, uint) external view returns (TradeInfo memory);

    function updateSl(address, uint, uint, uint) external;

    function updateTp(address, uint, uint, uint) external returns(uint);

    function getOpenLimitOrder(address, uint, uint) external view returns (OpenLimitOrder memory);

    function reqIDpendingLimitOrder(uint) external view returns (PendingLimitOrder memory);

    function storeOpenLimitOrder(OpenLimitOrder memory) external;

    function reqIDpendingMarketOrder(uint) external view returns (PendingMarketOrder memory);

    function storePendingLimitOrder(PendingLimitOrder memory, uint) external;

    function updateOpenLimitOrder(OpenLimitOrder calldata) external;

    function firstEmptyTradeIndex(address, uint) external view returns (uint);

    function firstEmptyOpenLimitIndex(address, uint) external view returns (uint);

    function updateTrade(Trade memory) external;

    function unregisterPendingLimitOrder(uint) external;

    function handleDevGovFees(address, uint, uint, bool, bool, bool) external returns (uint);

    function storeTrade(Trade memory, TradeInfo memory, bool) external;

    function openLimitOrdersCount(address, uint) external view returns (uint);

    function openTradesCount(address, uint) external view returns (uint);

    function pendingMarketOpenCount(address, uint) external view returns (uint);

    function pendingMarketCloseCount(address, uint) external view returns (uint);

    function maxTradesPerPair() external view returns (uint);

    function pendingOrderIdsCount(address) external view returns (uint);

    function maxPendingMarketOrders() external view returns (uint);

    function totalOI() external view returns (uint);

    function openInterestUSDC(uint, uint) external view returns (uint);

    function pairOI(uint _pairIndex) external view returns (uint);

    function getPendingOrderIds(address) external view returns (uint[] memory);

    function applyReferralAndPnlFee(address, uint, uint, bool, uint, int ,uint) external returns (uint, uint);

    function walletOI(address _trader) external view returns (uint);

    function maxOpenInterest() external view returns (uint);

    function getUsdOI() external view returns(uint[2] memory);

    function forceUnregisterPendingMarketOrder(uint _id) external;

    function incrementClosingFees(uint, uint) external;

    function isValidOI(uint pairIndex, bool buy, uint leveragedPos) external view returns(bool);

    function withinExposureLimits(address _trader, uint _pairIndex, uint _leveragedPos, bool _buy) external view returns (bool);
}
