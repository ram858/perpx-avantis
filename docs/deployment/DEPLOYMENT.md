# Trading Engine Deployment Guide

## ⚠️ Important: Vercel Limitations

Vercel is **not recommended** for the trading engine because:
- Serverless functions have execution time limits (10s Hobby, 300s Pro)
- No persistent state between requests
- Trading sessions need to run continuously
- WebSocket support is limited

## ✅ Recommended: Deploy Separately

### Option 1: Railway (Recommended - Easiest)

1. **Install Railway CLI** (optional):
   ```bash
   npm i -g @railway/cli
   ```

2. **Deploy via Railway Dashboard**:
   - Go to [railway.app](https://railway.app)
   - Create new project
   - "Deploy from GitHub repo" → Select your repo (`perpx-avantis`)
   - ⚠️ **IMPORTANT**: In settings, set **Root Directory** to `trading-engine`
   - Railway auto-detects Node.js
   - The service will deploy from the `trading-engine/` folder

3. **Set Environment Variables** in Railway:
   ```
   API_PORT=3001
   NODE_ENV=production
   AVANTIS_NETWORK=base-testnet  # or base-mainnet
   ```

4. **Get Your URL**:
   - Railway provides: `https://your-app.railway.app`
   - Set in Vercel: `TRADING_ENGINE_URL=https://your-app.railway.app`

5. **Update CORS** in `trading-engine/api/server.ts`:
   ```typescript
   origin: process.env.NODE_ENV === 'production' 
     ? ['https://your-vercel-domain.vercel.app']  // Your Next.js app URL
     : ['http://localhost:3000', 'http://localhost:3001'],
   ```

### Option 2: Render

1. **Create New Web Service** on [render.com](https://render.com)

2. **Connect GitHub** and select repo

3. **Settings**:
   - **Root Directory**: `trading-engine`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: Node
   - **Plan**: Free tier works (spins down after inactivity)

4. **Environment Variables**:
   ```
   API_PORT=3001
   NODE_ENV=production
   ```

5. **Get URL**: `https://your-app.onrender.com`

### Option 3: Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create `fly.toml`** in `trading-engine/`:
   ```toml
   app = "your-trading-engine"
   primary_region = "iad"

   [build]

   [http_service]
     internal_port = 3001
     force_https = true
     auto_stop_machines = false
     auto_start_machines = true
     min_machines_running = 1
     processes = ["app"]

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 512
   ```

3. **Deploy**:
   ```bash
   cd trading-engine
   fly launch
   fly deploy
   ```

### Option 4: Heroku

1. **Install Heroku CLI**

2. **Create `Procfile`** in `trading-engine/`:
   ```
   web: npm run start
   ```

3. **Deploy**:
   ```bash
   cd trading-engine
   heroku create your-trading-engine
   heroku config:set NODE_ENV=production
   git push heroku main
   ```

## 🔧 Converting to Vercel Serverless (Not Recommended)

If you MUST use Vercel, you'll need to:

1. **Convert to serverless functions** - lose persistent state
2. **Use external database** (Redis/PostgreSQL) for session storage
3. **Use queue system** for long-running tasks

This requires significant refactoring.

## 📝 After Deployment

1. **Update `.env` in Vercel** (for your Next.js app):
   ```
   TRADING_ENGINE_URL=https://your-deployed-trading-engine.com
   ```

2. **Test the connection**:
   ```bash
   curl https://your-deployed-trading-engine.com/api/health
   ```

3. **Update CORS** in trading engine to allow your Vercel domain

## 🚀 Quick Start (Railway)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
cd trading-engine
railway init

# 4. Deploy
railway up

# 5. Get URL
railway domain
```

Then set `TRADING_ENGINE_URL` in Vercel to the Railway URL.

