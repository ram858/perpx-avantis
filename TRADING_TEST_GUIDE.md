# Trading Test Guide - Real Positions on AvantisFi

## Quick Start

### Test Real Trading ($15 investment, $5 profit)

```bash
# Automated test (gets token automatically)
./test-real-trading.sh

# Or with manual token
./test-real-trading.sh <JWT_TOKEN>
```

### Monitor Trades

```bash
# Monitor all positions
./monitor-trades.sh <JWT_TOKEN>

# Monitor specific session
./monitor-trades.sh <JWT_TOKEN> <SESSION_ID>
```

### Check AvantisFi Positions Directly

```bash
# Requires private key
./check-avantis-positions.sh <PRIVATE_KEY>
```

---

## Scripts Overview

### 1. `test-real-trading.sh`
**Purpose**: Complete end-to-end test of real trading
- Gets authentication token automatically
- Checks wallet balance
- Starts trading session with $15 investment and $5 profit
- Monitors positions for 30 seconds
- Verifies positions are opened on AvantisFi

**Usage**:
```bash
./test-real-trading.sh
# or
./test-real-trading.sh <JWT_TOKEN>
```

### 2. `start-trading-test.sh`
**Purpose**: Start a trading session with specific parameters
- Requires JWT token
- Configurable investment and profit goals
- Returns session ID for monitoring

**Usage**:
```bash
./start-trading-test.sh <JWT_TOKEN>
```

**Configuration** (edit script to change):
- Investment: $15
- Profit Goal: $5
- Max Positions: 3
- Loss Threshold: 10%

### 3. `monitor-trades.sh`
**Purpose**: Monitor active trading sessions and positions
- Shows current positions
- Can monitor specific session or all positions
- Continuous monitoring mode available

**Usage**:
```bash
# Show current positions
./monitor-trades.sh <JWT_TOKEN>

# Monitor specific session continuously
./monitor-trades.sh <JWT_TOKEN> <SESSION_ID>
```

### 4. `check-avantis-positions.sh`
**Purpose**: Check positions directly from AvantisFi API
- Bypasses frontend
- Requires private key
- Shows balance and positions

**Usage**:
```bash
./check-avantis-positions.sh <PRIVATE_KEY>
```

**⚠️ WARNING**: Only use with test wallets. Never share your private key.

---

## Getting JWT Token

### Method 1: Via Web Auth API
```bash
curl -X POST http://localhost:3000/api/auth/web \
  -H "Content-Type: application/json" \
  -d '{}'
```

Returns:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...},
  "wallet": {...}
}
```

### Method 2: Via OTP Verification
```bash
curl -X POST http://localhost:3000/api/auth/web/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "otp": "123456"
  }'
```

### Method 3: From Browser
1. Open http://localhost:3000
2. Log in via UI
3. Open browser console (F12)
4. Check localStorage or network tab for token

---

## Testing Real Positions

### Prerequisites
1. ✅ Services running (Avantis on 3002, Trading Engine on 3001)
2. ✅ Wallet has minimum $15 in Avantis vault
3. ✅ USDC approved for trading (auto-handled)
4. ✅ JWT token obtained

### Step-by-Step Test

#### 1. Start Trading Session
```bash
./test-real-trading.sh
```

Expected output:
```
✅ Authentication token obtained
✅ Balance sufficient for trading
✅ Trading session started successfully!
Session ID: abc123...
```

#### 2. Monitor Positions
The script automatically monitors for 30 seconds, or manually:
```bash
./monitor-trades.sh <TOKEN> <SESSION_ID>
```

Expected output:
```
Open Positions: 1
Avantis Balance: $15.00
✅ Positions detected!
```

#### 3. Verify on AvantisFi
Positions should appear on:
- AvantisFi dashboard: https://avantisfi.com
- Connect your wallet to see positions
- Positions should show in "Current Positions" section

#### 4. Check Directly via API
```bash
./check-avantis-positions.sh <PRIVATE_KEY>
```

---

## Troubleshooting

### Issue: "Failed to get authentication token"
**Solution**:
- Ensure frontend is running on port 3000
- Try OTP method: `curl -X POST http://localhost:3000/api/auth/web/verify-otp -H "Content-Type: application/json" -d '{"phoneNumber":"+1234567890","otp":"123456"}'`
- Or get token from browser UI

### Issue: "Balance insufficient"
**Solution**:
- Deposit at least $15 to Avantis vault
- Use `/api/deposit` endpoint or Avantis dashboard
- Verify deposit transaction succeeded

### Issue: "No positions opened"
**Possible causes**:
1. **Signal criteria not met** - Strategy may be waiting for valid signals
2. **Insufficient market data** - OHLCV data may not be available
3. **Network issues** - Base RPC or Avantis API may be slow
4. **USDC approval pending** - Check approval transaction

**Debug**:
```bash
# Check trading engine logs
tail -f /tmp/trading-engine.log

# Check Avantis service logs
tail -f /tmp/avantis-service.log

# Check session status
curl http://localhost:3001/api/trading/session/<SESSION_ID>
```

### Issue: "Trading engine not accessible"
**Solution**:
```bash
# Start trading engine
cd trading-engine && npm start

# Or use fix script
./fix-trading-issues.sh
```

---

## Expected Behavior

### When Trading Starts Successfully:
1. ✅ Session ID returned
2. ✅ Trading engine starts processing
3. ✅ Positions should open within 1-2 minutes
4. ✅ Positions appear in `/api/positions` endpoint
5. ✅ Positions visible on AvantisFi dashboard

### Position Opening Process:
1. Strategy analyzes market signals
2. When valid signal found, position opens
3. Transaction sent to Base network
4. Position confirmed on AvantisFi
5. Position appears in monitoring

### Typical Timeline:
- **0-30s**: Session started, strategy analyzing
- **30-60s**: First signals evaluated
- **60-120s**: First positions may open
- **2-5min**: Multiple positions may open (up to max)

---

## Monitoring Best Practices

1. **Start with small amounts** - Test with $15 before larger amounts
2. **Monitor continuously** - Use `monitor-trades.sh` in continuous mode
3. **Check logs** - Monitor service logs for errors
4. **Verify on AvantisFi** - Always verify positions on the dashboard
5. **Check balance** - Ensure sufficient balance for all positions

---

## Quick Reference

**Service URLs**:
- Frontend: http://localhost:3000
- Trading Engine: http://localhost:3001/api/health
- Avantis Service: http://localhost:3002/health

**API Endpoints**:
- Start Trading: `POST /api/trading/start`
- Get Positions: `GET /api/positions`
- Get Balance: `POST /api/balance` (Avantis service)

**Scripts**:
- Test: `./test-real-trading.sh`
- Monitor: `./monitor-trades.sh <TOKEN>`
- Check: `./check-avantis-positions.sh <PRIVATE_KEY>`

---

## Success Criteria

✅ **Trading session starts** - Session ID returned
✅ **Positions open** - At least 1 position within 5 minutes
✅ **Positions visible** - Appear in `/api/positions` endpoint
✅ **Positions on AvantisFi** - Visible on avantisfi.com dashboard
✅ **Balance updated** - Balance reflects open positions

If all criteria are met, real trading is working correctly! 🎉

