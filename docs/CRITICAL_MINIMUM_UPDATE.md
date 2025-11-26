# 🚨 CRITICAL: Minimum Updated - $20 Was Also Rejected

## ⚠️ Important Discovery

**User lost $20 yesterday** - This means $20 was also rejected by the contract!

**Implication**: The minimum is **HIGHER than $20**.

## 📊 Testing History

**Amounts Tested (All Rejected):**
- ❌ $12.5 - BELOW_MIN_POS
- ❌ $12.8 - BELOW_MIN_POS
- ❌ $12.95 - BELOW_MIN_POS
- ❌ $14.0 - BELOW_MIN_POS
- ❌ $14.5 - BELOW_MIN_POS
- ❌ $14.9 - BELOW_MIN_POS
- ❌ $14.99 - BELOW_MIN_POS
- ❌ **$20.00 - BELOW_MIN_POS** (Lost yesterday)

**Current Balance**: $5.00

## ✅ Updated Safeguard

**Previous Minimum**: $20.0 (WRONG - was also rejected)
**New Minimum**: **$25.0** (Updated based on $20 rejection)

**Note**: The actual minimum might be even higher:
- Could be $30, $50, $100, or more
- No way to know without testing or contract documentation

## 🛡️ Protection Updated

**Files Updated:**
1. `avantis-service/contract_operations.py` - `MIN_COLLATERAL_USDC = 25.0`
2. `avantis-service/main.py` - `MIN_SAFE_COLLATERAL = 25.0`

**Status**: 
- ✅ Safeguard updated to $25
- ⚠️ Actual minimum unknown (could be higher)
- ⚠️ Current balance $5 is insufficient

## 🎯 Recommendation

**DO NOT TRADE** until:
1. **Balance is $25+** (updated minimum)
2. **Or deposit $50+** to test if minimum is even higher
3. **Or contact Avantis support** to get actual minimum requirement

## 📝 Next Steps

1. **Deposit $20+ more** (total $25+) to test with updated minimum
2. **If $25 still fails**, minimum is likely $30, $50, or $100+
3. **Contact Avantis support** to get official minimum requirement
4. **Check Avantis documentation** for minimum position size

## ⚠️ Critical Warning

**The actual minimum is unknown** and could be:
- $25 (our new safeguard)
- $30, $50, $100, or even higher
- Based on notional value (collateral × leverage)
- Varies by trading pair

**Until we know the actual minimum, trading is risky** - funds will be transferred but positions will fail.

---

**Status**: 🛡️ Safeguard updated to $25, but actual minimum is still unknown

