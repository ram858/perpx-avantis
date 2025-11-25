# Quick Test Checklist - Safe Testing After Bug Fix

## 🎯 Ultra-Safe Testing Approach

### Before Testing (No Funds at Risk)
- [ ] Verify code fixes are in place
- [ ] Check services are running
- [ ] Have minimum $12-15 ready
- [ ] Open logs monitoring: `tail -f /tmp/avantis-service.log`

### During Test (Watch Carefully)
- [ ] **CRITICAL**: Logs show `"Using override leverage: 10x"` (NOT 100000000000x)
- [ ] Validation passes: `"Collateral $12.00 is above protocol minimum $11.5"`
- [ ] Transaction succeeds
- [ ] Position appears on AvantisFi dashboard

### After Test (Verify Success)
- [ ] Position exists with correct leverage (10x)
- [ ] Can close position successfully
- [ ] Funds return correctly
- [ ] No funds stuck in contract

---

## 🚨 Red Flags - STOP If You See:

```
❌ "Using override leverage: 100000000000x"  # WRONG - STOP!
❌ "BELOW_MIN_POS" error
❌ Transaction succeeds but no position created
❌ Funds transferred but position missing
```

---

## ✅ Safe Test Settings

**Recommended First Test:**
- Investment: **$12** (minimum)
- Profit Goal: **$2-3**
- Max Positions: **1**
- Leverage: **10x** (default)

**Why Safe:**
- Uses absolute minimum
- Single position = easy to monitor
- If it works, fix is confirmed
- If it fails, minimal loss

---

## 📋 Quick Test Steps

1. **Verify Fixes** (30 seconds, no risk)
   ```bash
   grep "leverage_override" avantis-service/contract_operations.py
   grep "validate_trade_params" avantis-service/contract_operations.py
   ```

2. **Start Small Test** ($12, 1 position)
   - Use frontend or API
   - Watch logs immediately
   - Verify leverage is 10x

3. **Check Position**
   - Go to AvantisFi dashboard
   - Verify position exists
   - Verify leverage is 10x

4. **Test Closing**
   - Close the position
   - Verify funds return
   - Confirms no funds stuck

5. **If Successful**
   - Gradually increase amount
   - Build confidence
   - Test with $15, then $20, etc.

---

## 🔍 What to Look For in Logs

**✅ Good Signs:**
```
✅ Using override leverage: 10x
✅ Collateral $12.00 is above protocol minimum $11.5
✅ Leverage 10x is within valid range (2x-100x)
✅ Transaction built via Manual Method
✅ Position opened successfully
```

**❌ Bad Signs:**
```
❌ Using override leverage: 100000000000x
❌ BELOW_MIN_POS error
❌ Invalid leverage error
❌ Transaction reverted
```

---

## 💡 Confidence Building Path

1. **Test 1**: $12, 1 position → Verify works
2. **Test 2**: $15, 1 position → Verify works  
3. **Test 3**: $20, 2 positions → Verify works
4. **Normal Use**: Full confidence → Use normal amounts

---

## 🆘 If Something Goes Wrong

**Transaction Fails:**
- ✅ Good: No funds lost (transaction reverted)
- Check logs for error
- Fix issue before retrying

**Funds Transfer But No Position:**
- ❌ Bad: This is the bug we fixed
- Check logs for leverage value
- If wrong leverage, stop immediately

**Position Opens But Wrong Leverage:**
- ⚠️ Warning: Check logs
- May need to close manually
- Review code fixes

---

## 📞 Quick Reference

**Check Logs:**
```bash
tail -f /tmp/avantis-service.log | grep -i "leverage\|validation"
```

**Verify Position:**
- Go to: https://avantisfi.com
- Connect wallet
- Check "Current Positions"

**Check Balance:**
- Use wallet or API
- Verify sufficient funds ($12+)

---

## ✅ Success Criteria

**Test is successful if:**
- ✅ Logs show correct leverage (10x)
- ✅ Position opens successfully
- ✅ Position visible on AvantisFi
- ✅ Leverage is correct in position
- ✅ Can close position successfully
- ✅ No funds stuck

**If all criteria met → Fix is working! 🎉**

---

## 🎓 Remember

1. **Start small** - $12 minimum first
2. **Watch logs** - Verify leverage is correct
3. **Verify position** - Check on AvantisFi
4. **Test closing** - Confirm no funds stuck
5. **Build confidence** - Gradually increase amounts

**You've got this!** 🚀

