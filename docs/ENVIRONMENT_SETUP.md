# Environment Variables Setup

This document describes the environment variable setup for CI/CD and Docker compliance.

## Overview

The application is split into two parts:
1. **Next.js Frontend** - Uses `NEXT_PUBLIC_*` variables for client-side access
2. **Trading Engine Backend** - Uses its own `.env` file in `trading-engine/` directory

## Frontend Environment Variables

Location: Root `.env.local` or `.env` (for CI/CD)

### Required Variables (Client-side accessible - `NEXT_PUBLIC_*`)

```bash
# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# Avantis Configuration
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet
NEXT_PUBLIC_AVANTIS_API_URL=http://localhost:3002

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Base Network RPC URLs
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_TESTNET_RPC_URL=https://sepolia.base.org

# Database Configuration (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Web Mode
NEXT_PUBLIC_ENABLE_WEB_MODE=false
```

### Server-side Only Variables (API Routes)

```bash
# Trading Engine URL (used by API routes to connect to backend)
TRADING_ENGINE_URL=http://localhost:3001
```

**Note:** `TRADING_ENGINE_URL` is only available in API routes (server-side), not in client-side code.

## Trading Engine Environment Variables

Location: `trading-engine/.env`

```bash
# Server Configuration
NODE_ENV=production
API_PORT=3001
WEBSOCKET_PORT=3002

# Trading Engine URL
TRADING_ENGINE_URL=http://localhost:3001

# Avantis API Configuration
AVANTIS_API_URL=http://localhost:3002
AVANTIS_NETWORK=base-mainnet

# Base Network RPC URLs
BASE_RPC_URL=https://mainnet.base.org
BASE_TESTNET_RPC_URL=https://sepolia.base.org

# Authentication & Security
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION_TIME=7d
ENCRYPTION_SECRET=your-encryption-secret-key-here

# Database Configuration (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Trading Configuration Defaults
DEFAULT_MAX_BUDGET=1000
DEFAULT_PROFIT_GOAL=100
DEFAULT_MAX_POSITIONS=5
```

## CI/CD Setup

### Docker/Container Deployment

1. **Frontend Container:**
   - Set `NEXT_PUBLIC_*` variables as environment variables
   - Set `TRADING_ENGINE_URL` as environment variable
   - Variables are read at runtime (no build-time dependency)

2. **Trading Engine Container:**
   - Mount `trading-engine/.env` file or set environment variables
   - The trading engine loads `.env` from its own directory

### Environment Variable Injection

The frontend uses runtime configuration via `/api/config` endpoint, which allows:
- Variables to be injected at runtime (not just build time)
- CI/CD systems to set variables without rebuilding
- Docker containers to use environment variables

## Variable Naming Convention

- **`NEXT_PUBLIC_*`**: Client-side accessible (exposed to browser)
- **No prefix**: Server-side only (API routes, server components)

## Migration Notes

All backend-specific variables have been moved to `trading-engine/.env`:
- `AVANTIS_API_URL` → `trading-engine/.env`
- `BASE_RPC_URL` → `trading-engine/.env`
- `BASE_TESTNET_RPC_URL` → `trading-engine/.env`
- `AVANTIS_NETWORK` → `trading-engine/.env`
- `JWT_SECRET` → `trading-engine/.env`
- `ENCRYPTION_SECRET` → `trading-engine/.env`
- `SUPABASE_URL` → `trading-engine/.env`
- `SUPABASE_SERVICE_ROLE_KEY` → `trading-engine/.env`

Frontend only needs:
- `NEXT_PUBLIC_*` variables for client-side access
- `TRADING_ENGINE_URL` for API routes to connect to backend

## Testing

1. **Local Development:**
   ```bash
   # Frontend
   cp .env.example .env.local
   # Edit .env.local with your values
   
   # Trading Engine
   cd trading-engine
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Verify Setup:**
   - Frontend should read `NEXT_PUBLIC_*` variables
   - Trading engine should read from `trading-engine/.env`
   - API routes should connect to trading engine using `TRADING_ENGINE_URL`

