# Trading Engine Deployment Checklist

## Before Deploying

1. **Build locally to verify no errors:**
   ```bash
   cd trading-engine
   npm run build
   ```
   ✅ Should complete without TypeScript errors

2. **Ensure all changes are committed/pushed:**
   - All `isSessionBaseAccount` references removed
   - All Base Account logic removed
   - Avantis-only trading implemented

3. **Deploy to server:**
   - Copy updated files to server
   - OR pull latest from git on server
   - Run `npm run build` on server
   - Restart the service

## If You Get `isSessionBaseAccount` Errors on Server

The server has an outdated version. Update it:

```bash
# On your server:
cd /path/to/trading-engine
git pull  # OR copy latest files
npm install
npm run build
# Restart your service (PM2/Docker/systemd)
```

## Verify Build on Server

```bash
cd trading-engine
npm run build
# Should show: "found 0 vulnerabilities" and no errors
```

## Current Status

✅ Local build: SUCCESS
✅ No TypeScript errors
✅ All Base Account references removed
✅ Ready for deployment
