# Quick Start - Test Real Trading ($15 investment, $5 profit)

## ✅ Services Status
- Avantis Service: ✅ Running on port 3002
- Trading Engine: ✅ Running on port 3001
- Frontend: ⏳ Starting (may take a minute)

## 🚀 Option 1: Direct Trading Engine Test (Recommended Now)

**Bypasses frontend - works immediately:**

```bash
./test-trading-direct.sh <YOUR_PRIVATE_KEY> <YOUR_WALLET_ADDRESS>
```

**Example:**
```bash
./test-trading-direct.sh 0x1234...abcd 0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5
```

**What it does:**
- ✅ Checks your balance
- ✅ Starts trading session with $15 investment and $5 profit
- ✅ Monitors positions for 60 seconds
- ✅ Shows real positions opened on AvantisFi
- ✅ Displays session status and PnL

**Requirements:**
- Private key of your trading wallet
- Wallet address
- Minimum $15 in Avantis vault

---

## 🚀 Option 2: Via Frontend API (When Ready)

**Wait for frontend to fully start, then:**

```bash
# Get token
./get-token.sh

# Or manually get token from browser, then:
./test-real-trading.sh <JWT_TOKEN>
```

---

## 📊 Monitor Trades

### Monitor All Positions:
```bash
./monitor-trades.sh <JWT_TOKEN>
```

### Monitor Specific Session:
```bash
./monitor-trades.sh <JWT_TOKEN> <SESSION_ID>
```

### Check AvantisFi Directly:
```bash
./check-avantis-positions.sh <PRIVATE_KEY>
```

---

## 🔍 What to Expect

### When Trading Starts:
1. ✅ Session ID returned immediately
2. ⏳ Strategy analyzes market (30-60 seconds)
3. ✅ First positions may open within 1-2 minutes
4. ✅ Positions appear in monitoring
5. ✅ Positions visible on AvantisFi dashboard

### Success Indicators:
- ✅ Session ID returned
- ✅ "Open Positions: 1+" in monitoring
- ✅ Positions visible on https://avantisfi.com
- ✅ Balance reflects open positions

---

## ⚠️ Important Notes

1. **Real Trading**: This opens REAL positions on AvantisFi
2. **Minimum Balance**: Need at least $15 in Avantis vault
3. **Position Size**: Each position will be ~$5 (15/3 positions)
4. **Verification**: Always verify positions on AvantisFi dashboard

---

## 🎯 Quick Test Command

**If you have private key and wallet address ready:**

```bash
./test-trading-direct.sh YOUR_PRIVATE_KEY YOUR_WALLET_ADDRESS
```

This will:
- ✅ Start trading with $15 investment, $5 profit goal
- ✅ Monitor for 60 seconds
- ✅ Show all opened positions
- ✅ Verify positions are real on AvantisFi

---

## 📝 Next Steps

1. **Get your wallet info ready:**
   - Private key (test wallet recommended)
   - Wallet address

2. **Run the test:**
   ```bash
   ./test-trading-direct.sh <PRIVATE_KEY> <WALLET_ADDRESS>
   ```

3. **Monitor results:**
   - Watch the script output
   - Check positions count
   - Verify on AvantisFi dashboard

4. **Verify on AvantisFi:**
   - Go to https://avantisfi.com
   - Connect your wallet
   - Check "Current Positions" section

---

## 🆘 Troubleshooting

**If no positions open:**
- Check trading engine logs: `tail -f /tmp/trading-engine.log`
- Check Avantis service logs: `tail -f /tmp/avantis-service.log`
- Verify balance is sufficient
- Check signal criteria (may be waiting for valid signals)

**If session fails to start:**
- Verify services are running: `./debug-trading.sh`
- Check private key format (must start with 0x)
- Verify wallet address is correct

---

## ✅ Ready to Test!

All scripts are ready. Choose your method:

1. **Direct (works now)**: `./test-trading-direct.sh <PRIVATE_KEY> <WALLET_ADDRESS>`
2. **Via Frontend (when ready)**: `./test-real-trading.sh <JWT_TOKEN>`

Both will test real position opening with $15 investment and $5 profit goal! 🚀

