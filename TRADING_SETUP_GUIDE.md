# Trading Setup Guide - What Was Missing & What Changed

## 🔍 **What Was Missing**

### 1. **Hardcoded Data Instead of Real On-Chain Data**
- ❌ **Before**: Position cards showed hardcoded values like "Dynamic", "10 USDC", "Auto / Auto"
- ✅ **After**: All data now comes from real Avantis on-chain positions

### 2. **Missing Wallet Address Display**
- ❌ **Before**: Users didn't know which wallet address to connect in MetaMask
- ✅ **After**: Backend wallet address is now displayed so users can connect the correct wallet

### 3. **Liquidation Price Not Shown**
- ❌ **Before**: Liquidation price was hardcoded as "Dynamic" 
- ✅ **After**: Real liquidation price from Avantis SDK or calculated from position data

### 4. **Fee Values Were Hardcoded**
- ❌ **Before**: Exit fees (-0.05 USDC) and funding fees (-0.001 USDC) were hardcoded
- ✅ **After**: Set to 0.00 USDC (Avantis uses Zero Fee Perpetuals - ZFP)

## ✅ **What Changed This Time**

### 1. **All Position Data Now Dynamic**
- Entry Price: Real from Avantis contract
- Mark Price: Current market price from Avantis
- Liquidation Price: From Avantis SDK or calculated
- PnL: Real profit/loss from Avantis
- Collateral: Actual collateral amount
- Leverage: Real leverage used
- Stop Loss/Take Profit: From position data

### 2. **Home Page Active Session Card Enhanced**
- Shows up to 3 live positions with full details
- Displays liquidation price for each position
- Shows real-time PnL per position
- Direct link to AvantisFi dashboard

### 3. **Data Flow Verification**
```
Frontend → usePositions() → Next.js API → Trading Engine → Avantis Python Service → Avantis SDK → On-Chain Contracts
```

All data matches what you see on https://www.avantisfi.com/trade?asset=BTC-USD

## 🔑 **Critical: Wallet Address Matching**

### **The Problem**
Positions are opened using your **backend trading wallet** (created automatically). To see positions on AvantisFi:

1. **You MUST connect MetaMask with the SAME wallet address** that the backend is using
2. The backend wallet address is displayed in the app
3. If you connect a different wallet, you won't see the positions

### **How to Fix "No Positions" Issue**

1. **Check Backend Wallet Address**:
   - Go to Home page
   - Look for "Trading Wallet" section
   - Copy the wallet address shown

2. **Connect Same Wallet in MetaMask**:
   - Open MetaMask
   - Click "Import Account" or "Add Account"
   - Import using the private key OR connect the same address
   - Make sure you're on Base network

3. **Connect to AvantisFi**:
   - Go to https://www.avantisfi.com/trade?asset=BTC-USD
   - Click "Connect Wallet"
   - Select MetaMask
   - Choose the wallet address that matches your backend wallet

4. **Verify Positions**:
   - Go to Portfolio → Positions & Activities
   - You should now see all positions opened by the trading bot

## 📋 **Technical Details**

### **Position Opening Flow**
1. User starts trading from app
2. App gets backend wallet (with private key) from database
3. Trading engine uses private key to open positions via Avantis Python Service
4. Avantis SDK opens positions on-chain using the wallet's private key
5. Positions appear on AvantisFi when same wallet is connected

### **Key Files Changed**
- `app/home/page.tsx` - Added real position display
- `app/chat/page.tsx` - Removed hardcoded values, added real liquidation price
- `app/api/positions/route.ts` - Added liquidation price, collateral, TP/SL to position data
- `avantis-service/position_queries.py` - Added liquidation price calculation
- `trading-engine/api/server.ts` - Passes through all position data from Avantis

## 🚨 **Troubleshooting**

### **If positions don't appear on AvantisFi:**

1. **Check Wallet Address Match**:
   ```bash
   # Backend wallet address (from app)
   # Must match MetaMask connected address
   ```

2. **Check Network**:
   - Must be on Base Mainnet
   - Not Base Sepolia or other networks

3. **Check Balance**:
   - Backend wallet must have USDC balance on Avantis
   - Minimum $10 required to start trading

4. **Check Trading Session**:
   - Verify trading session is running
   - Check logs for position opening errors
   - Verify private key is being passed correctly

5. **Check Avantis Service**:
   - Ensure Python Avantis service is running
   - Check logs for transaction hashes
   - Verify positions are being opened on-chain

## ✅ **Verification Checklist**

- [ ] Backend wallet address is displayed in app
- [ ] MetaMask connected with same wallet address
- [ ] Network is Base Mainnet
- [ ] Backend wallet has USDC balance
- [ ] Trading session is running
- [ ] Positions appear in app's position list
- [ ] Positions appear on AvantisFi dashboard
- [ ] All position data is real (not hardcoded)

