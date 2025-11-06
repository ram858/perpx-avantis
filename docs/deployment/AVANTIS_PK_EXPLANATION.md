# AVANTIS_PK Explanation

## 🔑 What is AVANTIS_PK?

`AVANTIS_PK` is an **Ethereum private key** used for Avantis trading. However, in your setup, it's **NOT a global environment variable** you need to set.

## ✅ How It Actually Works

### 1. **Per-User Private Keys** (Current Setup)
- Each user gets their own Ethereum wallet created automatically
- The wallet's private key is stored securely for that user
- When trading starts, the user's private key is sent to the trading engine
- **You don't need to find or set this - it's automatic!**

### 2. **The Flow:**
```
User → Base Account (FID) → Wallet Created → Private Key Stored → Trading Engine Uses It
```

### 3. **In Your Code:**
- `BaseAccountWalletService` creates wallets for users
- Each wallet has a unique private key
- When starting a trading session, the private key is sent as `avantisApiWallet`
- The trading engine receives it and uses it for that session

## ❓ Is AVANTIS_PK Required?

**For the Trading Engine: NO** - It receives per-user private keys via API

**However**, there are TWO different services:

### Trading Engine (Node.js) - `trading-engine/`
- **Does NOT need `AVANTIS_PK` env var**
- Receives private keys per request via API
- Uses `process.env.AVANTIS_PK` only to store the current user's key temporarily

### Avantis Service (Python) - `avantis-service/`
- **MIGHT need `AVANTIS_PK` env var** if you're deploying it separately
- Only if you want a default/fallback private key
- Usually receives private keys per request too

## 🎯 What You Actually Need

### For Trading Engine Deployment (Railway):
```env
# These are the only environment variables you need:
API_PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
AVANTIS_NETWORK=base-testnet  # or base-mainnet
```

### NOT Needed:
- ❌ `AVANTIS_PK` - Not a global env var, received per request
- ❌ `HYPERLIQUID_PK` - Legacy, being phased out

## 📝 Summary

1. **You don't need to find `AVANTIS_PK`** - it's automatically generated per user
2. **Each user has their own private key** - stored securely in your wallet service
3. **The trading engine receives it** - via the API request body
4. **No global env var needed** - for the trading engine specifically

## 🔍 If You Want to See User Private Keys (For Testing)

The private keys are stored in:
- **LocalStorage** (client-side) - encrypted
- **Vercel KV** (if configured) - encrypted
- **Key format**: `wallet:{fid}:ethereum`

But you don't need to manually retrieve them - the system handles it automatically!

## ⚠️ Important Note

The line in `api/server.ts`:
```typescript
process.env.AVANTIS_PK = apiWallet;
```

This is just **storing the user's private key temporarily** for that specific trading session. It's not reading from a global environment variable - it's setting it from the API request.

