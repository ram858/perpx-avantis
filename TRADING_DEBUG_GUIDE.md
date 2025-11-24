# Trading Opening Debug Guide

## 🔍 Issue: Can't Open Trades Despite Meeting Balance Requirements

Even when you have:
- ✅ Minimum $10.00 in Avantis vault
- ✅ Position size >= $10.50-$11.00 USDC
- ✅ USDC deposited to vault

Trades might still fail. Here are the **other requirements** and how to debug them:

---

## 📋 Additional Requirements Checklist

### 1. **USDC Approval** ⚠️ CRITICAL

**Issue**: Even with balance, USDC must be **approved** for the trading contract.

**Check**:
```bash
# Check USDC allowance via API
curl -X POST http://localhost:3002/api/balance \
  -H "Content-Type: application/json" \
  -d '{"private_key": "YOUR_PRIVATE_KEY"}'
```

**Solution**: The code auto-approves, but if it fails:
- Check approval transaction in BaseScan
- Verify contract address is correct
- Check network connectivity

**Debug in Logs**:
Look for:
- `🔓 Approving contract...`
- `✅ USDC Approved for trading.`
- `❌ Pre-flight check failed`

---

### 2. **Symbol/Pair Index Issues** ⚠️ COMMON

**Issue**: Symbol might not be found in Avantis registry.

**Check**:
```bash
# Test symbol lookup
curl -X POST http://localhost:3002/api/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "collateral": 11.0,
    "leverage": 5,
    "is_long": true,
    "private_key": "YOUR_PRIVATE_KEY"
  }'
```

**Common Errors**:
- `Symbol BTC/USD not found in registry`
- `SDK pair index lookup failed`

**Solution**:
- Use correct symbol format: `BTC/USD` (not `BTC-USD` or `BTCUSD`)
- Check `avantis-service/symbol_registry.py` for available symbols
- Verify symbol exists on Avantis platform

**Available Symbols** (check registry):
- `BTC/USD`
- `ETH/USD`
- `SOL/USD`
- etc.

---

### 3. **Signal/Strategy Requirements** ⚠️ FOR AUTOMATED TRADING

**Issue**: Automated trading engine requires valid signals.

**Check Logs**:
Look for:
- `❌ No trade | Reason: [reason]`
- `Signal rejected: [reason]`
- `insufficient_ohlcv_data`

**Common Reasons**:
- `insufficient_ohlcv_data` - Need 26+ candles, 4h/6h data
- `invalid_direction_or_not_passed` - Signal criteria not met
- `signalScore too low` - Signal score < 0.01

**Solution**:
- Signal criteria are **very loose** (score > 0.01), so this is unlikely
- Check if market data is available
- Verify OHLCV data fetching is working

**Bypass for Testing**:
If using manual position opening (not automated), signals don't apply.

---

### 4. **Network/RPC Issues** ⚠️ COMMON

**Issue**: Base RPC endpoint might be slow or failing.

**Check**:
```bash
# Test Base RPC
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Common Errors**:
- `Request timed out`
- `ECONNREFUSED`
- `Network error`

**Solution**:
- Use reliable RPC endpoint (Alchemy, Infura, QuickNode)
- Check `AVANTIS_RPC_URL` in `avantis-service/.env`
- Verify network connectivity

**Recommended RPC Providers**:
- Alchemy: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- Infura: `https://base-mainnet.infura.io/v3/YOUR_KEY`
- QuickNode: `https://YOUR_ENDPOINT.base-mainnet.quiknode.pro/YOUR_KEY`

---

### 5. **SDK/Encoding Issues** ⚠️ RARE BUT POSSIBLE

**Issue**: Avantis SDK might have struct encoding errors.

**Check Logs**:
Look for:
- `⚠️ SDK build failed... Switching to Manual Fallback`
- `Could not identify` or `struct` in error message

**Solution**:
- Code has automatic fallback to manual transaction building
- If both fail, check SDK version compatibility
- Verify Avantis SDK is properly installed

---

### 6. **Service Connectivity** ⚠️ CRITICAL

**Issue**: Services might not be able to communicate.

**Check**:
```bash
# Check Trading Engine
curl http://localhost:3001/api/health

# Check Avantis Service
curl http://localhost:3002/health

# Check from Trading Engine to Avantis
curl http://localhost:3002/health
```

**Common Errors**:
- `Trading engine is not accessible`
- `Avantis API not accessible`
- `ECONNREFUSED`

**Solution**:
- Verify all services are running
- Check `TRADING_ENGINE_URL` and `AVANTIS_API_URL` are correct
- Verify ports are not blocked by firewall
- Check Docker network if using containers

---

### 7. **Transaction Gas Issues** ⚠️ POSSIBLE

**Issue**: Wallet might not have enough ETH for gas.

**Check**:
- Verify wallet has ETH (not just USDC)
- Base network requires ETH for gas fees
- Minimum ~0.001 ETH recommended

**Solution**:
- Add ETH to wallet for gas
- Check gas price isn't too high
- Verify network is Base mainnet (not testnet)

---

## 🔧 Step-by-Step Debugging

### Step 1: Check Service Logs

```bash
# Trading Engine logs
pm2 logs trading-engine

# Avantis Service logs  
pm2 logs avantis-service

# Or if using Docker
docker logs avantis-service
docker logs trading-engine
```

**Look for**:
- Error messages
- Transaction hashes
- Approval status
- Balance checks

---

### Step 2: Test Direct API Call

```bash
# Test opening position directly via Avantis API
curl -X POST http://localhost:3002/api/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "collateral": 11.0,
    "leverage": 5,
    "is_long": true,
    "private_key": "YOUR_PRIVATE_KEY"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "tx_hash": "0x...",
  "pair_index": 0,
  "symbol": "BTC/USD"
}
```

**If Error**:
- Check error message
- Verify private key is correct
- Check balance and approval

---

### Step 3: Check Balance and Approval

```bash
# Check balance
curl -X POST http://localhost:3002/api/balance \
  -H "Content-Type: application/json" \
  -d '{"private_key": "YOUR_PRIVATE_KEY"}'
```

**Expected**:
```json
{
  "total_balance": 50.0,
  "available_balance": 50.0,
  "usdc_balance": 50.0
}
```

**If insufficient**:
- Deposit more USDC to vault
- Verify deposit transaction succeeded

---

### Step 4: Check USDC Approval

```bash
# Approve USDC manually if needed
curl -X POST http://localhost:3002/api/approve-usdc \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.0,
    "private_key": "YOUR_PRIVATE_KEY"
  }'
```

**Expected**:
```json
{
  "success": true,
  "tx_hash": "0x...",
  "message": "USDC approved successfully"
}
```

---

### Step 5: Verify Environment Variables

```bash
# Check Trading Engine env
cat trading-engine/.env | grep AVANTIS_API_URL
cat trading-engine/.env | grep BASE_RPC_URL

# Check Avantis Service env
cat avantis-service/.env | grep AVANTIS_RPC_URL
cat avantis-service/.env | grep AVANTIS_NETWORK
```

**Required**:
- `AVANTIS_API_URL=http://localhost:3002` (Trading Engine)
- `BASE_RPC_URL=https://mainnet.base.org` (Trading Engine)
- `AVANTIS_RPC_URL=https://mainnet.base.org` (Avantis Service)
- `AVANTIS_NETWORK=base-mainnet` (Avantis Service)

---

## 🐛 Common Error Messages & Solutions

### Error: "Insufficient USDC in vault"
**Solution**: 
- Deposit USDC to Avantis vault (not just wallet)
- Use `/api/deposit` endpoint or Avantis dashboard
- Verify deposit transaction succeeded

### Error: "Symbol not found"
**Solution**:
- Use correct symbol format: `BTC/USD` (with `/USD`)
- Check symbol exists in registry
- Verify symbol is available on Avantis

### Error: "BELOW_MIN_POS"
**Solution**:
- Increase position size to at least $10.50-$11.00
- Contract enforces minimum position size

### Error: "Pre-flight check failed"
**Solution**:
- Check USDC approval
- Verify vault balance
- Check network connectivity

### Error: "SDK build failed"
**Solution**:
- Code should auto-fallback to manual method
- If both fail, check SDK version
- Verify Avantis SDK is properly installed

### Error: "Trading engine is not accessible"
**Solution**:
- Verify Trading Engine is running on port 3001
- Check `TRADING_ENGINE_URL` is correct
- Verify network connectivity

### Error: "Request timed out"
**Solution**:
- Check Base RPC endpoint is accessible
- Use reliable RPC provider (Alchemy, Infura)
- Increase timeout if needed

---

## ✅ Quick Verification Checklist

Before trying to open a trade, verify:

1. ✅ **Services Running**:
   ```bash
   pm2 status
   # or
   docker ps
   ```

2. ✅ **Environment Variables Set**:
   ```bash
   node scripts/load-runtime-env.js
   ```

3. ✅ **Balance Sufficient**:
   - Vault balance >= $10
   - Position size >= $10.50
   - Wallet has ETH for gas

4. ✅ **USDC Approved**:
   - Check approval transaction
   - Or manually approve via API

5. ✅ **Network Accessible**:
   - Base RPC endpoint working
   - Services can communicate

6. ✅ **Symbol Valid**:
   - Symbol format correct: `BTC/USD`
   - Symbol exists in registry

---

## 🚀 Quick Fix Commands

```bash
# Restart all services
pm2 restart all

# Check service health
curl http://localhost:3001/api/health
curl http://localhost:3002/health

# Check balance
curl -X POST http://localhost:3002/api/balance \
  -H "Content-Type: application/json" \
  -d '{"private_key": "YOUR_PRIVATE_KEY"}'

# Approve USDC
curl -X POST http://localhost:3002/api/approve-usdc \
  -H "Content-Type: application/json" \
  -d '{"amount": 100.0, "private_key": "YOUR_PRIVATE_KEY"}'

# Test position opening
curl -X POST http://localhost:3002/api/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "collateral": 11.0,
    "leverage": 5,
    "is_long": true,
    "private_key": "YOUR_PRIVATE_KEY"
  }'
```

---

## 📝 Next Steps

If trades still fail after checking all above:

1. **Check Full Error Logs**: Look at complete error stack trace
2. **Test with Different Symbol**: Try `ETH/USD` instead of `BTC/USD`
3. **Test with Different Amount**: Try $15 instead of $11
4. **Check BaseScan**: Verify transactions are being sent
5. **Contact Support**: Share error logs and transaction hashes

---

## 💡 Pro Tips

1. **Always check logs first** - Most errors are logged with details
2. **Test API directly** - Bypass frontend to isolate issues
3. **Start small** - Test with minimum amount first
4. **Verify each step** - Balance → Approval → Position opening
5. **Check network** - Base RPC issues are common

