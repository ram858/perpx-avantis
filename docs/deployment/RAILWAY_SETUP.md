# Railway Deployment - Quick Setup

## 🚀 Deploy from Monorepo

You're deploying from `perpx-avantis/trading-engine` directory.

### Step-by-Step:

1. **Go to Railway**: [railway.app](https://railway.app)
   - Sign up/login with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `perpx-avantis` repository

3. **Configure Service**:
   - Railway will create a service
   - Click on the service → **Settings**
   - Scroll to **Root Directory**
   - Set it to: `trading-engine`
   - This tells Railway to deploy from the `trading-engine/` folder

4. **Set Environment Variables** (in Railway Settings):
   ```
   API_PORT=3001
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   AVANTIS_NETWORK=base-testnet  # or base-mainnet
   ```

5. **Deploy**:
   - Railway will auto-deploy
   - Check the **Deployments** tab for logs
   - Wait for "Deploy Successful"

6. **Get Your URL**:
   - Railway provides a URL like: `https://your-service.railway.app`
   - Or set a custom domain in **Settings → Networking**

7. **Update Vercel**:
   - In your Vercel project settings
   - Add environment variable:
   ```
   TRADING_ENGINE_URL=https://your-service.railway.app
   ```

8. **Update CORS** (if needed):
   - The trading engine already uses `ALLOWED_ORIGINS` env var
   - Make sure it includes your Vercel domain

## ✅ Test It

```bash
curl https://your-service.railway.app/api/health
```

Should return: `{"status":"healthy",...}`

## 🎯 That's It!

You're deploying from the monorepo, Railway handles the subdirectory automatically.

