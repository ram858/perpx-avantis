# Environment Variables for Base Mini App Deployment

## Deployment Options

This document covers environment variables for:
1. **Server Deployment** (Recommended for monorepo) - All services on one server
2. **Cloud Deployment** - Vercel + Railway/Render (separate services)

---

## 🖥️ Server Deployment (Single Server)

### Next.js App (.env in root)

#### Server-Side Only (No NEXT_PUBLIC_ prefix)
```bash
# Trading Engine URL (internal, same server)
TRADING_ENGINE_URL=http://localhost:3001

# Avantis Service URL (internal, same server)
AVANTIS_API_URL=http://localhost:8000

# JWT Secret (generate a strong random string)
JWT_SECRET=your-very-strong-secret-key-here-min-32-chars

# Encryption Secret (for wallet encryption)
ENCRYPTION_SECRET=your-32-character-encryption-secret

# Avantis Network
AVANTIS_NETWORK=base-mainnet
# or base-testnet for testing
```

#### Client-Side (NEXT_PUBLIC_ prefix required)
```bash
# Your app's public URL (must match Base mini app domain)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional: Avantis network
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet

# Optional: Avantis API URL (if you want direct client access)
# Usually not needed - use API routes instead
NEXT_PUBLIC_AVANTIS_API_URL=https://your-domain.com/api/avantis
```

### Trading Engine (.env in trading-engine/)

```bash
# Server Configuration
API_PORT=3001
NODE_ENV=production

# CORS - Allowed origins (your domain)
ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000

# Avantis Service URL (internal, same server)
AVANTIS_API_URL=http://localhost:8000

# Avantis Network
AVANTIS_NETWORK=base-mainnet

# Note: AVANTIS_PK is NOT set here - it's per-user and passed in API requests
```

### Avantis Service (.env in avantis-service/)

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=false

# Avantis Configuration
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
# For testnet: https://sepolia.base.org

# CORS - Allow your domain and trading engine
CORS_ORIGINS=https://your-domain.com,http://localhost:3001

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY=1.0

# Note: AVANTIS_PK is usually passed per-request, not as env var
# But you can set a default fallback here if needed
# AVANTIS_PK=0x_your_private_key_here
```

---

## ☁️ Cloud Deployment (Vercel + Railway/Render)

### Vercel (Next.js App)

#### Server-Side Only (No NEXT_PUBLIC_ prefix)
```bash
# Trading Engine URL (deployed on Railway/Render)
TRADING_ENGINE_URL=https://your-trading-engine.railway.app

# Avantis Service URL
AVANTIS_API_URL=https://your-avantis-service.com

# JWT Secret (generate a strong random string)
JWT_SECRET=your-very-strong-secret-key-here-min-32-chars

# Encryption Secret (for wallet encryption)
ENCRYPTION_SECRET=your-32-character-encryption-secret

# Optional: Database/KV Storage
KV_URL=your-vercel-kv-url (if using Vercel KV)
```

#### Client-Side (NEXT_PUBLIC_ prefix required)
```bash
# Your app's public URL (must match Base mini app domain)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Optional: Avantis network
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet

# Optional: Avantis API URL (if you want direct client access)
NEXT_PUBLIC_AVANTIS_API_URL=https://your-avantis-service.com
```

### Trading Engine (Railway/Render)

```bash
# Port (usually auto-set by platform)
PORT=3001

# CORS - Allowed origins (your Vercel app URL)
ALLOWED_ORIGINS=https://your-app.vercel.app

# Avantis Service URL
AVANTIS_API_URL=https://your-avantis-service.com

# Avantis Network
AVANTIS_NETWORK=base-mainnet

# Note: AVANTIS_PK is NOT set here - it's per-user and passed in API requests
```

## How to Set Environment Variables

### Server Deployment
1. SSH into your server
2. Navigate to `/var/www/perpx-avantis`
3. Edit `.env` files:
   - `.env` (Next.js root)
   - `trading-engine/.env`
   - `avantis-service/.env`
4. Restart services:
   ```bash
   pm2 restart all
   sudo systemctl restart avantis-service
   ```

### Vercel
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add each variable
4. Select environment (Production, Preview, Development)
5. Redeploy after adding variables

### Railway
1. Go to your Railway project
2. Variables tab
3. Add each variable
4. Service will restart automatically

## Important Notes

1. **NEXT_PUBLIC_ prefix**: Only variables with this prefix are exposed to the browser. Use this for client-side config only.

2. **Server-side variables**: Never use `NEXT_PUBLIC_` for secrets or server-only config.

3. **TRADING_ENGINE_URL**: 
   - Server deployment: `http://localhost:3001` (internal)
   - Cloud deployment: Full URL of your deployed trading engine (Railway/Render)

4. **AVANTIS_API_URL**:
   - Server deployment: `http://localhost:8000` (internal)
   - Cloud deployment: Full URL of your deployed Avantis service

5. **NEXT_PUBLIC_APP_URL**: Must exactly match your deployment URL for Base Account auth to work.
   - Server: `https://your-domain.com`
   - Vercel: `https://your-app.vercel.app`

6. **JWT_SECRET**: Generate a strong random string (at least 32 characters). Never commit to git.

7. **CORS**: Trading engine and Avantis service must allow your domain in `ALLOWED_ORIGINS`.

## Testing Locally

Create `.env.local` file:
```bash
# Server-side
TRADING_ENGINE_URL=http://localhost:3001
AVANTIS_API_URL=http://localhost:8000
JWT_SECRET=local-dev-secret-key
ENCRYPTION_SECRET=local-encryption-secret-32-chars

# Client-side
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_AVANTIS_NETWORK=base-testnet
```

## Verification

After deployment, verify:
- [ ] Base Account authentication works
- [ ] Trading engine is accessible
- [ ] API routes respond correctly
- [ ] No "environment variable not found" errors
- [ ] CORS is properly configured

