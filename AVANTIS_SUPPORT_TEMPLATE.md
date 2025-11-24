# Avantis Support Request - Stuck Funds Recovery

## Subject
**Funds Stuck in Trading Contract - Position Creation Failed**

---

## Message Template

Hello Avantis Support Team,

I am writing to request assistance with funds that appear to be stuck in the Avantis Trading contract after failed position opening attempts.

### Issue Summary
I attempted to open trading positions on Avantis, but the transactions succeeded in transferring USDC to the contract while failing to create the actual positions. The funds are now in the contract but not accessible through normal means.

### Wallet Details
- **Wallet Address**: `0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5`
- **Network**: Base Mainnet
- **Amount Stuck**: $24.00 USDC (two transactions of $12.00 each)

### Transaction Details

**Transaction 1:**
- **Hash**: `0x79ae3cc622ec18e23c234035a913a3339b14606bb474046261afe3d44dba7cae`
- **Block**: 38599764
- **Status**: SUCCESS
- **USDC Transferred**: $12.00
- **To Contract**: `0x8a311d7048c35985aa31c131b9a13e03a5f7422d`
- **Method**: Open Trade
- **Issue**: Position creation failed due to invalid leverage parameter (100000000000x instead of intended 10x)

**Transaction 2:**
- **Hash**: `0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a`
- **Block**: 38599654
- **Status**: SUCCESS
- **USDC Transferred**: $12.00
- **To Contract**: `0x8a311d7048c35985aa31c131b9a13e03a5f7422d`
- **Method**: Open Trade
- **Issue**: Position creation failed due to invalid leverage parameter (100000000000x instead of intended 10x)

### What Happened
1. I initiated two "Open Trade" transactions to open positions on Avantis
2. Both transactions were confirmed on-chain (status: SUCCESS)
3. USDC was successfully transferred to the Avantis Trading contract (`0x8a311d7048c35985aa31c131b9a13e03a5f7422d`)
4. However, the positions were not created due to an invalid leverage parameter in the transaction data
5. The funds are now in the contract but:
   - Not showing in my Avantis vault balance
   - Not showing in my wallet balance
   - Not associated with any open positions
   - Not recoverable through standard withdrawal functions

### Current Status
- **Vault Balance**: $0.00 USDC
- **Wallet Balance**: $0.00 USDC
- **Open Positions**: 0
- **Contract Address**: `0x8a311d7048c35985aa31c131b9a13e03a5f7422d`

### Verification
You can verify the USDC transfers by checking the transaction receipts:
- Both transactions show successful USDC Transfer events
- Funds were transferred from my wallet to the contract address
- No positions were created (verified via SDK `get_trades()` returning 0 positions)

### Request
I would appreciate assistance in:
1. Verifying that the funds are indeed in the contract
2. Recovering the $24.00 USDC back to my wallet (`0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5`)
3. Understanding if there's a way to prevent this in the future

### Additional Information
- I have checked for standard withdrawal functions in the Trading contract but none were found
- The issue was caused by a bug in my trading application that incorrectly extracted leverage values
- This bug has since been fixed, but the funds from these earlier transactions remain stuck

Thank you for your assistance. Please let me know if you need any additional information.

Best regards,
[Your Name]

---

## Contact Information

**Avantis Support Channels:**
- **Discord**: [Avantis Discord Server]
- **Email**: [Support Email if available]
- **Twitter/X**: [@AvantisFi]
- **Website**: https://avantisfi.com

**Block Explorer Links:**
- Transaction 1: https://basescan.org/tx/0x79ae3cc622ec18e23c234035a913a3339b14606bb474046261afe3d44dba7cae
- Transaction 2: https://basescan.org/tx/0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a
- Wallet: https://basescan.org/address/0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5
- Contract: https://basescan.org/address/0x8a311d7048c35985aa31c131b9a13e03a5f7422d

---

## Quick Copy-Paste Version

```
Subject: Funds Stuck in Trading Contract - Position Creation Failed

Hello Avantis Support Team,

I am writing to request assistance with funds that appear to be stuck in the Avantis Trading contract after failed position opening attempts.

Issue Summary:
- Wallet: 0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5
- Amount: $24.00 USDC (two transactions of $12.00 each)
- Network: Base Mainnet

Transaction Details:
1. TX: 0x79ae3cc622ec18e23c234035a913a3339b14606bb474046261afe3d44dba7cae
   - Status: SUCCESS
   - $12.00 USDC transferred to: 0x8a311d7048c35985aa31c131b9a13e03a5f7422d
   - Position creation failed (invalid leverage)

2. TX: 0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a
   - Status: SUCCESS
   - $12.00 USDC transferred to: 0x8a311d7048c35985aa31c131b9a13e03a5f7422d
   - Position creation failed (invalid leverage)

Current Status:
- Vault Balance: $0.00
- Wallet Balance: $0.00
- Open Positions: 0
- Funds verified in contract via transaction receipts

Request: Please help recover the $24.00 USDC back to my wallet.

Thank you for your assistance.
```

