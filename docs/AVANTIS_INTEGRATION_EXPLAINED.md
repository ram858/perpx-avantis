# How Avantis Works in This Application

## Overview

Avantis is a decentralized perpetual trading protocol on Base network. This application integrates with Avantis to enable users to trade perpetual futures contracts (BTC, ETH, etc.) with leverage.

## Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                         │
│  - Base Mini App UI                                         │
│  - Wallet Management                                        │
│  - Trading Interface                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP/WebSocket
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Trading Engine (Node.js/TypeScript)                        │
│  - Session Management                                       │
│  - AI Trading Logic                                         │
│  - WebSocket Server                                         │
│  - Avantis Client Integration                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP API Calls
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Avantis Service (Python FastAPI)                          │
│  - Avantis SDK Wrapper                                      │
│  - Position Management                                      │
│  - Balance Queries                                          │
│  - Transaction Preparation                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Blockchain Calls
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Avantis Protocol (Base Network)                           │
│  - Smart Contracts                                          │
│  - Perpetual Trading                                        │
│  - USDC Collateral                                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Avantis Service (Python FastAPI)

**Location**: `avantis-service/`

**Purpose**: Python microservice that wraps the Avantis SDK and provides a REST API for trading operations.

**Key Features**:
- **Position Management**: Open, close, and query positions
- **Balance Queries**: Get USDC balance, allowance, and total collateral
- **Symbol Registry**: Maps trading symbols (BTC, ETH) to Avantis pair indices
- **USDC Approval**: Handles USDC token approvals for trading
- **Multi-User Support**: Each user provides their own credentials

**API Endpoints**:
```
GET  /health                    - Health check
GET  /api/positions            - Get all open positions
GET  /api/balance              - Get account balance
GET  /api/total-pnl            - Get total profit/loss
GET  /api/usdc-allowance       - Get USDC allowance
POST /api/open-position        - Open a trading position
POST /api/close-position       - Close a specific position
POST /api/close-all-positions  - Close all positions
POST /api/approve-usdc         - Approve USDC for trading
GET  /api/symbols              - Get supported symbols
```

**Configuration**:
- `AVANTIS_NETWORK`: `base-testnet` or `base-mainnet`
- `AVANTIS_PK`: Private key for trading (optional - users provide their own)
- `AVANTIS_RPC_URL`: Base network RPC endpoint

### 2. Avantis Client (TypeScript)

**Location**: `lib/services/AvantisClient.ts`

**Purpose**: TypeScript client that communicates with the Avantis Python service.

**Key Methods**:
```typescript
- openPosition(params)        - Open a position
- closePosition(pairIndex)     - Close a position
- closeAllPositions()          - Close all positions
- getPositions()               - Get all positions
- getBalance()                 - Get balance info
- approveUSDC(amount)          - Approve USDC
- getTotalPnL()                - Get total PnL
```

**Features**:
- Supports both **private key** (traditional wallets) and **address** (Base Accounts) queries
- Automatic error handling and retry logic
- Request/response interceptors for logging

### 3. Trading Engine Integration

**Location**: `trading-engine/`

**Purpose**: Node.js service that manages trading sessions and executes AI trading strategies.

**How It Uses Avantis**:
1. **Session Start**: When a user starts trading, the engine:
   - Retrieves the user's wallet (Base Account or fallback wallet)
   - Calls Avantis service to check balance and positions
   - Starts an AI trading session that makes decisions

2. **Position Execution**: When the AI decides to trade:
   - Prepares transaction data via Avantis service
   - For Base Accounts: Returns transaction data for frontend signing
   - For traditional wallets: Executes directly with private key

3. **Real-time Updates**: WebSocket server broadcasts:
   - Position updates
   - Balance changes
   - PnL calculations

### 4. Frontend Integration

**Location**: `lib/hooks/useBaseAccountTrading.ts`, `app/home/page.tsx`

**Purpose**: React hooks and components that interact with Avantis through the trading engine.

**Flow for Base Accounts**:
1. User clicks "Start Trading"
2. Frontend calls `/api/trading/start` (trading engine)
3. Trading engine calls Avantis service to check balance
4. AI trading session starts
5. When AI wants to open a position:
   - Frontend calls `/api/trading/prepare-transaction`
   - Trading engine calls Avantis service `/api/prepare/open-position`
   - Avantis service returns transaction data
   - Frontend signs transaction via Base Account SDK
   - Transaction is sent to blockchain

**Flow for Traditional Wallets**:
1. User provides private key
2. Trading engine uses private key directly with Avantis service
3. Avantis service signs and sends transactions automatically

## Wallet Types & Avantis

### Base Accounts (Smart Wallets)

**How It Works**:
- **No Private Keys**: Base Accounts use account abstraction (ERC-4337)
- **Read Operations**: Query by `address` parameter
  ```typescript
  GET /api/balance?address=0x...
  GET /api/positions?address=0x...
  ```
- **Write Operations**: Transaction preparation flow
  1. Frontend requests transaction data
  2. Avantis service prepares unsigned transaction
  3. Frontend signs via Base Account SDK
  4. Transaction sent to blockchain

**Benefits**:
- Better UX (no private key management)
- Gasless transactions (if configured)
- Social recovery

### Traditional Wallets

**How It Works**:
- **Private Key Required**: User provides private key
- **All Operations**: Use `private_key` parameter
  ```typescript
  GET /api/balance?private_key=0x...
  POST /api/open-position { private_key: "0x..." }
  ```
- **Direct Execution**: Avantis service signs and sends transactions

**Use Case**: Fallback for users without Base Accounts

## Balance & Position Tracking

### Avantis Balance Service

**Location**: `lib/wallet/avantisBalance.ts`

**Purpose**: Fetches and caches Avantis trading balance and positions.

**Key Functions**:
```typescript
getAvantisBalanceByAddress(address)    - Get balance by address (Base Accounts)
getAvantisBalance(privateKey)          - Get balance by private key
getAvantisBalanceUSD(privateKey)       - Get balance in USD
getAvantisPositions(privateKey)         - Get all positions
hasRealAvantisBalance(privateKey)       - Check if wallet has balance
```

**Caching**: 5-second TTL to reduce API calls

### Integration in Home Page

**Location**: `app/home/page.tsx`

**How It Works**:
1. Fetches user's wallet address
2. Calls `getAvantisBalanceByAddress()` or `getAvantisBalance()`
3. Displays:
   - Total Avantis balance (in USD)
   - USDC balance
   - USDC allowance
   - Open positions with PnL

## Trading Flow Example

### Scenario: User Opens a BTC Long Position

1. **User Action**: Clicks "Start Trading" in chat interface
2. **Fee Payment**: 1% of wallet balance is deducted (via `/api/trading/pay-fee`)
3. **Session Start**: Trading engine starts AI session
4. **AI Decision**: AI decides to open BTC long position
5. **Transaction Preparation**:
   ```
   Frontend → /api/trading/prepare-transaction
   Trading Engine → Avantis Service /api/prepare/open-position
   Avantis Service → Returns transaction data
   ```
6. **Transaction Signing**: Frontend signs via Base Account SDK
7. **Transaction Submission**: Transaction sent to Base network
8. **Position Opened**: Avantis protocol creates position
9. **Real-time Updates**: WebSocket broadcasts position updates

## Commission Logic

**Location**: `app/api/trading/pay-fee/route.ts`

**How It Works**:
1. When user clicks "Start Trading", commission is calculated:
   - 1% of total wallet balance (ETH + tokens + Avantis balance)
   - Minimum fee: $0.01
2. Fee is transferred to: `0xeb56286910d3Cf36Ba26958Be0BbC91D60B28799`
3. Payment options:
   - USDC (preferred)
   - ETH (fallback if USDC insufficient)
4. After fee payment, trading session starts

## Deposit Flow

**Location**: `app/api/wallet/deposit/route.ts`

**Purpose**: Move funds from the user's Base wallet into the PrepX trading vault (fallback wallet) so the automated trader can manage them.

**Steps**:
1. User opens the home page and sees the deposit form when trading balance is $0.
2. User selects asset (`USDC` or `ETH`) and amount, then clicks "Deposit".
3. Frontend calls `/api/wallet/deposit` with the desired asset/amount and the Base wallet address.
4. Backend verifies the JWT, checks the stored Base Account address, and ensures a trading wallet exists (creates one if missing).
5. Backend returns a prepared transaction:
   - `ETH`: simple transfer to the trading vault address.
   - `USDC`: ERC-20 `transfer` call to send funds to the trading vault.
6. Frontend uses the Base Mini App SDK (`eth_sendTransaction`) to sign and broadcast the transaction.
7. On success, funds appear in the trading vault wallet and are available for automated strategies.

**Notes**:
- Network configuration (chain ID, USDC address, RPC) comes from `lib/config/network.ts`.
- Deposits require running inside the Farcaster/Base mini app context.
- The trading vault is a server-side wallet stored via `WalletStorageService`, encrypted with `ENCRYPTION_SECRET`.

## Environment Configuration

**Required Variables**:
```bash
# Avantis Service URL
AVANTIS_API_URL=http://localhost:8000

# Network
AVANTIS_NETWORK=base-testnet  # or base-mainnet

# Trading Engine URL
TRADING_ENGINE_URL=http://localhost:3001

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

## Key Concepts

### Pair Indices
- Avantis uses numeric pair indices (0-15) to identify trading pairs
- Symbol registry maps symbols (BTC, ETH) to indices
- Example: BTC might be pair_index 0, ETH might be pair_index 1

### USDC Collateral
- All positions require USDC as collateral
- Users must approve USDC spending before trading
- Allowance can be unlimited (0) or limited amount

### Leverage
- Positions can use leverage (e.g., 10x)
- Higher leverage = higher risk/reward
- Leverage is set per position

### Take Profit / Stop Loss
- Optional parameters for position management
- Take Profit: Auto-close when profit target reached
- Stop Loss: Auto-close when loss limit reached

## Error Handling

### Common Errors

1. **Wallet Not Activated**:
   - Error: "Wallet does not exist on Avantis"
   - Solution: User must visit Avantis and connect wallet first

2. **Insufficient Balance**:
   - Error: "Insufficient USDC balance"
   - Solution: User needs to deposit USDC

3. **Insufficient Allowance**:
   - Error: "USDC allowance too low"
   - Solution: User must approve USDC spending

4. **Network Errors**:
   - Error: Connection refused or timeout
   - Solution: Check Avantis service is running and network config

## Security Considerations

1. **Private Keys**: Never logged or stored in plaintext
2. **Encryption**: All sensitive data encrypted at rest
3. **HTTPS**: All API calls use HTTPS in production
4. **Input Validation**: All inputs validated via Pydantic/TypeScript
5. **Address Validation**: All addresses validated before use

## Future Enhancements

1. **Transaction Preparation for Base Accounts**: Currently supports address-based queries, but write operations need transaction preparation endpoints
2. **Dynamic Symbol Registry**: Fetch pair indices from Avantis API instead of hardcoded values
3. **Real-time Price Feeds**: Integrate with Avantis price oracle
4. **Position Analytics**: Advanced PnL tracking and analytics

## Summary

Avantis integration enables:
- ✅ Perpetual futures trading on Base network
- ✅ Support for both Base Accounts and traditional wallets
- ✅ Real-time position and balance tracking
- ✅ AI-powered trading with automatic position management
- ✅ Commission-based revenue model (1% of wallet balance)

The architecture is designed for scalability, with clear separation between frontend, trading engine, and Avantis service layers.

