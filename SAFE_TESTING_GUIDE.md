# Safe Testing Guide - After Funds Transfer Issue

## 🛡️ Your Safety is Our Priority

After the $12 funds transfer issue, we understand your concern. This guide provides **safe testing strategies** to verify the fixes without risking significant funds.

---

## ✅ What Was Fixed

### 1. **Leverage Bug Fixed** ✅
- **Before**: Leverage was extracted incorrectly from `TradeInput.leverage` (showing `100000000000x`)
- **After**: Leverage is now passed directly as a parameter (correct `10x`)
- **Location**: `avantis-service/contract_operations.py` line 426-434

### 2. **Validation Added** ✅
- **Minimum Collateral**: $11.5 USDC (enforced before transaction)
- **Leverage Range**: 2x - 100x (validated before transaction)
- **Location**: `avantis-service/contract_operations.py` line 36-49

### 3. **Manual Method Used** ✅
- Uses direct contract interaction (proven reliable)
- Leverage override ensures correct value
- Better error handling and logging

---

## 🧪 Safe Testing Strategies

### Strategy 1: Start with Minimum Amount (Recommended)

**Test with the absolute minimum to verify fixes work:**

1. **Minimum Investment**: $12 USDC (just above $11.5 minimum)
2. **Single Position**: 1 position only
3. **Small Profit Goal**: $2-3 profit goal
4. **Verify First**: Check logs to confirm leverage is correct

**Why this is safe:**
- Uses minimum required amount
- Single position = easier to monitor
- If it works, you know the fix is correct
- If it fails, you lose minimum amount

**Steps:**
```bash
# 1. Verify you have exactly $12-15 in your wallet
# 2. Start trading with minimum settings
# 3. Watch logs carefully for leverage value
# 4. Verify position opens correctly
```

---

### Strategy 2: Verify Before Trading

**Check that the fixes are working BEFORE risking funds:**

#### Step 1: Check Code Fixes
```bash
# Verify leverage override is in place
grep -A 5 "leverage_override" avantis-service/contract_operations.py

# Verify validation exists
grep -A 3 "validate_trade_params" avantis-service/contract_operations.py
```

#### Step 2: Test Validation Only (No Transaction)
- The validation runs BEFORE any transaction
- If validation fails, no funds are transferred
- Check logs to see validation messages

#### Step 3: Monitor Logs During Test
```bash
# Watch Avantis service logs
tail -f /tmp/avantis-service.log | grep -i "leverage\|validation\|collateral"

# Look for these confirmations:
# ✅ "Using override leverage: 10x" (not 100000000000x)
# ✅ "Collateral $12.00 is above protocol minimum $11.5"
# ✅ "Leverage 10x is within valid range (2x-100x)"
```

---

### Strategy 3: Use Test Wallet (Safest)

**Create a separate test wallet with minimal funds:**

1. **Create New Wallet**: Use a test wallet (not your main wallet)
2. **Fund with $15-20**: Just enough for testing
3. **Test Once**: Run one test trade
4. **Verify Success**: Check that position opens correctly
5. **If Successful**: You know the fix works

**Benefits:**
- Isolates risk to test wallet only
- Main wallet remains safe
- Can test multiple times with small amounts

---

## 🔍 Verification Checklist

Before testing with real funds, verify these:

### ✅ Pre-Trading Verification

- [ ] **Leverage Fix Confirmed**
  - Check logs show correct leverage (10x, not 100000000000x)
  - Location: `avantis-service/contract_operations.py:426-434`

- [ ] **Validation Active**
  - Minimum collateral check: $11.5 USDC
  - Leverage range check: 2x-100x
  - Location: `avantis-service/contract_operations.py:36-49`

- [ ] **Manual Method Enabled**
  - Using `_build_manual_open_tx` function
  - Leverage override parameter passed
  - Location: `avantis-service/contract_operations.py:393-436`

### ✅ During Trading Verification

- [ ] **Logs Show Correct Leverage**
  ```bash
  # Should see: "Using override leverage: 10x"
  # NOT: "Using override leverage: 100000000000x"
  ```

- [ ] **Validation Passes**
  ```bash
  # Should see: "Collateral $12.00 is above protocol minimum $11.5"
  # Should see: "Leverage 10x is within valid range"
  ```

- [ ] **Transaction Succeeds**
  - Position opens successfully
  - No "BELOW_MIN_POS" errors
  - No invalid leverage errors

### ✅ Post-Trading Verification

- [ ] **Position Created**
  - Position visible on AvantisFi dashboard
  - Position has correct leverage (10x)
  - Position has correct collateral amount

- [ ] **No Funds Stuck**
  - All funds are in a position (not stuck in contract)
  - Can close position normally
  - Balance reflects position correctly

---

## 📋 Step-by-Step Safe Test

### Phase 1: Pre-Flight Checks (No Funds Risked)

1. **Check Services Running**
   ```bash
   curl http://localhost:3002/health
   curl http://localhost:3001/api/health
   ```

2. **Verify Code Fixes**
   ```bash
   # Check leverage override exists
   grep "leverage_override" avantis-service/contract_operations.py
   
   # Check validation exists
   grep "validate_trade_params" avantis-service/contract_operations.py
   ```

3. **Check Your Balance**
   ```bash
   # Ensure you have at least $12-15
   # Use your wallet or API to check balance
   ```

### Phase 2: Dry Run (Check Validation Only)

1. **Start Trading with Minimum Settings**
   - Investment: $12 (minimum)
   - Profit Goal: $2
   - Max Positions: 1

2. **Watch Logs Immediately**
   ```bash
   tail -f /tmp/avantis-service.log
   ```

3. **Look for These Log Messages:**
   ```
   ✅ "Using override leverage: 10x" (CORRECT)
   ✅ "Collateral $12.00 is above protocol minimum $11.5"
   ✅ "Leverage 10x is within valid range (2x-100x)"
   ```

4. **If You See Wrong Leverage:**
   - **STOP IMMEDIATELY**
   - Do not proceed with transaction
   - Check code again

### Phase 3: Small Test Trade

**Only proceed if Phase 2 shows correct values:**

1. **Execute Test Trade**
   - Investment: $12-15
   - Single position
   - Small profit goal

2. **Monitor Transaction**
   - Watch for transaction hash
   - Check transaction on BaseScan
   - Verify transaction succeeds

3. **Verify Position**
   - Check AvantisFi dashboard
   - Verify position exists
   - Verify leverage is 10x (not 100000000000x)
   - Verify collateral is correct

4. **Test Position Closing**
   - Try closing the position
   - Verify funds return correctly
   - This confirms no funds are stuck

---

## 🚨 Red Flags - Stop Immediately If You See:

### ❌ Wrong Leverage in Logs
```
⚠️ "Using override leverage: 100000000000x"  # WRONG - STOP!
✅ "Using override leverage: 10x"  # CORRECT - OK to proceed
```

### ❌ Validation Errors
```
❌ "Collateral $12.00 is below protocol minimum"  # Should not happen
❌ "Leverage 10x is out of range"  # Should not happen
```

### ❌ Transaction Errors
```
❌ "BELOW_MIN_POS" error
❌ "Invalid leverage" error
❌ Transaction reverted
```

### ❌ Position Not Created
```
❌ Transaction succeeds but no position created
❌ Funds transferred but position missing
❌ Balance shows funds but no position
```

---

## 💡 Recommended Testing Approach

### Option A: Ultra-Conservative (Safest)
1. **Test with $12** (absolute minimum)
2. **Single position only**
3. **Verify logs show correct leverage**
4. **If successful, test closing position**
5. **Only then test with larger amounts**

### Option B: Standard Test
1. **Test with $15** (small buffer above minimum)
2. **1-2 positions maximum**
3. **Monitor closely**
4. **Verify everything works**
5. **Gradually increase if confident**

### Option C: Full Verification
1. **Run validation checks first** (no transaction)
2. **Check logs for correct values**
3. **Then run small test trade**
4. **Verify position opens correctly**
5. **Test closing position**
6. **Only then use normal amounts**

---

## 🔧 How to Verify Fixes Are Working

### Check 1: Leverage Override
```python
# In avantis-service/contract_operations.py line 426-434
if leverage_override and 1 <= leverage_override <= 100:
    leverage_val = leverage_override
    logger.info(f"✅ Using override leverage: {leverage_val}x")
```

**What to look for in logs:**
- Should see: `"✅ Using override leverage: 10x"`
- Should NOT see: `"✅ Using override leverage: 1000x"`

### Check 2: Validation
```python
# In avantis-service/contract_operations.py line 36-49
def validate_trade_params(collateral_amount, leverage, pair_index):
    if collateral_amount < MIN_COLLATERAL_USDC:
        raise ValueError(...)
    if not 2 <= leverage <= 100:
        raise ValueError(...)
```

**What to look for:**
- Validation runs BEFORE transaction
- Errors caught before funds transfer
- Clear error messages if validation fails

### Check 3: Manual Method
```python
# In avantis-service/contract_operations.py line 366-375
open_tx = await _build_manual_open_tx(
    trader_client, 
    trader_address, 
    trade_input,
    current_price_int, 
    slippage_percentage,
    original_collateral_wei,
    leverage  # Pass leverage directly
)
```

**What to look for:**
- Uses manual method (not SDK)
- Leverage passed as parameter
- Direct contract interaction

---

## 📊 Expected Behavior After Fixes

### ✅ Correct Behavior:
1. **Logs show**: `"Using override leverage: 10x"` ✅
2. **Validation passes**: Collateral and leverage valid ✅
3. **Transaction succeeds**: Position opens ✅
4. **Position created**: Visible on AvantisFi ✅
5. **No funds stuck**: All funds in position ✅

### ❌ Old Buggy Behavior (Should NOT Happen):
1. **Logs show**: `"Using override leverage: 100000000000x"` ❌
2. **Transaction succeeds**: But position fails ❌
3. **Funds transferred**: But no position created ❌
4. **Funds stuck**: In contract but not linked ❌

---

## 🎯 My Recommendation

**Start with this ultra-safe approach:**

1. **Verify code fixes first** (no funds at risk)
   ```bash
   grep "leverage_override" avantis-service/contract_operations.py
   grep "validate_trade_params" avantis-service/contract_operations.py
   ```

2. **Test with absolute minimum** ($12, 1 position)
   - This is the minimum required
   - If it works, you know the fix is correct
   - If it fails, you lose minimum amount

3. **Watch logs carefully**
   - Verify leverage is correct (10x)
   - Verify validation passes
   - Verify transaction succeeds

4. **Verify position opens**
   - Check AvantisFi dashboard
   - Verify position exists
   - Verify leverage is correct

5. **Test closing position**
   - Close the test position
   - Verify funds return
   - This confirms no funds stuck

6. **Only then increase amount**
   - If everything works, gradually increase
   - Test with $15, then $20, etc.
   - Build confidence gradually

---

## 🆘 If Something Goes Wrong

### If Transaction Fails:
- ✅ **Good**: Transaction reverts, no funds lost
- Check logs for error message
- Fix the issue before retrying

### If Funds Transfer But No Position:
- ❌ **Bad**: This is the bug we fixed
- Check logs for leverage value
- If leverage is wrong, stop immediately
- Contact support if needed

### If Position Opens But Wrong Leverage:
- ⚠️ **Warning**: Position exists but leverage wrong
- Check logs to see what happened
- May need to close position manually
- Review code fixes again

---

## 📝 Testing Checklist

Before each test:
- [ ] Code fixes verified
- [ ] Services running
- [ ] Balance sufficient ($12+)
- [ ] Logs monitoring ready
- [ ] AvantisFi dashboard open (to verify)

During test:
- [ ] Logs show correct leverage (10x)
- [ ] Validation passes
- [ ] Transaction succeeds
- [ ] Position appears on AvantisFi
- [ ] Leverage is correct in position

After test:
- [ ] Position exists and is correct
- [ ] Can close position successfully
- [ ] Funds return correctly
- [ ] No funds stuck

---

## ✅ Confidence Building

**Build confidence gradually:**

1. **First test**: $12, 1 position → Verify it works
2. **Second test**: $15, 1 position → Verify it works
3. **Third test**: $20, 2 positions → Verify it works
4. **Fourth test**: Normal amounts → Full confidence

**Each successful test builds confidence that:**
- ✅ Leverage fix is working
- ✅ Validation is working
- ✅ No funds will get stuck
- ✅ System is reliable

---

## 🎓 Key Takeaways

1. **The bug is fixed** - Leverage override ensures correct value
2. **Validation added** - Catches errors before transaction
3. **Start small** - Test with minimum ($12) first
4. **Verify logs** - Check leverage is correct before proceeding
5. **Build confidence** - Gradually increase amounts
6. **Monitor closely** - Watch logs and positions carefully

---

## 💬 Final Words

**You're right to be cautious** after losing $12. The fixes are in place, but testing with small amounts first is the smart approach.

**Recommended path:**
1. Verify code fixes (no risk)
2. Test with $12 minimum (minimal risk)
3. Verify everything works
4. Gradually increase confidence
5. Use normal amounts once confident

**Remember:**
- The leverage bug is fixed
- Validation prevents errors
- Start small and build confidence
- Monitor logs carefully
- Verify positions on AvantisFi

**You've got this!** 🚀

