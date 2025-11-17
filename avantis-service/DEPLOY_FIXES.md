# Deploy Avantis Service Fixes

## Issues Fixed

1. **CORS Configuration Error**
   - Changed `cors_origins` from `list[str]` to `str` (comma-separated)
   - Added `get_cors_origins_list()` method to parse string into list
   - Updated `main.py` to use the new method

2. **Async/Sync SDK Method Detection**
   - Added `inspect.iscoroutinefunction()` checks in `contract_operations.py`
   - Now handles both async and sync SDK methods correctly
   - Prevents "object dict can't be used in 'await' expression" errors

## Files Changed

- `avantis-service/config.py` - CORS configuration fix
- `avantis-service/main.py` - CORS middleware update
- `avantis-service/contract_operations.py` - Async/sync detection for SDK methods

## Deployment Steps

### Option 1: Update Files on Server

1. **SSH into your server**

2. **Navigate to avantis-service directory:**
   ```bash
   cd /path/to/avantis-service
   ```

3. **Pull latest changes or copy updated files:**
   ```bash
   git pull
   # OR manually copy:
   # - config.py
   # - main.py
   # - contract_operations.py
   ```

4. **Restart Docker container:**
   ```bash
   docker-compose restart avantis-service
   # OR
   docker restart avantis-trading-service
   ```

5. **Verify:**
   ```bash
   curl https://avantis.superapp.gg/api/avantis/health
   ```

### Option 2: Rebuild Docker Image

1. **SSH into server**

2. **Navigate to avantis-service:**
   ```bash
   cd /path/to/avantis-service
   ```

3. **Rebuild and restart:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Check logs:**
   ```bash
   docker-compose logs -f avantis-service
   ```

## Environment Variables

Make sure these are set in your `.env` or `docker-compose.yml`:

```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
```

## Testing After Deployment

1. **Health check:**
   ```bash
   curl https://avantis.superapp.gg/api/avantis/health
   ```
   Should return: `{"status":"healthy","service":"avantis-trading-service","network":"base-mainnet"}`

2. **Test position opening:**
   ```bash
   curl -X POST "https://avantis.superapp.gg/api/avantis/api/open-position" \
     -H "Content-Type: application/json" \
     -d '{
       "symbol": "BTC",
       "collateral": 10,
       "leverage": 2,
       "is_long": true,
       "private_key": "YOUR_PRIVATE_KEY"
     }'
   ```

3. **Check positions:**
   ```bash
   curl "https://avantis.superapp.gg/api/avantis/api/positions?private_key=YOUR_PRIVATE_KEY"
   ```

## Expected Behavior

After deployment:
- ✅ Service starts without CORS errors
- ✅ Positions can be opened via API
- ✅ Positions appear on https://www.avantisfi.com/trade?asset=BTC-USD
- ✅ No "object dict can't be used in 'await' expression" errors

## Troubleshooting

If you still see errors:

1. **Check Docker logs:**
   ```bash
   docker-compose logs avantis-service | tail -50
   ```

2. **Verify environment variables:**
   ```bash
   docker-compose exec avantis-service env | grep -E "CORS|AVANTIS"
   ```

3. **Test locally first:**
   ```bash
   cd avantis-service
   python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

