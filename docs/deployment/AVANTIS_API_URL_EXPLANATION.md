# AVANTIS_API_URL Explanation

## What is `AVANTIS_API_URL`?

`AVANTIS_API_URL` is the **URL of your Avantis Trading Service** - a Python FastAPI microservice that handles interactions with the Avantis trading protocol.

## 🏗️ Architecture Overview

Your application has **3 separate services**:

```
┌─────────────────┐
│  Next.js App    │  (Frontend + API Routes)
│  (Vercel)       │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│ Trading Engine  │  │ Avantis Service │
│ (Node.js)       │  │ (Python/FastAPI)│
│ (Railway)       │  │ (Railway/Render) │
└─────────────────┘  └─────────────────┘
```

### 1. **Next.js App** (Vercel)
- Your frontend React app
- API routes (`/api/trading/start`, `/api/positions`, etc.)
- Handles Base Account authentication

### 2. **Trading Engine** (Railway/Render)
- Node.js service
- Manages trading sessions
- Coordinates between frontend and Avantis service
- **Uses**: `TRADING_ENGINE_URL`

### 3. **Avantis Service** (Railway/Render) ⭐
- **Python FastAPI service** in `avantis-service/` directory
- Directly interacts with Avantis trading protocol
- Handles:
  - Opening/closing positions
  - Getting balances
  - Getting positions
  - USDC approvals
- **Uses**: `AVANTIS_API_URL`

## 📍 Where is the Avantis Service?

The Avantis service is in your codebase at:
```
perpx-avantis/
  └── avantis-service/
      ├── main.py          # FastAPI app
      ├── avantis_client.py
      ├── trade_operations.py
      ├── position_queries.py
      └── requirements.txt
```

## 🚀 How to Deploy It

### Option 1: Deploy to Railway/Render (Recommended)

1. **Create a new service** on Railway or Render
2. **Set Root Directory** to `avantis-service`
3. **Set environment variables:**
   ```bash
   PORT=8000
   AVANTIS_NETWORK=base-mainnet  # or base-testnet
   AVANTIS_RPC_URL=https://mainnet.base.org
   CORS_ORIGINS=https://your-vercel-app.vercel.app,https://your-trading-engine.railway.app
   ```
4. **Deploy** - Railway/Render will auto-detect Python and install dependencies

### Option 2: Deploy with Docker

```bash
cd avantis-service
docker build -t avantis-service .
docker run -p 8000:8000 \
  -e AVANTIS_NETWORK=base-mainnet \
  -e AVANTIS_RPC_URL=https://mainnet.base.org \
  avantis-service
```

### Option 3: Run Locally (Development)

```bash
cd avantis-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
# Service runs on http://localhost:8000
```

## 🔗 Setting AVANTIS_API_URL

### For Local Development:
```bash
AVANTIS_API_URL=http://localhost:8000
```

### For Production (Vercel):
```bash
AVANTIS_API_URL=https://your-avantis-service.railway.app
# or
AVANTIS_API_URL=https://your-avantis-service.onrender.com
```

### For Trading Engine:
```bash
AVANTIS_API_URL=https://your-avantis-service.railway.app
```

## 📋 What the Avantis Service Does

The service provides these endpoints:

- `POST /api/open-position` - Open a trading position
- `POST /api/close-position` - Close a specific position
- `POST /api/close-all-positions` - Close all positions
- `GET /api/positions` - Get all open positions
- `GET /api/balance` - Get account balance
- `GET /api/total-pnl` - Get total PnL
- `GET /api/usdc-allowance` - Get USDC allowance
- `POST /api/approve-usdc` - Approve USDC for trading
- `GET /health` - Health check

## 🔄 How It's Used

### In Your Next.js App:
```typescript
// lib/services/AvantisClient.ts
const client = new AvantisClient({
  baseUrl: process.env.AVANTIS_API_URL || 'http://localhost:8000'
});

// Get balance
const balance = await client.getBalance();

// Open position
await client.openPosition({
  symbol: 'BTC/USD',
  collateral: 100,
  leverage: 5,
  is_long: true
});
```

### In Trading Engine:
```typescript
// trading-engine/avantis-address-queries.ts
const response = await fetch(`${process.env.AVANTIS_API_URL}/api/balance?address=${address}`);
```

## ⚠️ Important Notes

1. **Separate Deployment**: The Avantis service must be deployed separately from your Next.js app
2. **Same Platform**: Can deploy to Railway/Render (same as trading engine)
3. **Port**: Default is 8000, but Railway/Render will assign a port
4. **CORS**: Must allow your Vercel app and trading engine URLs
5. **Private Keys**: Usually passed per-request, not as global env var

## 🎯 Summary

- **`AVANTIS_API_URL`** = URL of your Python FastAPI Avantis Trading Service
- **Location**: `avantis-service/` directory in your codebase
- **Default**: `http://localhost:8000` (local) or your deployed URL (production)
- **Purpose**: Handles all Avantis protocol interactions (trades, balances, positions)

## 📝 Quick Setup

1. Deploy `avantis-service/` to Railway/Render
2. Get the deployed URL (e.g., `https://avantis-service.railway.app`)
3. Set `AVANTIS_API_URL=https://avantis-service.railway.app` in:
   - Vercel (for Next.js app)
   - Railway (for trading engine)

That's it! Your app will now communicate with the Avantis service.

