# Investigation: Automatic Position Opening After Deposit

## Issue Summary
- **Date**: 2025-11-27
- **Problem**: USDC transferred from Farcaster wallet to trading wallet was automatically used to open a position without user initiating a trade
- **Amount**: $10 transferred + $1 existing = $11 USDC total
- **Transaction Hash**: `0x0c281560193b5b8c9555bc06f21b3d1e9ef8f2ccb93dd2c9dc82522449e3a857`
- **Trading Wallet PK**: `0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e`

## Code Analysis

### ✅ Deposit Endpoint (app/api/wallet/deposit/route.ts)
- **Status**: SAFE - Only creates transfer transaction
- **Behavior**: Does NOT trigger any trading logic
- **Conclusion**: Deposit endpoint is not the cause

### ✅ Trading Start Endpoint (app/api/trading/start/route.ts)
- **Status**: Requires explicit API call with config
- **Behavior**: Only starts trading when `/api/trading/start` is called with trading parameters
- **Conclusion**: Not automatically triggered by deposits

### ⚠️ Potential Causes

1. **Active Trading Session**
   - If a trading session was already running, it may have automatically used the new funds
   - Check if there's an active session that was waiting for funds

2. **Auto-Deposit to Vault Logic** (`avantis-service/contract_operations.py`)
   - The `deposit_to_vault_if_needed` function auto-deposits wallet funds to Avantis vault
   - This is called during position opening, not during deposits
   - However, if a position opening was in progress when funds arrived, it could use them

3. **Background Trading Process**
   - Check if there's a background process or cron job running
   - Check server logs for any automatic trading activity

## Investigation Steps

### 1. Check Transaction Details
```bash
# View the transaction on BaseScan
https://basescan.org/tx/0x0c281560193b5b8c9555bc06f21b3d1e9ef8f2ccb93dd2c9dc82522449e3a857
```

Look for:
- What contract was called?
- What function was executed?
- Was it a simple USDC transfer or did it call a trading contract?

### 2. Check for Active Trading Sessions
```bash
# Check if there are any active trading sessions
curl -X GET "http://localhost:3000/api/trading/sessions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Check Server Logs
Look for:
- Any automatic position opening around the time of deposit
- Any background jobs or cron tasks
- Any trading session that was active

### 4. Check Avantis Contract Events
The transaction might show:
- A position was opened via Avantis contract
- Check the transaction's internal transactions
- Look for any contract calls after the USDC transfer

## Immediate Actions

1. **Check Active Sessions**: Verify if there's an active trading session
2. **Review Transaction**: Examine the BaseScan transaction to see what actually happened
3. **Check Logs**: Review server logs around the time of deposit
4. **Verify Position**: Check if a position was actually opened and with what parameters

## Prevention Measures

1. **Add Deposit Confirmation**: Require explicit confirmation before deposits
2. **Disable Auto-Trading on Deposit**: Ensure deposits never trigger trades
3. **Add Balance Checks**: Verify balance before allowing trading
4. **Session State Check**: Ensure no active sessions can use new deposits automatically

## Next Steps

1. Analyze the transaction hash to understand what happened
2. Check for any active trading sessions
3. Review server logs
4. Implement safeguards to prevent automatic trading on deposits

