# Fix Avantis Backend Service RPC Connection

## Problem
The Avantis backend service is trying to connect to `https://sepolia.base.org` (testnet) but should be using `https://mainnet.base.org` (mainnet) since your `.env.local` has `AVANTIS_NETWORK=base-mainnet`.

## Solution

The Avantis service needs to be configured with the correct network. Here are the options:

### Option 1: Set Environment Variable (Recommended)

If the service is running in production at `https://avantis.superapp.gg`, you need to set the environment variable on the server:

```bash
AVANTIS_NETWORK=base-mainnet
```

Or directly set the RPC URL:

```bash
AVANTIS_RPC_URL=https://mainnet.base.org
```

### Option 2: Update Service Configuration

If you have access to the service deployment, update the environment variables:

**For Docker/Docker Compose:**
```yaml
environment:
  - AVANTIS_NETWORK=base-mainnet
  - AVANTIS_RPC_URL=https://mainnet.base.org
```

**For systemd service:**
```ini
Environment="AVANTIS_NETWORK=base-mainnet"
Environment="AVANTIS_RPC_URL=https://mainnet.base.org"
```

**For PM2:**
```json
{
  "env": {
    "AVANTIS_NETWORK": "base-mainnet",
    "AVANTIS_RPC_URL": "https://mainnet.base.org"
  }
}
```

### Option 3: Create .env File in avantis-service Directory

If running locally, create `/Users/mokshya/Desktop/perpx-avantis/avantis-service/.env`:

```bash
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
```

### Option 4: Update Default in config.py (Not Recommended for Production)

You can change the default in `avantis-service/config.py`:

```python
avantis_network: str = "base-mainnet"  # Changed from "base-testnet"
```

## Verification

After updating, restart the Avantis service and verify:

```bash
curl https://avantis.superapp.gg/api/avantis/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "avantis-trading-service",
  "network": "base-mainnet"  // Should show base-mainnet, not base-testnet
}
```

## Current Status

- ✅ Trading Engine: Configured correctly
- ✅ Your .env.local: Has `AVANTIS_NETWORK=base-mainnet`
- ❌ Avantis Service: Still using `base-testnet` (needs update)

Once the Avantis service is updated, positions will open successfully on the mainnet!

