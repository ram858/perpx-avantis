# How to Update Avantis Service Environment Variables

## The Problem
Your Next.js app has `AVANTIS_NETWORK=base-mainnet` in its `.env`, but the Avantis Python service is still using `base-testnet`. These are **separate services** with separate configurations.

## Solution: Update Avantis Service Environment

The Avantis service at `https://avantis.superapp.gg/api/avantis/` needs its own environment variables set.

### Option 1: If Using Docker/Docker Compose

1. **Find where the Avantis service is deployed** (likely on your server)

2. **Update the environment variables** in your docker-compose.yml or deployment config:

```yaml
environment:
  - AVANTIS_NETWORK=base-mainnet
  - AVANTIS_RPC_URL=https://mainnet.base.org
```

3. **Restart the service:**
```bash
docker-compose restart avantis-service
# or
docker restart avantis-trading-service
```

### Option 2: If Using PM2

1. **Update your PM2 ecosystem config** or set environment variables:

```bash
pm2 set AVANTIS_NETWORK base-mainnet
pm2 set AVANTIS_RPC_URL https://mainnet.base.org
pm2 restart avantis-service
```

Or in `ecosystem.config.js`:
```javascript
{
  name: 'avantis-service',
  script: 'main.py',
  env: {
    AVANTIS_NETWORK: 'base-mainnet',
    AVANTIS_RPC_URL: 'https://mainnet.base.org'
  }
}
```

### Option 3: If Using systemd

1. **Edit the service file** (usually `/etc/systemd/system/avantis-service.service`):

```ini
[Service]
Environment="AVANTIS_NETWORK=base-mainnet"
Environment="AVANTIS_RPC_URL=https://mainnet.base.org"
```

2. **Reload and restart:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart avantis-service
```

### Option 4: If Using Environment File

1. **Create/update `.env` file** in the avantis-service directory:

```bash
cd /path/to/avantis-service
echo "AVANTIS_NETWORK=base-mainnet" >> .env
echo "AVANTIS_RPC_URL=https://mainnet.base.org" >> .env
```

2. **Restart the service**

### Option 5: If Using Railway/Render/Other Platform

1. **Go to your platform's dashboard**
2. **Find the Avantis service**
3. **Update environment variables:**
   - `AVANTIS_NETWORK=base-mainnet`
   - `AVANTIS_RPC_URL=https://mainnet.base.org`
4. **Redeploy/restart the service**

## Verification

After updating, verify the service is using mainnet:

```bash
curl https://avantis.superapp.gg/api/avantis/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "avantis-trading-service",
  "network": "base-mainnet"  // ✅ Should be base-mainnet, not base-testnet
}
```

## Quick Check: How is Your Service Deployed?

Run this to check:
```bash
# Check if running in Docker
docker ps | grep avantis

# Check if running with PM2
pm2 list | grep avantis

# Check if running with systemd
systemctl status avantis-service

# Check process
ps aux | grep avantis
```

Once you identify how it's deployed, use the corresponding option above to update the environment variables.
