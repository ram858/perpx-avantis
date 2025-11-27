# CRITICAL FIX: Wallet Address Mismatch When Starting Positions

## Problem

When starting a trading position, funds are going to `0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F` instead of the correct trading wallet `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`.

## Root Cause

The issue is that when `ensureTradingWallet()` is called, it might be:
1. Returning a wallet with a private key that doesn't match the stored address
2. Or the database has the wrong private key stored for the wallet address

## What We Fixed

1. ✅ Updated `getWallet()` to filter by `wallet_type` when multiple wallets exist
2. ✅ Added verification in trading start endpoint to ensure private key matches wallet address
3. ✅ Added error handling to prevent funds from going to wrong address

## Verification Added

The trading start endpoint now:
- Verifies that the private key derives to the correct wallet address
- Rejects the request if there's a mismatch
- Logs detailed error information for debugging

## Next Steps

1. **Test the fix**: Try starting a trading session and check the logs
2. **Check database**: Verify that the private key stored for your trading wallet is correct
3. **If mismatch found**: Update the database with the correct private key for `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`

## How to Check Database

```sql
-- Check what private key is stored for your trading wallet
SELECT 
  address, 
  encrypted_private_key, 
  iv, 
  wallet_type,
  created_at
FROM wallets 
WHERE fid = 1464243 
AND chain = 'ethereum'
AND wallet_type = 'trading';
```

Then decrypt the private key and verify it derives to `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`.

## If Funds Are Stuck

If funds are in `0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F`:
1. Find the private key for that address (check all wallet records)
2. Transfer funds to correct wallet: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`
3. Update database to ensure correct private key is stored

