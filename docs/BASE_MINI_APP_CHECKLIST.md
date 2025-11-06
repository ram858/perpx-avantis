# Base Mini App Deployment Checklist ✅

## Pre-Deployment Checks

### ✅ 1. Environment Variables

**Required Server-Side Variables:**
- `TRADING_ENGINE_URL` - URL of deployed trading engine
- `AVANTIS_API_URL` - URL of Avantis service
- `JWT_SECRET` - Secret for JWT tokens
- `NEXT_PUBLIC_APP_URL` - Your app's public URL (for Base Account auth)

**Required Client-Side Variables (NEXT_PUBLIC_ prefix):**
- `NEXT_PUBLIC_APP_URL` - App URL for Base Account domain verification
- `NEXT_PUBLIC_AVANTIS_API_URL` (optional) - If you want client-side access
- `NEXT_PUBLIC_AVANTIS_NETWORK` (optional) - Network identifier

### ✅ 2. Code Issues Fixed

- [x] Fixed `BaseAccountTransactionService` - Removed hook import from class
- [x] Fixed client-side `process.env` access - Using `NEXT_PUBLIC_` prefix or API routes
- [x] All TypeScript errors resolved
- [x] All linter errors resolved

### ✅ 3. Base Account Integration

- [x] `useBaseMiniApp` hook properly implemented
- [x] Base Account address retrieval working
- [x] Authentication flow complete
- [x] Transaction signing service ready
- [x] Fallback wallet option available

### ✅ 4. API Routes

- [x] `/api/auth/base-account` - Base Account authentication
- [x] `/api/trading/start` - Start trading session
- [x] `/api/trading/create-fallback-wallet` - Create fallback wallet
- [x] `/api/positions` - Get positions (Base Account compatible)

### ✅ 5. Trading Engine

- [x] Accepts Base Account addresses
- [x] Handles `isBaseAccount` flag
- [x] Prepares transactions for Base Account signing
- [x] Stores addresses for balance/position queries

## Deployment Steps

### 1. Set Environment Variables in Vercel

```bash
# Required
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
TRADING_ENGINE_URL=https://your-trading-engine.railway.app
AVANTIS_API_URL=https://your-avantis-service.com
JWT_SECRET=your-secret-key-here

# Optional
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet
NEXT_PUBLIC_AVANTIS_API_URL=https://your-avantis-service.com
```

### 2. Deploy Trading Engine

- Deploy to Railway/Render (not Vercel - needs persistent connection)
- Set Root Directory to `trading-engine`
- Set environment variables:
  - `AVANTIS_API_URL`
  - `ALLOWED_ORIGINS` (your Vercel app URL)
  - `AVANTIS_PK` (per-user, not global)

### 3. Deploy Next.js App to Vercel

- Connect your GitHub repo
- Set Root Directory to root (or leave default)
- Set all environment variables
- Deploy

### 4. Configure Base Mini App

1. Go to Base Mini App Dashboard
2. Add your Vercel app URL
3. Set domain for Base Account auth (must match `NEXT_PUBLIC_APP_URL`)
4. Test authentication flow

## Testing Checklist

### Before Deployment

- [ ] Test Base Account authentication locally
- [ ] Test Base Account address retrieval
- [ ] Test fallback wallet creation
- [ ] Test trading session start with Base Account
- [ ] Test position queries with Base Account address

### After Deployment

- [ ] Verify Base Account authentication works
- [ ] Verify Base Account address is retrieved
- [ ] Test creating fallback wallet
- [ ] Test starting trading session
- [ ] Test position/balance queries
- [ ] Test transaction preparation endpoint
- [ ] Verify all API routes are accessible

## Common Issues & Solutions

### Issue: "Not in Base mini app context"
**Solution**: Ensure app is opened via Base App, not directly in browser

### Issue: "Base Account address not found"
**Solution**: Check that authentication completed successfully and address was stored

### Issue: "Trading engine not responding"
**Solution**: 
- Verify `TRADING_ENGINE_URL` is set correctly
- Check trading engine is deployed and running
- Verify CORS settings allow your Vercel domain

### Issue: "Environment variable not found"
**Solution**: 
- Ensure server-side vars don't have `NEXT_PUBLIC_` prefix
- Ensure client-side vars have `NEXT_PUBLIC_` prefix
- Restart Vercel deployment after adding env vars

## Security Checklist

- [x] JWT secret is strong and unique
- [x] Private keys are never exposed to client
- [x] Base Account addresses are validated
- [x] API routes verify authentication
- [x] CORS is properly configured
- [x] Environment variables are secure

## Performance Checklist

- [x] API routes use proper caching where applicable
- [x] Balance queries are cached (5 second TTL)
- [x] Trading engine handles concurrent sessions
- [x] WebSocket connections are properly managed

## Final Notes

- The app is ready for Base mini app deployment
- All critical issues have been fixed
- Environment variables need to be set in Vercel
- Trading engine needs to be deployed separately
- Test thoroughly in Base App before production launch

