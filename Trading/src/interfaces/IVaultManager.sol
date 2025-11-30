// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IVaultManager {
    //events
    event GovChanged(address indexed previousGov, address indexed newGov);
    event StorageChanged(address indexed previousStorage, address indexed newStorage);
    event JuniorTrancheChanged(address indexed previousJunior, address indexed newJunior);
    event SeniorTrancheChanged(address indexed previousSenior, address indexed newSenior);
    event ReserveRatioUpdated(uint256 previousRatio, uint256 newRatio);
    event BalancingDeltaUpdated(uint256 previousDelta, uint256 newDelta);
    event ConstrainedLiquidityThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);
    event EarlyWithdrawFeeUpdated(uint256 previousFee, uint256 newFee);
    event RewardsAllocated(uint256 amount, bool isPnl);
    event RewardsDistributed(uint256 juniorRewards, uint256 juniorVeRewards,uint256 seniorRewards, uint256 seniorVeRewards);
    event PnlRewardsDistributed(uint256 juniorRewards, uint256 seniorRewards);
    event USDCSentToTrader(address indexed trader, uint256 amount);
    event USDCReceivedFromTrader(address indexed trader, uint256 amount);
    event BalanceReserved(uint256 amount);
    event BalanceReleased(uint256 amount);
    event TradingContractAdded(address a);
    event TradingContractRemoved(address a);
    event ReferralRebateAwarded(uint amount);
    event NumberUpdated(string name, uint value);
    event CurrentBufferRatioUpdated(int _newBufferRatio);
    event KeeperSet(address keeper);
    event TotalRewardsDecremented(uint256 amount, uint256 newTotalRewards);
    event WithdrawnFromBuffer(address to, uint256 amount);
    event AddedToBuffer(address from, uint256 amount);

    function maxLockTime() external view returns (uint256);

    function minLockTime() external view returns (uint256);

    function earlyWithdrawFee() external view returns (uint256);

    function getBalancingFee(address, bool, uint256) external view returns (uint256);

    function getCollateralFee() external view returns (uint256);

    function gov() external view returns (address);

    function sendUSDCToTrader(address, uint) external;

    function receiveUSDCFromTrader(address, uint) external;

    function currentBalanceUSDC() external view returns (uint256);

    function currentAdjustedBalanceUSDC() external view returns (uint256);

    function allocateRewards(uint256, bool) external;
    
    function decrementPnlRewards(uint256) external;

    function reserveBalance(uint256) external;

    function releaseBalance(uint256) external;

    function sendReferrerRebateToStorage(uint) external;

    function adjustedBalance(uint256 balance) external view returns(uint256);


}
