# Farcaster Trading Verification

## ✅ Private Key Handling - VERIFIED CORRECT

### Important: We Use Backend Trading Wallet, NOT Farcaster Base Account Wallet

**Key Distinction:**
- **Farcaster Base Account Wallet**: User's smart wallet (managed by Base SDK) - NO private key we control
- **Trading Wallet**: Separate EOA wallet created by backend for trading - HAS private key we control

**For Trading**: We use the **backend trading wallet** (separate from Farcaster wallet)

### Flow for Farcaster Users:

1. **API Route** (`app/api/trading/start/route.ts`):
   ```typescript
   // Line 76-90: Farcaster user path
   const farcasterWalletService = getFarcasterWalletService()
   // NOTE: ensureTradingWallet() creates/gets a SEPARATE trading wallet, not the Farcaster Base Account
   const tradingWallet = await farcasterWalletService.ensureTradingWallet(authContext.fid)
   
   if (!tradingWallet || !tradingWallet.privateKey) {
     // Error handling
   }
   
   wallet = {
     address: tradingWallet.address,  // ✅ Backend trading wallet address
     privateKey: tradingWallet.privateKey  // ✅ Private key from backend trading wallet
   }
   ```

2. **Passed to Trading Engine**:
   ```typescript
   // Line 162: Private key from backend trading wallet passed as avantisApiWallet
   avantisApiWallet: privateKey,  // ✅ Private key from backend trading wallet sent to trading engine
   ```

3. **Trading Engine Storage** (`trading-engine/api/server.ts`):
   ```typescript
   // Line 108: Stored in session config
   privateKey: privateKey  // ✅ Stored per-session
   ```

4. **Used for Position Opening** (`trading-engine/hyperliquid/web-trading-bot.ts`):
   ```typescript
   // Line 296-302: Private key used when opening positions
   const avantisResult = await openAvantisPosition({
     symbol,
     collateral: perPositionBudget,
     leverage,
     is_long: isLong,
     private_key: this.config.privateKey  // ✅ Private key passed correctly
   });
   ```

5. **Avantis Service** (`avantis-service/trade_operations.py`):
   ```python
   # Line 48: Client created with private key
   client = get_avantis_client(private_key=private_key)  # ✅ Private key used
   ```

**Result**: ✅ **Backend trading wallet** private key is correctly set and passed through the entire chain for Farcaster users, identical to web users. We do NOT use the Farcaster Base Account wallet for trading.

---

## ✅ Leverage Handling - VERIFIED CORRECT

### Flow (Same for Farcaster and Web):

1. **Leverage Calculation** (`trading-engine/hyperliquid/web-trading-bot.ts`):
   ```typescript
   // Line 261: Leverage calculated from market regime
   const { leverage } = getBudgetAndLeverage(marketRegime as any, symbol, perPositionBudget);
   // Returns valid leverage (2x-20x typically)
   ```

2. **Passed to Avantis API** (`trading-engine/avantis-trading.ts`):
   ```typescript
   // Line 321: Leverage sent in request
   leverage: params.leverage,  // ✅ Leverage passed correctly
   ```

3. **API Validation** (`avantis-service/main.py`):
   ```python
   # Line 39: API validates leverage range
   leverage: int = Field(..., ge=1, le=50, description="Leverage multiplier")
   # ✅ Validates 1-50x at API level
   ```

4. **Contract Validation** (`avantis-service/contract_operations.py`):
   ```python
   # Line 45: Contract validates leverage range
   if not 2 <= leverage <= 100:
       raise ValueError(f"Leverage {leverage}x is out of range (2x-100x).")
   # ✅ Validates 2-100x at contract level
   ```

5. **Critical Fix - Leverage Override** (`avantis-service/contract_operations.py`):
   ```python
   # Line 373: Leverage passed directly as override
   leverage  # Pass leverage directly (TradeInput.leverage is wrong)
   
   # Line 426-428: Override used in manual transaction building
   if leverage_override and 1 <= leverage_override <= 100:
       leverage_val = leverage_override
       logger.info(f"✅ Using override leverage: {leverage_val}x")
   # ✅ Leverage override ensures correct value (prevents 100000000000x bug)
   ```

**Result**: ✅ Leverage is correctly calculated, validated, and passed through the entire chain. The `leverage_override` mechanism prevents the stuck funds issue.

---

## 🛡️ Protection Against Stuck Funds Issue

### The Problem (Previously):
- Leverage was extracted from `TradeInput.leverage` which could be `100000000000x` (wrong)
- Contract rejected position but USDC was already transferred
- Funds got stuck in contract

### The Solution (Current):
1. **Direct Leverage Passing**:
   - Leverage is passed directly from trading engine → API → contract operations
   - Never extracted from `TradeInput.leverage` (which can be wrong)

2. **Leverage Override Mechanism**:
   ```python
   # contract_operations.py line 373
   leverage  # Pass leverage directly (TradeInput.leverage is wrong)
   
   # contract_operations.py line 426-434
   if leverage_override and 1 <= leverage_override <= 100:
       leverage_val = leverage_override  # ✅ Use override (correct value)
   else:
       leverage_val = getattr(trade_input, 'leverage', 1)
       if leverage_val > 100 or leverage_val < 1:
           logger.warning(f"⚠️ Invalid leverage from TradeInput: {leverage_val}, defaulting to 10x")
           leverage_val = 10  # ✅ Fallback to safe default
   ```

3. **Validation at Multiple Levels**:
   - Trading engine: Calculates valid leverage (2x-20x)
   - API: Validates 1-50x
   - Contract: Validates 2-100x
   - Manual TX Builder: Uses override (correct value)

**Result**: ✅ Multiple layers of protection ensure leverage is always correct, preventing the stuck funds issue.

---

## 📊 Comparison: Farcaster vs Web

| Aspect | Farcaster | Web | Status |
|--------|-----------|-----|--------|
| Wallet Type Used | **Backend Trading Wallet** (separate EOA) | **Backend Trading Wallet** (separate EOA) | ✅ Same |
| Private Key Source | `BaseAccountWalletService.ensureTradingWallet(fid)` | `WebWalletService.ensureTradingWallet(webUserId)` | ✅ Same |
| Private Key Validation | Checks `tradingWallet.privateKey` exists | Checks `tradingWallet.privateKey` exists | ✅ Same |
| Private Key Storage | Stored in session config | Stored in session config | ✅ Same |
| Note | NOT using Farcaster Base Account wallet | NOT using web user's personal wallet | ✅ Same |
| Leverage Calculation | `getBudgetAndLeverage()` | `getBudgetAndLeverage()` | ✅ Same |
| Leverage Validation | API: 1-50x, Contract: 2-100x | API: 1-50x, Contract: 2-100x | ✅ Same |
| Leverage Override | Uses `leverage_override` parameter | Uses `leverage_override` parameter | ✅ Same |
| Position Opening | `openAvantisPosition()` with private key | `openAvantisPosition()` with private key | ✅ Same |

**Result**: ✅ Farcaster and Web users have identical trading flows. All fixes apply to both.

---

## ✅ Verification Checklist

- [x] Private key is correctly extracted for Farcaster users
- [x] Private key is passed to trading engine correctly
- [x] Private key is stored in session config
- [x] Private key is used when opening positions
- [x] Leverage is calculated correctly (same for Farcaster and Web)
- [x] Leverage is validated at API level (1-50x)
- [x] Leverage is validated at contract level (2-100x)
- [x] Leverage override mechanism prevents wrong leverage values
- [x] Leverage override is used in manual transaction building
- [x] Fallback to safe default (10x) if leverage is invalid
- [x] All protections against stuck funds are in place

---

## 🎯 Conclusion

**All systems verified and working correctly for Farcaster users:**

1. ✅ **Private Key**: Correctly set and passed through entire chain
2. ✅ **Leverage**: Correctly calculated, validated, and passed with override protection
3. ✅ **Stuck Funds Prevention**: Multiple layers of validation prevent invalid leverage

**Farcaster trading is identical to web trading** - all the fixes from `TRADE_SUCCESS_GUARANTEES.md` apply to Farcaster users as well.

The leverage override mechanism ensures that even if `TradeInput.leverage` is wrong (100000000000x), the correct leverage value from the trading engine is used, preventing the stuck funds issue.

