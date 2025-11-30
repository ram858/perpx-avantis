// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IPairStorage {
    
    struct Feed {
        uint maxOpenDeviationP;
        uint maxCloseDeviationP;
        bytes32 feedId;
    }

    struct BackupFeed {
        uint maxDeviationP;
        address feedId;
    }

    struct Leverage {
        uint minLeverage; // Minimun leverage for legacy orderType
        uint maxLeverage; // Maximum leverage for legacy orderType
        uint pnlMinLeverage; // Minimum leverage for pnl Based orderType
        uint pnlMaxLeverage; // Maximum leverage for pnl based orderType
    }

    struct Values {
        int maxGainP;
        int maxSlP;
        uint maxLongOiP;
        uint maxShortOiP;
        uint groupOpenInterestPercentageP;
        uint maxWalletOIP;
        bool isUSDCAligned;
    }

    struct Pair {
        Feed feed;
        BackupFeed backupFeed;
        uint spreadP;
        uint pnlSpreadP;
        Leverage leverages;
        uint priceImpactMultiplier;
        int skewImpactMultiplier;
        uint groupIndex;
        uint feeIndex;
        Values values;
    }

    struct PairParams {
        uint posSpreadCap;
        uint negSpreadCap;
        uint isPnlTypeAllowed;
        uint pnlPriceImpactMultiplier;
        uint pnlSkewImpactMultiplier;
        uint pnlPosSpreadCap;
        uint pnlNegSpreadCap;
        uint minBorrowFee;
        uint maxBorrowFee;
        uint param_8;

    }

    struct AdditionalPairParams{
        uint utilizationThreshold;
        uint borrowFeesMultiplier;
        uint skewThreshold;
        uint param_12;
        uint param_13;
        uint param_14;
        uint param_15;
        uint param_16;
        uint param_17;
        uint param_18;
    }

    struct Group {
        string name;
        uint maxOpenInterestP; 
        bool isSpreadDynamic;
    }

    struct PairData {
        string from;
        string to;
        uint numTiers;
        mapping(uint => uint) openCloseTiersThresholds;
        mapping(uint => uint) openCloseThresholdsTimers;
    }

    struct PnlFees {
        uint numTiers;
        uint[] tierP; // In 1e10 Precision, 1e10 = 1%
        uint[] feesP; // 1e10 = 1%
    }

    struct Fee {
        uint openFeeP;
        uint closeFeeP; 
        uint limitOrderFeeP; 
        uint minLevPosUSDC; 
        PnlFees pnlFees;
    }

    struct SkewFee {
        int[2][10] eqParams;
    }

    // Events
    event PairAdded(uint index, bytes32 feedId);
    event PairUpdated(uint index);
    event PairDelisted(uint index);
    event GroupAdded(uint index, string name);
    event GroupUpdated(uint index);
    event FeeAdded(uint index);
    event FeeUpdated(uint index);
    event SkewFeeAdded(uint index);
    event SkewFeeUpdated(uint index);
    event LossProtectionAdded(uint pairIndex, uint[] tier, uint[] multiplier);
    event BlockOILimitsSet(uint[] pairIndex, uint[] limits);
    event OrderLimitsSet(uint[] pairIndex, uint[] limits);
    event PairParamsUpdated(PairParams params);
    event AdditionalPairParamsUpdated(AdditionalPairParams params);
    event PairDataUpdated(uint pairIndex, string from, string to, uint numTiers, uint[] tierthresholds, uint[] timers); 
    event OIMultiplierUpdated(uint256 multiplier);

    function updateGroupOI(uint, uint, bool, bool) external;

    function pairJob(uint) external returns (string memory from, string memory to, bytes32, address, uint);

    function pairGroupIndex(uint) external view returns (uint);

    function pairFeed(uint) external view returns (Feed memory);

    function pairBackupFeed(uint) external view returns (BackupFeed memory);

    function pairSpreadP(uint, bool) external view returns (uint);

    function pairSpreadP(uint) external view returns (uint);
    function pairMinLeverage(uint, bool) external view returns (uint);

    function pairMaxLeverage(uint, bool) external view returns (uint);

    function pairMinLeverage(uint) external view returns (uint);
    function pairMaxLeverage(uint) external view returns (uint);


    function groupMaxOI(uint) external view returns (uint);

    function groupOI(uint) external view returns (uint);

    function guaranteedSlEnabled(uint) external view returns (bool);

    function pairLimitOrderFeeP(uint) external view returns (uint);

    function pairOpenFeeP(uint, uint, bool) external view returns (uint);

    function pairCloseFeeP(uint) external view returns (uint);

    function pairMinLevPosUSDC(uint) external view returns (uint);

    function lossProtectionMultiplier(uint _pairIndex, uint _tier) external view returns (uint);

    function maxWalletOI(uint _pairIndex) external view returns (uint);

    function pairMaxOI(uint _pairIndex) external view returns (uint);

    function pairsCount() external view returns (uint);

    function blockOILimit(uint _pairIndex) external view returns(uint);

    function isUSDCAligned(uint _pairIndex) external view returns(bool);

    function pairPriceImpactMultiplier(uint _pairIndex) external view returns(uint);

    function pairSkewImpactMultiplier(uint _pairIndex) external view returns(int);

    function pairPriceImpactMultiplier(uint _pairIndex, bool isPnl) external view returns(uint);

    function pairSkewImpactMultiplier(uint _pairIndex, bool isPnl) external view returns(int);

    function isPnlOrderTypeAllowed(uint _pairIndex) external view returns(bool);

    function isDynamicSpreadEnabled(uint _pairIndex) external view returns(bool);

    function openCloseThreshold(uint _pairIndex, uint256 _leveragePos) external view returns(uint256);

    function storePosType(address trader, uint pairIndex, uint index, bool isPnl) external;

    function resetPosType(address trader, uint pairIndex, uint index) external;

    function getPosType(address trader, uint pairIndex, uint index) external view returns(bool);

    function pairMaxLongOI(uint _pairIndex) external view returns (uint);

    function pairMaxShortOI(uint _pairIndex) external view returns (uint);

    function getPnlBasedFee(uint pairIndex, uint collateral, int percentProfit) external view returns(uint);

    function correctTp(uint openPrice, uint leverage, uint tp, bool buy, uint pairIndex) external view returns(uint);

    function correctSl(uint openPrice, uint leverage, uint sl, bool buy, uint pairIndex) external view returns (uint);

    function currentPercentProfit(
        uint openPrice,
        uint currentPrice,
        bool buy,
        uint leverage,
        uint pairIndex
    ) external view returns (int p);

    function spreadCaps(uint _pairIndex, bool isPnl) external view returns(uint,uint);

    function maxProfitP(uint pairIndex) external view returns(int);

    function minBorrowFee(uint _pairIndex) external view returns(uint);

    function maxBorrowFee(uint _pairIndex) external view returns(uint);
    
    function getOIMultiplier() external view returns(uint256);

    function pairUtililizationThreshold(uint _pairIndex) external view returns(uint);

    function pairBorrowFeesMultiplier(uint _pairIndex) external view returns(uint);

    function pairSkewThreshold(uint _pairIndex) external view returns(uint);
}