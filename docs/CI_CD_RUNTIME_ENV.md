# CI/CD Runtime Environment Variables Setup

This document explains how to configure your application to use environment variables at runtime instead of build time, which is essential for CI/CD deployments.

## Overview

By default, Next.js embeds environment variables at build time. This document shows how to configure the application to read environment variables at runtime, allowing CI/CD systems to inject secrets and configuration without rebuilding the application.

## Architecture

### Server-Side Variables
- **Location**: Read directly from `process.env` at runtime
- **Access**: Available in API routes, server components, and server-side code
- **Examples**: `JWT_SECRET`, `ENCRYPTION_SECRET`, `TRADING_ENGINE_URL`, `AVANTIS_API_URL`

### Client-Side Variables
- **Location**: Fetched from `/api/config` endpoint at runtime
- **Access**: Use `getRuntimeConfig()` from `lib/config/runtime-env.ts`
- **Examples**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_AVANTIS_NETWORK`, `NEXT_PUBLIC_WS_URL`

## Setup Instructions

### 1. Build the Application

Build the application **without** environment variables (they'll be injected at runtime):

```bash
npm run build
# or
pnpm build
```

The build will succeed even if environment variables are not set, as they're not required at build time.

### 2. Set Environment Variables at Runtime

#### Option A: System Environment Variables (Recommended for CI/CD)

Set environment variables in your CI/CD platform or deployment environment:

```bash
export JWT_SECRET="your-jwt-secret"
export ENCRYPTION_SECRET="your-encryption-secret"
export TRADING_ENGINE_URL="https://your-trading-engine-url"
export AVANTIS_API_URL="https://your-avantis-api-url"
export AVANTIS_NETWORK="base-mainnet"
export NEXT_PUBLIC_APP_URL="https://your-app-url"
export NEXT_PUBLIC_AVANTIS_NETWORK="base-mainnet"
# ... etc
```

#### Option B: Using .env.local File (Local Development)

For local development, you can still use `.env.local`:

```bash
# Copy the template
cp env.local.template .env.local

# Edit with your values
nano .env.local
```

The runtime loader will automatically load from `.env.local` if it exists.

#### Option C: Using the Runtime Loader Script

Use the provided script to load environment variables:

```bash
node scripts/load-runtime-env.js && npm start
```

Or use the npm script:

```bash
npm run start:runtime
```

### 3. Start the Application

Start the application with runtime environment variables:

```bash
# Using npm script (loads .env.local if exists)
npm run start:runtime

# Or directly (if env vars are in system)
npm start

# Or with PM2
pm2 start ecosystem.config.js
```

## CI/CD Platform Examples

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build application
        run: npm run build
        # Note: No env vars needed at build time
      
      - name: Deploy
        run: |
          # Set environment variables from secrets
          export JWT_SECRET="${{ secrets.JWT_SECRET }}"
          export ENCRYPTION_SECRET="${{ secrets.ENCRYPTION_SECRET }}"
          export TRADING_ENGINE_URL="${{ secrets.TRADING_ENGINE_URL }}"
          export AVANTIS_API_URL="${{ secrets.AVANTIS_API_URL }}"
          export AVANTIS_NETWORK="${{ secrets.AVANTIS_NETWORK }}"
          export NEXT_PUBLIC_APP_URL="${{ secrets.NEXT_PUBLIC_APP_URL }}"
          export NEXT_PUBLIC_AVANTIS_NETWORK="${{ secrets.NEXT_PUBLIC_AVANTIS_NETWORK }}"
          
          # Start the application
          npm start
        env:
          # Or set them here
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          ENCRYPTION_SECRET: ${{ secrets.ENCRYPTION_SECRET }}
          # ... etc
```

### Docker

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Build (no env vars needed)
RUN pnpm build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts

# Expose port
EXPOSE 3000

# Start with runtime env vars
# Environment variables should be set via docker run -e or docker-compose
CMD ["node", "scripts/load-runtime-env.js", "&&", "npm", "start"]
```

Or use docker-compose:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
      - TRADING_ENGINE_URL=${TRADING_ENGINE_URL}
      - AVANTIS_API_URL=${AVANTIS_API_URL}
      - AVANTIS_NETWORK=${AVANTIS_NETWORK}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
      - NEXT_PUBLIC_AVANTIS_NETWORK=${NEXT_PUBLIC_AVANTIS_NETWORK}
    env_file:
      - .env.production  # Optional: fallback file
```

### Vercel

Vercel automatically injects environment variables at runtime. Just set them in the Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add all required variables
4. Deploy

The `/api/config` endpoint will automatically read from `process.env` at runtime.

### Railway / Render / Heroku

These platforms allow you to set environment variables in their dashboards. The application will automatically read them at runtime.

For Railway:
```bash
railway variables set JWT_SECRET=your-secret
railway variables set ENCRYPTION_SECRET=your-secret
# ... etc
```

## Required Environment Variables

### Server-Side (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT token signing | `Q7AiXppzMCYh70WneSSoSasvncGzxL7Hcn0f9zjHa3k=` |
| `ENCRYPTION_SECRET` | Secret for wallet encryption | `your-32-character-encryption-secret` |
| `TRADING_ENGINE_URL` | Trading engine API URL | `https://avantis.superapp.gg:3001/api/trading-engine` |
| `AVANTIS_API_URL` | Avantis API URL | `https://avantis.superapp.gg:8000` |
| `AVANTIS_NETWORK` | Network (base-mainnet or base-testnet) | `base-mainnet` |

### Client-Side (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `https://avantis.superapp.gg` |
| `NEXT_PUBLIC_AVANTIS_NETWORK` | Network (must match AVANTIS_NETWORK) | `base-mainnet` |

### Optional

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL |
| `NEXT_PUBLIC_ENABLE_WEB_MODE` | Enable web fallback mode |
| `JWT_EXPIRATION_TIME` | JWT expiration time (default: 7d) |

## Using Runtime Config in Code

### Server-Side

```typescript
// In API routes or server components
import { getServerRuntimeEnv } from '@/lib/config/runtime-env';

const jwtSecret = getServerRuntimeEnv('JWT_SECRET');
const tradingEngineUrl = getServerRuntimeEnv('TRADING_ENGINE_URL');
```

Or directly:

```typescript
// Direct access (works at runtime)
const jwtSecret = process.env.JWT_SECRET;
```

### Client-Side

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getRuntimeConfig } from '@/lib/config/runtime-env';

export function MyComponent() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    getRuntimeConfig().then(setConfig);
  }, []);

  if (!config) return <div>Loading...</div>;

  return <div>App URL: {config.NEXT_PUBLIC_APP_URL}</div>;
}
```

## Verification

To verify that environment variables are being loaded at runtime:

1. **Check the logs**: The runtime loader script will log which variables are set
2. **Test the API endpoint**: Visit `/api/config` to see client-side variables
3. **Check server logs**: Server-side code will log errors if required variables are missing

## Troubleshooting

### Variables not loading

1. **Check if variables are set**: Run `node scripts/load-runtime-env.js` to see what's loaded
2. **Verify CI/CD platform**: Ensure variables are set in your deployment platform
3. **Check API endpoint**: Visit `/api/config` to see what's available client-side

### Build fails

The build should **not** require environment variables. If it does:
- Check `next.config.mjs` - ensure no env vars are required at build time
- Remove any `process.env` usage in code that runs at build time

### Client-side variables not available

- Ensure the `/api/config` endpoint is accessible
- Check browser console for errors
- Verify variables are set with `NEXT_PUBLIC_` prefix
- Use `getRuntimeConfig()` instead of direct `process.env` access

## Migration from Build-Time to Runtime

If you're migrating from build-time to runtime env vars:

1. **Remove from build scripts**: Don't set env vars during `npm run build`
2. **Update deployment**: Set env vars in your CI/CD platform
3. **Test locally**: Use `.env.local` for local development
4. **Update documentation**: Update your deployment docs

## Security Notes

- **Never commit `.env.local`** to version control
- **Use secrets management** in your CI/CD platform
- **Rotate secrets regularly**
- **Use different secrets** for different environments (dev/staging/prod)
- **Client-side variables** (`NEXT_PUBLIC_*`) are exposed to the browser - don't put secrets there

