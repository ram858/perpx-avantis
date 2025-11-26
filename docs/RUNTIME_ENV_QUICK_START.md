# Runtime Environment Variables - Quick Start

## TL;DR

Your app now supports **runtime environment variables** for CI/CD. Environment variables are loaded when the app starts, not when it's built.

## Quick Setup

### 1. Build (No env vars needed)
```bash
npm run build
```

### 2. Set Environment Variables

**Option A: System Environment (CI/CD)**
```bash
export JWT_SECRET="your-secret"
export ENCRYPTION_SECRET="your-secret"
export TRADING_ENGINE_URL="https://your-url"
export AVANTIS_API_URL="https://your-url"
export AVANTIS_NETWORK="base-mainnet"
export NEXT_PUBLIC_APP_URL="https://your-app-url"
export NEXT_PUBLIC_AVANTIS_NETWORK="base-mainnet"
```

**Option B: .env.local (Local Development)**
```bash
cp env.local.template .env.local
# Edit .env.local with your values
```

### 3. Start
```bash
npm run start:runtime  # Loads .env.local if exists
# or
npm start  # Uses system env vars
```

## How It Works

- **Server-side**: Reads from `process.env` at runtime
- **Client-side**: Fetches from `/api/config` endpoint at runtime
- **Build time**: No environment variables required

## Required Variables

### Server-Side
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `TRADING_ENGINE_URL`
- `AVANTIS_API_URL`
- `AVANTIS_NETWORK`

### Client-Side
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_AVANTIS_NETWORK`

## CI/CD Platforms

### GitHub Actions
Set secrets in repository settings, then:
```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  ENCRYPTION_SECRET: ${{ secrets.ENCRYPTION_SECRET }}
  # ... etc
```

### Docker
```bash
docker run -e JWT_SECRET=secret -e ENCRYPTION_SECRET=secret ...
```

### Vercel / Railway / Render
Set environment variables in platform dashboard.

## Verification

1. Check logs: `node scripts/load-runtime-env.js`
2. Test API: Visit `/api/config` to see client-side vars
3. Check server logs for missing variables

## Full Documentation

See [CI_CD_RUNTIME_ENV.md](./CI_CD_RUNTIME_ENV.md) for detailed instructions. (Note: File is in docs/ folder)

