# Trading Engine Environment Setup

The trading engine loads environment variables from `trading-engine/.env` file.

## Quick Start

1. Copy the example file:
   ```bash
   cd trading-engine
   cp .env.example .env
   ```

2. Edit `.env` with your actual values

3. The trading engine will automatically load `.env` when started

## Environment Variables

All backend-specific variables should be in `trading-engine/.env`:

- `AVANTIS_API_URL` - Avantis API endpoint
- `BASE_RPC_URL` - Base mainnet RPC URL
- `BASE_TESTNET_RPC_URL` - Base testnet RPC URL
- `AVANTIS_NETWORK` - Network (base-mainnet or base-testnet)
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_SECRET` - Encryption key for wallet storage
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `TRADING_ENGINE_URL` - Trading engine URL (for frontend connection)
- `API_PORT` - API server port (default: 3001)
- `WEBSOCKET_PORT` - WebSocket server port (default: 3002)
- `NODE_ENV` - Environment (production, development)

## Loading Order

The trading engine loads `.env` in this order:

1. `trading-engine/.env` (loaded by dotenv.config())
2. System environment variables (override .env values)
3. Process-specific environment variables

## Docker/CI/CD

For Docker or CI/CD, you can:
- Mount `.env` file as a volume
- Set environment variables directly (they override .env)
- Use a secrets management system

Example Docker:
```dockerfile
# Copy .env file
COPY trading-engine/.env /app/trading-engine/.env

# Or use environment variables
ENV AVANTIS_API_URL=http://localhost:8000
ENV BASE_RPC_URL=https://mainnet.base.org
```

