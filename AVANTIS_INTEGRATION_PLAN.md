# Avantis Integration Plan - Replacing Hyperliquid

## 📋 Executive Summary

This document outlines a comprehensive plan to replace Hyperliquid with Avantis as the trading protocol in the PrepX application. The integration will require updates across the frontend, backend, trading engine, and database layers.

---

## 🔍 Current Architecture Analysis

### Hyperliquid Integration Points Identified:

1. **Frontend Layer:**
   - `lib/services/HyperliquidTradingService.ts` - Main trading service
   - `lib/wallet/hyperliquidBalance.ts` - Balance fetching
   - API routes referencing Hyperliquid (trading endpoints)
   - UI components mentioning Hyperliquid

2. **Trading Engine:**
   - `trading-engine/hyperliquid/` directory - Core trading logic
   - `trading-engine/hyperliquid/hyperliquid.ts` - Main SDK integration
   - `trading-engine/hyperliquid/index.ts` - Session management
   - All strategy files using Hyperliquid APIs

3. **API Layer:**
   - `app/api/trading/start/route.ts` - Uses `hyperliquidApiWallet` parameter
   - `app/api/positions/route.ts` - Fetches positions from Hyperliquid
   - `app/api/close-position/route.ts` - Closes Hyperliquid positions
   - `trading-engine/api/server.ts` - Trading engine API server

4. **Configuration:**
   - Environment variables: `HYPERLIQUID_PK`, `HYPERLIQUID_RPC_URL`, `HYPERLIQUID_TESTNET`
   - `env.example` file

5. **Dependencies:**
   - `@nktkas/hyperliquid` SDK package
   - `viem` for account management

---

## 🎯 Avantis Integration Overview

### Key Differences to Address:

1. **SDK Structure:**
   - Hyperliquid: `@nktkas/hyperliquid` (JavaScript SDK)
   - Avantis: Python SDK with async support, but can be wrapped/used via subprocess or REST API

2. **Account Management:**
   - Hyperliquid: Direct private key to account via `viem`
   - Avantis: Uses Ethereum address with private key signing

3. **Trading Pairs:**
   - Hyperliquid: Uses coin symbols (e.g., "BTC", "ETH")
   - Avantis: Uses pair indices (e.g., `ETH/USD` with pair_index lookup)

4. **Position Management:**
   - Hyperliquid: Asset-based positions
   - Avantis: Pair-based positions with leverage support

5. **Balance/Collateral:**
   - Hyperliquid: Uses USDC as collateral
   - Avantis: Uses USDC with allowance approval mechanism

6. **Network:**
   - Hyperliquid: Proprietary L1 blockchain
   - Avantis: Built on Base (L2 Ethereum)

---

## 📝 Detailed Integration Plan

## Phase 1: Research & Preparation (Days 1-3)

### 1.1 Avantis SDK & API Research
- [ ] Review Avantis SDK documentation thoroughly
  - Study Python SDK (`avantis_trader_sdk`)
  - Understand REST API endpoints (if available)
  - Check for TypeScript/JavaScript bindings or wrapper options
- [ ] Identify Avantis API endpoints for:
  - Price feeds
  - Position queries
  - Balance queries
  - Trade execution
- [ ] Map Hyperliquid features to Avantis equivalents:
  - Order types (Market, Limit)
  - Position types (LONG, SHORT)
  - Leverage limits
  - Fee structure

### 1.2 Environment Setup
- [ ] Create Avantis testnet account
- [ ] Obtain API credentials (if required)
- [ ] Test SDK connection and basic operations
- [ ] Document Avantis-specific requirements

### 1.3 Architecture Decision: Python SDK Integration
**Decision Point:** How to integrate Python SDK in Node.js/TypeScript codebase?

**Options:**
1. **Use Python subprocess calls** (Recommended for initial integration)
   - Create Python wrapper scripts
   - Call via `child_process` in Node.js
   - Pros: Quick integration, full SDK features
   - Cons: Overhead, harder debugging

2. **Create TypeScript wrapper around REST API** (If available)
   - Direct HTTP calls to Avantis API
   - Pros: Native TypeScript, better error handling
   - Cons: May miss SDK features, need to maintain API client

3. **Use Node.js Python bridge** (e.g., `python-shell`, `node-python-bridge`)
   - Runtime integration
   - Pros: Better integration, shared memory possible
   - Cons: Complexity, dependency management

**Recommendation:** Start with Option 1 (subprocess), evaluate Option 2 if REST API is available.

---

## Phase 2: Backend Core Integration (Days 4-10)

### 2.1 Create Avantis Service Layer

#### 2.1.1 New Service Structure
```
lib/services/
├── AvantisTradingService.ts          # Main trading service (replaces HyperliquidTradingService)
├── AvantisBalanceService.ts         # Balance fetching (replaces hyperliquidBalance.ts)
└── AvantisClient.ts                 # Core Avantis client wrapper
```

**Files to Create:**
- [ ] `lib/services/AvantisClient.ts`
  - Python subprocess wrapper or REST API client
  - Account initialization
  - Network configuration (Base mainnet/testnet)
  - Error handling and retry logic

- [ ] `lib/services/AvantisTradingService.ts`
  - Start/stop trading sessions
  - Open/close positions
  - Position management
  - Session state management
  - Map existing `TradingConfig` interface

- [ ] `lib/services/AvantisBalanceService.ts`
  - Fetch account balance
  - Get USDC allowance
  - Fetch open positions
  - Calculate PnL

#### 2.1.2 Python Integration Scripts
```
trading-engine/avantis/
├── avantis_client.py               # Core Avantis SDK wrapper
├── trade_operations.py              # Trade execution functions
├── position_queries.py             # Position and balance queries
└── requirements.txt                # Python dependencies
```

**Files to Create:**
- [ ] `trading-engine/avantis/avantis_client.py`
  ```python
  # Initialize TraderClient
  # Handle private key management
  # Network configuration
  ```

- [ ] `trading-engine/avantis/trade_operations.py`
  ```python
  # open_position(symbol, collateral, leverage, is_long, tp, sl)
  # close_position(pair_index)
  # close_all_positions()
  ```

- [ ] `trading-engine/avantis/position_queries.py`
  ```python
  # get_positions()
  # get_balance()
  # get_total_pnl()
  ```

### 2.2 Update Trading Engine

#### 2.2.1 Create New Avantis Trading Module
```
trading-engine/avantis/
├── avantis.ts                      # Main Avantis integration (replaces hyperliquid.ts)
├── index.ts                        # Session runner (replaces hyperliquid/index.ts)
├── symbolResolver.ts               # Map symbols to Avantis pair indices
├── strategyEngine.ts              # Reuse existing (minimal changes)
├── regime.ts                       # Reuse existing (no changes)
└── binanceHistorical.ts           # Reuse existing (no changes)
```

**Files to Create:**
- [ ] `trading-engine/avantis/avantis.ts`
  - Replace Hyperliquid SDK calls with Avantis Python subprocess calls
  - Implement:
    - `initBlockchain()` → Initialize Avantis client
    - `getPositions()` → Query positions via Python
    - `getTotalPnL()` → Calculate total PnL
    - `closePosition()` → Close single position
    - `closeAllPositions()` → Close all positions
    - `runSignalCheckAndOpen()` → Open new position
    - `fetchPrice()` → Get market price
    - `recordExistingPositionsAsTrades()` → Track positions

- [ ] `trading-engine/avantis/index.ts`
  - Adapt session management from Hyperliquid version
  - Update cycle logic for Avantis
  - Maintain same session structure

- [ ] `trading-engine/avantis/symbolResolver.ts`
  - Map trading symbols to Avantis pair indices
  - Handle symbol format conversion (e.g., "BTC" → "BTC/USD")
  - Cache pair indices for performance

#### 2.2.2 Update Trading Engine API Server
- [ ] Update `trading-engine/api/server.ts`
  - Change `hyperliquidApiWallet` → `avantisApiWallet` (or `privateKey`)
  - Update environment variable: `HYPERLIQUID_PK` → `AVANTIS_PK`
  - Update API request validation
  - Update session initialization to use Avantis

### 2.3 Database Schema Updates (if needed)
- [ ] Review if position structure needs changes
- [ ] Update Wallet entity if Avantis requires different fields
- [ ] Add migration script if schema changes needed
- [ ] Update TypeORM entities if required

---

## Phase 3: Frontend Integration (Days 11-15)

### 3.1 Update Service Layer
- [ ] Rename/Replace `HyperliquidTradingService.ts`
  - Copy existing file to `AvantisTradingService.ts`
  - Update all method implementations
  - Change API endpoint references
  - Update error messages

- [ ] Update Balance Service
  - [ ] Replace `lib/wallet/hyperliquidBalance.ts` with `lib/wallet/avantisBalance.ts`
  - [ ] Update balance fetching logic
  - [ ] Adapt to Avantis balance structure

### 3.2 Update API Routes
- [ ] `app/api/trading/start/route.ts`
  - Change `hyperliquidApiWallet` → `avantisApiWallet` or `privateKey`
  - Update trading engine URL path if needed
  - Update request body structure

- [ ] `app/api/positions/route.ts`
  - Update to use Avantis position format
  - Adjust response structure

- [ ] `app/api/close-position/route.ts`
  - Update close position logic for Avantis

- [ ] `app/api/close-all-positions/route.ts`
  - Update to use Avantis close all logic

### 3.3 Update UI Components
- [ ] Search and replace UI text:
  - "Hyperliquid" → "Avantis" in user-facing text
  - Update help text and tooltips
  - Update error messages

- [ ] Update Trading Dashboard
  - [ ] `components/TradingDashboard.tsx` - Update any Hyperliquid references
  - [ ] Update position display format if needed

- [ ] Update Chat Interface
  - [ ] `app/chat/page.tsx` - Update trading messages
  - [ ] Update wallet connection messages

- [ ] Update Home Dashboard
  - [ ] `app/home/page.tsx` - Update balance display
  - [ ] Update wallet connection status

### 3.4 Update Configuration Files
- [ ] `env.example`
  - Replace `HYPERLIQUID_*` variables with `AVANTIS_*`
  - Add new Avantis-specific variables:
    ```
    AVANTIS_PK=0x_your_private_key_here
    AVANTIS_NETWORK=base-mainnet  # or base-testnet
    AVANTIS_PROVIDER_URL=https://mainnet.base.org
    AVANTIS_RPC_URL=https://mainnet.base.org
    ```

- [ ] Update `.env.local` (if used in development)
- [ ] Update `next.config.mjs` if API rewrites need changes

---

## Phase 4: Strategy & Signal Engine Updates (Days 16-18)

### 4.1 Symbol & Pair Mapping
- [ ] Create comprehensive symbol mapping:
  - [ ] `trading-engine/avantis/symbols/symbolRegistry.json`
    - Map symbols to Avantis pair indices
    - Store pair metadata (leverage limits, fees, etc.)

- [ ] Update symbol resolver:
  - [ ] `trading-engine/avantis/symbols/symbolResolver.ts`
    - Convert symbols to Avantis format
    - Handle pair index caching
    - Implement pair lookup fallback

### 4.2 Strategy Engine Compatibility
- [ ] Review `strategyEngine.ts`
  - Should work with minimal changes (uses OHLCV data)
  - Verify signal evaluation works with Avantis pairs

- [ ] Test signal generation:
  - [ ] Verify RSI, MACD, EMA calculations
  - [ ] Test regime detection
  - [ ] Validate entry/exit signals

### 4.3 Position Opening Logic
- [ ] Update `runSignalCheckAndOpen()`:
  - [ ] Map signal to Avantis trade input
  - [ ] Handle USDC allowance approval
  - [ ] Implement pair index lookup
  - [ ] Update order type (Market Zero Fee if available)
  - [ ] Handle slippage configuration
  - [ ] Update TP/SL setting (if different in Avantis)

---

## Phase 5: Testing & Validation (Days 19-22)

### 5.1 Unit Testing
- [ ] Test Avantis client initialization
- [ ] Test position opening/closing
- [ ] Test balance fetching
- [ ] Test PnL calculations
- [ ] Test error handling

### 5.2 Integration Testing
- [ ] Test full trading session:
  - Start session → Open positions → Monitor → Close positions
- [ ] Test API endpoints:
  - `/api/trading/start`
  - `/api/positions`
  - `/api/close-position`
  - `/api/close-all-positions`
- [ ] Test wallet connection flow
- [ ] Test session management

### 5.3 End-to-End Testing
- [ ] Test user registration → Wallet creation → Trading session
- [ ] Test balance display accuracy
- [ ] Test real-time position updates
- [ ] Test profit goal achievement flow
- [ ] Test position liquidation handling

### 5.4 Testnet Testing
- [ ] Deploy to testnet environment
- [ ] Test with testnet USDC
- [ ] Verify all trading operations
- [ ] Test error scenarios
- [ ] Performance testing

---

## Phase 6: Migration & Deployment (Days 23-25)

### 6.1 Code Migration Strategy
- [ ] **Option A: Parallel Support** (Recommended for testing)
  - Keep Hyperliquid code temporarily
  - Add feature flag: `USE_AVANTIS=true/false`
  - Allows rollback if needed

- [ ] **Option B: Direct Replacement**
  - Remove Hyperliquid code completely
  - Cleaner codebase
  - Requires thorough testing first

**Recommendation:** Start with Option A, migrate to Option B after validation.

### 6.2 Database Migration (if needed)
- [ ] Review position history data
- [ ] Create migration script if position format changed
- [ ] Backup existing data before migration
- [ ] Test migration on staging database

### 6.3 Documentation Updates
- [ ] Update README.md
- [ ] Update API documentation
- [ ] Update environment variable documentation
- [ ] Create Avantis-specific setup guide
- [ ] Update user-facing documentation

### 6.4 Deployment Checklist
- [ ] Update production environment variables
- [ ] Deploy Python dependencies (if using Python SDK)
- [ ] Update Dockerfile (if containerized)
- [ ] Verify Base network connectivity
- [ ] Test USDC approval flow
- [ ] Monitor initial production usage
- [ ] Set up error alerts

---

## Phase 7: Cleanup & Optimization (Days 26-28)

### 7.1 Remove Hyperliquid Code
- [ ] Delete `trading-engine/hyperliquid/` directory
- [ ] Remove `@nktkas/hyperliquid` dependency
- [ ] Remove Hyperliquid-related environment variables
- [ ] Clean up unused imports
- [ ] Remove Hyperliquid-specific comments

### 7.2 Code Optimization
- [ ] Optimize Python subprocess calls (if used)
- [ ] Implement connection pooling if using REST API
- [ ] Cache pair indices for performance
- [ ] Optimize balance fetching (reduce API calls)

### 7.3 Monitoring & Logging
- [ ] Update logging messages (remove Hyperliquid references)
- [ ] Add Avantis-specific metrics
- [ ] Set up monitoring for:
  - Trade execution latency
  - API error rates
  - Position update frequency
  - Balance accuracy

---

## 📦 Dependencies & Requirements

### New Dependencies

#### Python (for Avantis SDK)
```txt
avantis-trader-sdk>=latest
web3>=latest
eth-account>=latest
```

#### Node.js/TypeScript (if using subprocess)
- No new npm packages needed (use built-in `child_process`)

#### Alternative: REST API Client (if available)
```json
{
  "axios": "^1.9.0",  // Already installed
  "ethers": "^6.15.0" // Already installed
}
```

### Environment Variables to Add
```env
# Avantis Configuration
AVANTIS_PK=0x_your_private_key_here
AVANTIS_NETWORK=base-mainnet  # or base-testnet
AVANTIS_PROVIDER_URL=https://mainnet.base.org
AVANTIS_RPC_URL=https://mainnet.base.org

# Feature Flag (for gradual rollout)
USE_AVANTIS=true

# Remove/Deprecate
# HYPERLIQUID_PK
# HYPERLIQUID_RPC_URL
# HYPERLIQUID_TESTNET
```

---

## 🔄 Migration Approach

### Recommended Approach: Phased Rollout

1. **Week 1-2: Development**
   - Build Avantis integration in parallel
   - Keep Hyperliquid as fallback
   - Use feature flag to switch

2. **Week 3: Internal Testing**
   - Test with internal team
   - Fix critical bugs
   - Performance optimization

3. **Week 4: Beta Testing**
   - Enable for selected users
   - Monitor closely
   - Collect feedback

4. **Week 5: Full Migration**
   - Enable for all users
   - Monitor for 1 week
   - Remove Hyperliquid code

---

## ⚠️ Risk Assessment & Mitigation

### Risks Identified:

1. **SDK Language Mismatch**
   - Risk: Python SDK in TypeScript codebase
   - Mitigation: Use subprocess calls, consider REST API alternative

2. **Network Differences**
   - Risk: Base L2 vs Hyperliquid L1 (different gas costs, confirmation times)
   - Mitigation: Adjust timeout values, update UX expectations

3. **Position Format Differences**
   - Risk: Different position structure between protocols
   - Mitigation: Create adapter layer, comprehensive testing

4. **USDC Approval Requirements**
   - Risk: Avantis requires explicit USDC approval
   - Mitigation: Implement approval check before trading, clear user messaging

5. **Symbol/Pair Mapping**
   - Risk: Different symbol formats
   - Mitigation: Comprehensive mapping registry, fallback mechanisms

### Rollback Plan:
- Keep Hyperliquid code until Avantis is fully validated
- Use feature flag for instant rollback
- Database schema designed to support both (if needed)

---

## 📊 Success Criteria

### Functional Requirements:
- ✅ All trading operations work (open, close, monitor positions)
- ✅ Balance fetching accurate and real-time
- ✅ Position management functional
- ✅ Profit/loss calculations correct
- ✅ Session management works

### Performance Requirements:
- ✅ Trade execution < 5 seconds
- ✅ Position updates < 10 seconds
- ✅ Balance queries < 2 seconds
- ✅ No significant latency increase vs Hyperliquid

### User Experience:
- ✅ No breaking changes in UI/UX
- ✅ Clear error messages
- ✅ Smooth wallet connection flow
- ✅ Real-time updates work correctly

---

## 📅 Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Research & Preparation | 3 days | - |
| Phase 2: Backend Core Integration | 7 days | Phase 1 |
| Phase 3: Frontend Integration | 5 days | Phase 2 |
| Phase 4: Strategy Updates | 3 days | Phase 2 |
| Phase 5: Testing & Validation | 4 days | Phase 3, 4 |
| Phase 6: Migration & Deployment | 3 days | Phase 5 |
| Phase 7: Cleanup & Optimization | 3 days | Phase 6 |
| **Total** | **28 days** | ~4 weeks |

---

## 👥 Resources Needed

### Development:
- 1 Full-stack developer (TypeScript/Node.js)
- 1 Python developer (for SDK integration)
- 1 QA engineer (for testing)

### Infrastructure:
- Avantis testnet access
- Base network RPC endpoint
- Test USDC for testnet

---

## 📝 Additional Notes

### Key Decisions Needed:
1. **Python SDK Integration Method:** Subprocess vs REST API vs Bridge
2. **Migration Strategy:** Parallel support vs direct replacement
3. **Feature Flag:** Enable/disable Avantis per user or globally
4. **Backward Compatibility:** Support both protocols temporarily?

### Questions to Resolve:
1. Does Avantis provide REST API (avoiding Python subprocess)?
2. Are there TypeScript/JavaScript bindings for Avantis SDK?
3. What are the exact fee structures and leverage limits?
4. How does position liquidation work in Avantis?
5. What are the rate limits for Avantis API?

---

## ✅ Next Steps (After Approval)

1. Confirm integration approach (Python subprocess vs REST API)
2. Set up Avantis testnet account
3. Create feature branch: `feature/avantis-integration`
4. Begin Phase 1: Research & Preparation
5. Schedule weekly progress reviews

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**Status:** Planning Phase - Awaiting Approval


