# Trading Opening Requirements Checklist

## 🔴 Critical Requirements (Must Have)

### 1. **Environment Variables**

#### Frontend (.env.web or system env):
```bash
# Required
TRADING_ENGINE_URL=http://localhost:3001  # Must be accessible
NEXT_PUBLIC_AVANTIS_API_URL=http://localhost:3002  # Avantis service URL
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet  # Network configuration
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org  # Base RPC endpoint
```

#### Trading Engine (trading-engine/.env):
```bash
# Required
AVANTIS_API_URL=http://localhost:3002  # Must match Avantis service
AVANTIS_NETWORK=base-mainnet  # Network configuration
BASE_RPC_URL=https://mainnet.base.org  # Base RPC endpoint
API_PORT=3001  # Trading engine API port
```

#### Avantis Service (avantis-service/.env):
```bash
# Required
HOST=0.0.0.0
PORT=3002  # Must match AVANTIS_API_URL
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org  # Base RPC endpoint
```

### 2. **Service Availability**

- ✅ **Trading Engine** must be running on port 3001
- ✅ **Avantis Service** must be running on port 3002
- ✅ **Base RPC** must be accessible (mainnet or testnet)
- ✅ **Network connectivity** between services

### 3. **User Requirements**

#### Authentication:
- ✅ Valid JWT token (Farcaster or Web user)
- ✅ User must have a trading wallet
- ✅ Wallet must have a private key (for automated trading)

#### Balance Requirements:
- ✅ **Minimum Avantis Vault Balance: $10.00** (checked in frontend)
- ✅ **Minimum Position Size: $10.50-$11.00 USDC** (contract requirement)
- ✅ **Sufficient USDC balance** in wallet or vault
- ✅ **USDC approval** for trading contract (auto-handled)

### 4. **Trading Configuration**

#### Required Parameters:
- ✅ `maxBudget` / `investmentAmount`: $10 - $10,000,000
- ✅ `profitGoal` / `targetProfit`: > $0, max 50% of budget
- ✅ `maxPositions` / `maxPerSession`: 1-20 positions
- ✅ `lossThreshold`: 1-50% (default: 10%)

#### Optional Parameters:
- `leverage`: 1-20x (default: calculated based on regime)
- `takeProfit`: Optional TP price
- `stopLoss`: Optional SL price

### 5. **Wallet Setup**

#### For Farcaster Users:
- ✅ Trading wallet must exist
- ✅ Wallet must have private key stored
- ✅ Wallet must be funded with USDC

#### For Web Users:
- ✅ Trading wallet must exist
- ✅ Wallet must have private key stored (encrypted)
- ✅ Wallet must be funded with USDC

## ⚠️ Common Issues & Solutions

### Issue 1: "Trading engine is not accessible"
**Cause**: Trading engine not running or wrong URL
**Solution**:
- Verify `TRADING_ENGINE_URL` is correct
- Check trading engine is running: `curl http://localhost:3001/api/health`
- Check firewall/network connectivity

### Issue 2: "Insufficient balance"
**Cause**: Balance below minimum requirements
**Solution**:
- Ensure vault balance >= $10.00
- Ensure position size >= $10.50
- Check USDC is deposited to Avantis vault (not just wallet)

### Issue 3: "BELOW_MIN_POS" error
**Cause**: Position size below contract minimum
**Solution**:
- Increase collateral amount to at least $10.50-$11.00
- Contract enforces minimum position size

### Issue 4: "No trading wallet found"
**Cause**: Wallet not created or private key missing
**Solution**:
- Ensure trading wallet is created via `/api/wallet/primary` or `/api/auth/web`
- Verify private key is stored (encrypted for web users)

### Issue 5: "Avantis API not accessible"
**Cause**: Avantis service not running or wrong URL
**Solution**:
- Verify `AVANTIS_API_URL` is correct
- Check Avantis service is running: `curl http://localhost:3002/health`
- Verify network configuration matches

### Issue 6: "USDC approval failed"
**Cause**: Insufficient allowance for trading contract
**Solution**:
- Auto-approval is handled, but check:
  - Wallet has USDC
  - Network is accessible
  - Contract address is correct

## 📋 Pre-Flight Checklist

Before opening a position, verify:

1. **Services Running**:
   ```bash
   # Check Trading Engine
   curl http://localhost:3001/api/health
   
   # Check Avantis Service
   curl http://localhost:3002/health
   ```

2. **Environment Variables Set**:
   - Frontend: `TRADING_ENGINE_URL`, `NEXT_PUBLIC_AVANTIS_API_URL`
   - Trading Engine: `AVANTIS_API_URL`, `BASE_RPC_URL`
   - Avantis Service: `AVANTIS_RPC_URL`, `AVANTIS_NETWORK`

3. **User Has**:
   - Valid authentication token
   - Trading wallet with private key
   - Minimum $10 in Avantis vault
   - Sufficient balance for position size

4. **Network Configuration**:
   - Base RPC endpoint accessible
   - All services can communicate
   - CORS configured correctly

## 🔧 Debugging Steps

1. **Check Service Logs**:
   ```bash
   # Trading Engine logs
   pm2 logs trading-engine
   
   # Avantis Service logs
   pm2 logs avantis-service
   ```

2. **Verify Balance**:
   ```bash
   # Check Avantis balance via API
   curl -X POST http://localhost:3002/api/balance \
     -H "Content-Type: application/json" \
     -d '{"private_key": "YOUR_PRIVATE_KEY"}'
   ```

3. **Test Position Opening**:
   ```bash
   # Test via Avantis API directly
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

## 📝 Missing Requirements Summary

If trading opening fails, check:

1. ✅ **TRADING_ENGINE_URL** is set and accessible
2. ✅ **AVANTIS_API_URL** is set and accessible  
3. ✅ **BASE_RPC_URL** is set and accessible
4. ✅ **Trading Engine** service is running
5. ✅ **Avantis Service** service is running
6. ✅ **User has trading wallet** with private key
7. ✅ **User has minimum balance** ($10+ in vault)
8. ✅ **Position size meets minimum** ($10.50+)
9. ✅ **Network connectivity** between all services
10. ✅ **CORS** configured for frontend domain

## 🚀 Quick Fix Commands

```bash
# Start all services
pm2 start ecosystem.config.js

# Check service status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Check environment variables
node scripts/load-runtime-env.js
```

