# Production Readiness Checklist

## ✅ Build Status

- [x] **Next.js Build**: Successful
- [x] **TypeScript Compilation**: No errors
- [x] **Linting**: No errors
- [x] **Trading Engine Build**: Successful

## ✅ Code Quality

- [x] **Type Safety**: All TypeScript types valid
- [x] **No Build Errors**: Clean build output
- [x] **Signal Criteria**: Loosened for easier position opening (with TODO for production review)

## ✅ Services Configuration

### Avantis Service
- [x] **Service**: Running on port 3002
- [x] **Health Endpoint**: `/health` working
- [x] **API Endpoints**: All functional
- [x] **Configuration**: `AVANTIS_API_URL=http://localhost:3002`

### Trading Engine
- [x] **Service**: Running on port 3001
- [x] **API Endpoints**: All functional
- [x] **WebSocket**: Configured
- [x] **Configuration**: `AVANTIS_API_URL=http://localhost:3002` in `.env`

### Next.js Frontend
- [x] **Build**: Successful
- [x] **API Routes**: All functional
- [x] **Configuration**: `TRADING_ENGINE_URL` set

## ⚠️ Production Considerations

### 1. Signal Criteria (Temporary Loosening)
**Status**: Signal criteria have been loosened for easier position opening
**Location**: `trading-engine/hyperliquid/strategyEngine.ts`
**Action Required**: Review and potentially tighten criteria for production

**Current Settings**:
- Signal score: `> 0.01` (very loose)
- RSI range: `10-90` (very wide)
- ADX: `> 5` (very low)
- ATR: `> 0.01%` (very low)
- Volume: `> 0.0001` (very low)
- MOS thresholds: `-0.5` to `0.5` (very loose)

**Recommendation**: 
- Monitor trading performance
- Gradually tighten criteria based on results
- Consider A/B testing different criteria levels

### 2. Environment Variables

#### Required for Production:

**Frontend (.env.local or system env)**:
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet
NEXT_PUBLIC_AVANTIS_API_URL=https://your-avantis-service-url:3002
NEXT_PUBLIC_WS_URL=wss://your-websocket-url:3002
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
TRADING_ENGINE_URL=https://your-trading-engine-url:3001
```

**Trading Engine (trading-engine/.env)**:
```bash
NODE_ENV=production
API_PORT=3001
AVANTIS_API_URL=https://your-avantis-service-url:3002
AVANTIS_NETWORK=base-mainnet
BASE_RPC_URL=https://mainnet.base.org
JWT_SECRET=your-secure-jwt-secret
ENCRYPTION_SECRET=your-secure-encryption-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
TRADING_ENGINE_URL=https://your-trading-engine-url:3001
```

**Avantis Service (avantis-service/.env)**:
```bash
HOST=0.0.0.0
PORT=3002
DEBUG=false
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
DATABASE_URL=your-database-url
CORS_ORIGINS=https://your-production-domain.com
```

### 3. Security Checklist

- [ ] **JWT Secret**: Strong, randomly generated secret
- [ ] **Encryption Secret**: Strong, randomly generated secret
- [ ] **Database Credentials**: Securely stored, not in code
- [ ] **Private Keys**: Never logged or exposed
- [ ] **CORS**: Properly configured for production domains
- [ ] **HTTPS**: All services use HTTPS in production
- [ ] **Rate Limiting**: Consider adding rate limiting for API endpoints
- [ ] **Error Messages**: Don't expose sensitive information in errors

### 4. Monitoring & Logging

- [x] **Logging**: Console logs in place
- [ ] **Error Tracking**: Consider adding error tracking (Sentry, etc.)
- [ ] **Performance Monitoring**: Consider adding APM
- [ ] **Health Checks**: All services have health endpoints
- [ ] **Log Aggregation**: Set up log aggregation for production

### 5. Deployment

#### PM2 Configuration
- [x] **ecosystem.config.js**: Configured
- [ ] **Process Management**: PM2 configured for production
- [ ] **Auto-restart**: Enabled in PM2 config
- [ ] **Log Rotation**: Configure log rotation

#### Docker (Optional)
- [ ] **Dockerfile**: Review and update if needed
- [ ] **docker-compose.yaml**: Review for production
- [ ] **Multi-stage Build**: Optimize for production

### 6. Database

- [ ] **Migrations**: All migrations applied
- [ ] **Backups**: Backup strategy in place
- [ ] **Connection Pooling**: Configured properly
- [ ] **Indexes**: Optimized for query performance

### 7. Network & Infrastructure

- [ ] **Load Balancer**: Configure if needed
- [ ] **SSL/TLS**: Certificates configured
- [ ] **Firewall**: Properly configured
- [ ] **Ports**: Only necessary ports exposed
- [ ] **Service Discovery**: Configure if using microservices

### 8. Testing

- [ ] **Unit Tests**: Add unit tests for critical paths
- [ ] **Integration Tests**: Test API endpoints
- [ ] **E2E Tests**: Test complete user flows
- [ ] **Load Testing**: Test under production load

## 🚀 Deployment Steps

### 1. Pre-Deployment

```bash
# 1. Build application
npm run build

# 2. Type check
npm run type-check

# 3. Lint
npm run lint

# 4. Build trading engine
cd trading-engine && npm run build
```

### 2. Environment Setup

```bash
# 1. Set all required environment variables
# 2. Verify .env files are in place
# 3. Test service connections
```

### 3. Start Services

```bash
# Option 1: Using PM2
pm2 start ecosystem.config.js

# Option 2: Using START_SERVERS.sh
./START_SERVERS.sh

# Option 3: Manual
# Start Avantis Service
cd avantis-service && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 3002

# Start Trading Engine
cd trading-engine && npm start

# Start Next.js
npm start
```

### 4. Verification

```bash
# Check Avantis Service
curl https://your-avantis-service-url:3002/health

# Check Trading Engine
curl https://your-trading-engine-url:3001/api/health

# Check Frontend
curl https://your-frontend-url/api/status
```

## 📋 Post-Deployment Checklist

- [ ] All services running
- [ ] Health checks passing
- [ ] API endpoints responding
- [ ] WebSocket connections working
- [ ] Database connections stable
- [ ] Trading sessions starting
- [ ] Positions opening (when signals pass)
- [ ] Error monitoring active
- [ ] Logs being collected

## 🔧 Troubleshooting

### If services don't start:
1. Check environment variables are set
2. Verify ports are not in use
3. Check logs for errors
4. Verify dependencies are installed

### If trading doesn't work:
1. Check Avantis service is running
2. Verify `AVANTIS_API_URL` is correct
3. Check trading engine logs
4. Verify wallet has sufficient balance
5. Check signal criteria are passing

### If positions don't open:
1. Check contract minimum requirements
2. Verify wallet balance is sufficient
3. Check signal evaluation logs
4. Review rejection reasons in logs

## 📝 Notes

- Signal criteria are currently loosened for easier testing
- All services use the same trading engine (Web and Farcaster)
- Farcaster users need to deposit from Base Account to Trading wallet
- Monitor trading performance and adjust criteria as needed


