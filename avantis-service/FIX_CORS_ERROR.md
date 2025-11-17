# Fix CORS Origins Error in Avantis Service

## Problem
The Avantis service is failing to start with:
```
pydantic_settings.sources.SettingsError: error parsing value for field "cors_origins"
json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

## Root Cause
The `cors_origins` field in `config.py` is defined as `list[str]`, but Pydantic is trying to parse it from the `.env` file as JSON, which fails if:
- The value is empty
- The value is not valid JSON
- The value is a comma-separated string (not JSON array)

## Solution

### Option 1: Update config.py (Code Fix - Recommended)

I've updated `config.py` to:
1. Accept `cors_origins` as a comma-separated string
2. Provide a method to convert it to a list

**Changes made:**
- Changed `cors_origins: list[str]` to `cors_origins: str`
- Added `get_cors_origins_list()` method to parse the string

### Option 2: Set CORS_ORIGINS in .env (Environment Fix)

On your server, set the `CORS_ORIGINS` environment variable:

```bash
# In your .env file or docker-compose.yml:
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg
```

**For Docker:**
```yaml
environment:
  - CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg
```

### Option 3: Use JSON Array Format

If you want to keep it as a list, use JSON format in .env:
```bash
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","https://avantis.superapp.gg"]
```

## Quick Fix on Server

1. **SSH into your server**

2. **Update the .env file or docker-compose.yml:**
   ```bash
   # Add or update:
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg
   ```

3. **OR update config.py** (if you have access):
   - Change `cors_origins: list[str]` to `cors_origins: str`
   - Update `main.py` to use `settings.get_cors_origins_list()`

4. **Restart the service:**
   ```bash
   docker-compose restart avantis-service
   # OR
   docker restart avantis-trading-service
   ```

5. **Verify:**
   ```bash
   curl https://avantis.superapp.gg/api/avantis/health
   ```

## Expected Result

After fixing, the health check should return:
```json
{
  "status": "healthy",
  "service": "avantis-trading-service",
  "network": "base-mainnet"
}
```

