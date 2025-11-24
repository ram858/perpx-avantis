# Fund Tracing - $20 USDC Missing

## Transaction History

1. **Transaction 0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a**
   - Time: 16 mins ago
   - Method: "Open Trade"
   - To: Avantis V1.5: Trading Contract
   - Status: Confirmed
   - Issue: Leverage was **100000000000x** (wrong - should be 10x)

2. **Transaction 0x79ae3cc622ec18e23c234035a913a3339b14606bb474046261afe3d44dba7cae**
   - Time: 12 mins ago  
   - Method: "Open Trade"
   - To: Avantis V1.5: Trading Contract
   - Status: Confirmed
   - Issue: Leverage was **100000000000x** (wrong - should be 10x)

## Current Status

- **Wallet Balance**: $0.00 USDC
- **Vault Balance**: $0.00 USDC
- **Positions**: 0 (none created)
- **USDC Allowance**: 49,999,976 USDC (approved but not used)

## What Likely Happened

### Scenario 1: Funds Stuck in Contract (Most Likely)
The transactions were sent to the Avantis Trading contract with invalid leverage (100000000000x). The contract likely:
1. Accepted the USDC transfer (from approval)
2. Rejected the position creation (due to invalid leverage)
3. **Funds may be stuck in the contract** - not returned to wallet or vault

### Scenario 2: Transaction Reverted After Transfer
The contract may have:
1. Transferred USDC from wallet to contract
2. Attempted to create position
3. Reverted due to invalid parameters
4. **Funds may not have been returned** if the revert happened after transfer

### Scenario 3: Funds Used for Fees
- Gas fees: ~$0.001 per transaction (minimal)
- Execution fees: ~0.00000145 ETH per transaction
- **Not enough to account for $20 USDC**

## How to Recover Funds

### Option 1: Check Contract Directly
The funds might be recoverable from the Avantis Trading contract if they're stuck. You would need to:
1. Contact Avantis support
2. Check if there's a withdrawal function
3. Verify if funds are in a recoverable state

### Option 2: Check Transaction Receipts
View the full transaction receipts on Basescan to see:
- Exact status (success/revert)
- Events emitted
- USDC transfers that occurred
- Contract state changes

### Option 3: Contact Avantis
Since the transactions show "Open Trade" but no positions exist, this appears to be a contract-level issue. Avantis support may be able to:
- Verify if funds are in the contract
- Help recover stuck funds
- Explain what happened

## Root Cause

The leverage value was extracted incorrectly from TradeInput:
- **Expected**: 10x
- **Actual**: 100000000000x (100 billion x)

This has been **FIXED** in the code - now using `leverage_override` parameter.

## Prevention

✅ **Fixed**: Leverage now passed directly as parameter
✅ **Fixed**: Code uses manual method (more reliable)
✅ **Fixed**: Better validation before sending transactions

## Next Steps

1. **Add new funds** to test with the fixed code
2. **Contact Avantis** if funds need to be recovered
3. **Verify transaction receipts** on Basescan for exact details
4. **Test again** with corrected leverage (10x) once funds are available

---

**Note**: The transactions were confirmed on-chain, so the funds were definitely sent somewhere. They're likely in the Avantis Trading contract but not showing as a position due to the invalid leverage parameter.

