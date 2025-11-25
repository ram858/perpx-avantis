# Avantis Contract Minimum Position Size - Investigation Report

## 🔍 Investigation Summary

### Test Results

**Amounts Tested (All Rejected):**
- ❌ $12.5 - BELOW_MIN_POS
- ❌ $12.8 - BELOW_MIN_POS
- ❌ $12.95 - BELOW_MIN_POS
- ❌ $14.0 - BELOW_MIN_POS
- ❌ $14.5 - BELOW_MIN_POS (BTC and ETH)
- ❌ $14.9 - BELOW_MIN_POS
- ❌ $14.99 - BELOW_MIN_POS

**Current Balance:** $15.00 USDC

**Error:** `execution reverted: BELOW_MIN_POS`

### Key Findings

1. **Not Pair-Specific**: Both BTC and ETH reject the same amounts, so minimum is not pair-specific
2. **Consistent Rejection**: All amounts from $12.5 to $14.99 are rejected
3. **Error Message Mismatch**: Error says "typically around $10.50-$11 USDC" but rejects much higher amounts
4. **Previous Success**: STATUS.md shows a previous transaction with $20 USDC ($19.99) that transferred funds (though position failed due to leverage bug)

## 🧪 Theories Tested

### Theory 1: Minimum Based on Collateral Only ❌
- **Test**: Tried $14.99 collateral with 10x leverage
- **Result**: Rejected
- **Conclusion**: Minimum is NOT just based on collateral amount

### Theory 2: Minimum Based on Notional Value ❓
- **Test**: Notional = $14.99 × 10 = $149.90
- **Result**: Still rejected
- **Conclusion**: If based on notional, minimum might be $150+ (would need $15+ collateral at 10x)

### Theory 3: Minimum Varies by Pair ❌
- **Test**: Tried ETH instead of BTC with $14.5
- **Result**: Same rejection
- **Conclusion**: Minimum is NOT pair-specific

### Theory 4: Minimum Includes Fees ❓
- **Test**: Not directly testable with current balance
- **Conclusion**: Possible, but fees are typically small (<$1)

### Theory 5: Minimum is Much Higher ✅ (Most Likely)
- **Evidence**: Previous successful transfer was $20
- **Conclusion**: Minimum is likely $15+ or $20+

## 📊 Analysis

### What We Know

1. **Contract rejects $14.99** - This is 99.93% of current balance
2. **Both BTC and ETH reject same amounts** - Not pair-specific
3. **Error message is misleading** - Says $10.50-$11 but rejects $14.99
4. **Previous transaction used $20** - This was the amount in STATUS.md

### What We Don't Know

1. **Exact minimum value** - Could be $15, $20, $25, or higher
2. **If minimum is based on notional** - Would need to test with different leverage
3. **If minimum includes fees** - Fees might need to be accounted for separately

## 🎯 Most Likely Scenarios

### Scenario 1: Minimum is $15+ (Exceeds Current Balance) - **MOST LIKELY**
- **Probability**: 70%
- **Reason**: Contract rejects $14.99 but accepts might accept $15.00+
- **Action**: Deposit $1-5 more to test

### Scenario 2: Minimum is $20+ (Based on Previous Transaction)
- **Probability**: 20%
- **Reason**: Previous successful transfer was $20
- **Action**: Deposit $5-10 more to test

### Scenario 3: Minimum Based on Notional Value
- **Probability**: 5%
- **Reason**: If minimum notional is $150+, need $15+ collateral at 10x
- **Action**: Test with lower leverage (5x) to see if it helps

### Scenario 4: Contract Bug or Configuration Issue
- **Probability**: 5%
- **Reason**: Error message doesn't match behavior
- **Action**: Contact Avantis support

## 💡 Recommendations

### Immediate Actions

1. **Deposit More Funds** (Recommended)
   - Add $5-10 more (total $20-25)
   - Test with $20 collateral
   - This will definitively show if minimum is $15+ or $20+

2. **Test with Lower Leverage**
   - Try 5x leverage with $15 collateral
   - If minimum is based on notional, lower leverage might help
   - Notional at 5x = $75 vs 10x = $150

3. **Contact Avantis Support**
   - Ask for exact minimum position size
   - Ask if minimum varies by leverage
   - Ask if minimum includes fees

### Code Updates Needed

Once minimum is determined:

1. **Update `MIN_COLLATERAL_USDC`** in `contract_operations.py`
2. **Update error messages** to reflect actual minimum
3. **Add validation** before attempting to open position
4. **Update test scripts** with correct minimum

## 📝 Current Status

- ✅ **Nonce Management**: Fixed
- ✅ **Leverage Bug**: Fixed (10x, not 10000x)
- ✅ **Transaction Building**: Working correctly
- ❌ **Contract Minimum**: Unknown - needs more funds to test

## 🎯 Next Steps

1. **Deposit $5-10 more** (total $20-25)
2. **Test with $20 collateral**
3. **If successful**: Update minimum constant
4. **If still fails**: Test with $25 or contact support

---

**Conclusion**: The contract minimum appears to be **$15+ or $20+**, which exceeds your current balance of $15.00. The most reliable solution is to deposit more funds to test and determine the exact minimum.

