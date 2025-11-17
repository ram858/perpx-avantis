# Trading Start Test Guide

## Quick Test Scripts

### 1. Comprehensive Test (Recommended)
```bash
./test-trading-comprehensive.sh
```

This script:
- ✅ Validates wallet address format
- ✅ Validates private key format  
- ✅ Checks if trading engine is running
- ✅ Tests trading engine directly (if running)
- ✅ Checks if Next.js API is running

### 2. Direct Trading Engine Test
```bash
./test-trading-start.sh
```

This script tests the trading engine directly with your wallet:
- Wallet: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`
- Private Key: `0xab9c1552...c29e`

## Your Trading Wallet Details

- **Wallet Address**: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`
- **Private Key**: `0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e`

## Testing Steps

### Step 1: Start Trading Engine
```bash
cd trading-engine
npm start
```

The trading engine should start on `http://localhost:3001`

### Step 2: Start Next.js App
```bash
npm run dev
```

The Next.js app should start on `http://localhost:3000`

### Step 3: Run Test Script
```bash
./test-trading-comprehensive.sh
```

### Step 4: Test via UI
1. Open the app in browser
2. Login with Base Account
3. Navigate to trading page
4. Enter trading parameters:
   - Investment: $10
   - Target Profit: $5
5. Click "Start Trading"

## Fixed Issues

### ✅ Request Body Reading Error
**Problem**: "Body is unusable: Body has already been read"

**Fix**: Changed error handling to read response as text first, then parse as JSON:
```typescript
// Before (caused error):
errorData = await response.json()
// Then tried: await response.text() ❌

// After (fixed):
const responseText = await response.text();
errorData = JSON.parse(responseText); ✅
```

### ✅ Base Account Dependencies Removed
- All Base Account trading logic removed
- Always uses trading wallet with private key
- Simplified code flow

### ✅ Private Key Always Available
- Trading wallet is always fetched/created
- Private key is always passed to trading engine
- Positions will open on real Avantis dashboard

## Expected Behavior

When trading starts successfully:
1. ✅ Session ID is returned immediately
2. ✅ Trading bot starts in background
3. ✅ Bot monitors markets and opens positions on Avantis
4. ✅ Positions appear in Avantis dashboard (when wallet is connected)
5. ✅ Logs show: "✅✅✅ Position SUCCESSFULLY opened on Avantis Dashboard!"

## Troubleshooting

### Error: "Trading engine not running"
- Start trading engine: `cd trading-engine && npm start`

### Error: "No trading wallet found"
- Check database connection
- Verify wallet service is working
- Check logs for wallet creation errors

### Error: "Body has already been read"
- ✅ **FIXED** - This should not occur anymore

### Positions not appearing in Avantis dashboard
- Verify wallet is connected to Avantis dashboard
- Check that private key matches the connected wallet
- Verify Avantis API URL is correct: `AVANTIS_API_URL`

## Environment Variables

Make sure these are set:
- `TRADING_ENGINE_URL` (default: `http://localhost:3001`)
- `AVANTIS_API_URL` (default: `http://localhost:8000`)
- Database connection variables

