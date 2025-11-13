# Wallet Connection & Avantis Trading Flow

## Table of Contents
1. [Overview](#overview)
2. [Wallet Connection Flow](#wallet-connection-flow)
3. [Authentication & User Creation](#authentication--user-creation)
4. [Wallet Display in Perpx Mini App](#wallet-display-in-perpx-mini-app)
5. [Deposit Flow](#deposit-flow)
6. [Avantis Trading Flow](#avantis-trading-flow)
7. [API Endpoints Reference](#api-endpoints-reference)

---

## Overview

Perpx is a Base mini app that integrates with Farcaster wallets (Base Accounts) for authentication and trading on Avantis protocol. The system uses:

- **Base Account (Farcaster Wallet)**: Smart wallet (ERC-4337) for user authentication and main funds
- **Trading Vault (Backend Wallet)**: Traditional wallet with private key for automated trading
- **Avantis Protocol**: Decentralized perpetual trading platform

---

## Wallet Connection Flow

### Step 1: User Opens Perpx Mini App

When a user opens Perpx inside the Base/Farcaster app:

```
User → Opens Base App → Navigates to Perpx Mini App
```

### Step 2: Base SDK Initialization

The app initializes the Base Mini App SDK:

**Location**: `lib/hooks/useBaseMiniApp.ts`

```typescript
// SDK is automatically initialized when app loads
const sdk = await getBaseMiniAppSDK()
```

### Step 3: Sign Message & Get JWT Token

The app requests authentication from Base Account:

**Location**: `lib/hooks/useBaseMiniApp.ts` → `authenticate()`

```typescript
// Get JWT token from Base Account (Quick Auth)
const { token } = await sdk.quickAuth.getToken()
```

**What happens:**
- Base Account SDK handles the signing flow
- User may see a prompt to sign/approve (if not already authenticated)
- Base Account returns a JWT token containing the user's FID (Farcaster ID)

### Step 4: Get Base Account Address

The app retrieves the user's Base Account address:

```typescript
// Get Base Account address
const provider = sdk.provider
const accounts = await provider.request({ method: 'eth_accounts' })
const address = accounts[0] // Base Account address
```

### Step 5: Verify Token with Backend

The app sends the Base Account JWT token to the backend for verification:

**Frontend**: `lib/hooks/useBaseMiniApp.ts`
**Backend**: `app/api/auth/base-account/route.ts`

```typescript
// Frontend sends token to backend
const response = await sdk.quickAuth.fetch(
  `${baseUrl}/api/auth/base-account?address=${address}`,
  {
    headers: { Authorization: `Bearer ${token}` }
  }
)
```

**Backend Process:**
1. Receives Base Account JWT token
2. Verifies token using Base Account client
3. Extracts FID (Farcaster ID) from token
4. Creates or retrieves user account
5. Stores Base Account address
6. Generates internal JWT token
7. Returns FID, address, and internal JWT token

---

## Authentication & User Creation

### Backend Authentication Flow

**Location**: `app/api/auth/base-account/route.ts`

```typescript
// 1. Verify Base Account JWT token
const payload = await client.verifyJwt({ token: baseToken, domain })
const fid = payload.sub // Extract FID

// 2. Validate FID
if (!fid || typeof fid !== 'number' || fid <= 0) {
  return error
}

// 3. Create or get user by FID
const user = await authService.createUserByFid(fid)
```

### User Account Creation

**Location**: `lib/services/AuthService.ts` → `createUserByFid()`

```typescript
async createUserByFid(fid: number): Promise<User> {
  // Check if user already exists
  const existingUser = await this.getUserByFid(fid)
  if (existingUser) {
    return existingUser
  }

  // Create new user object
  const user = {
    id: `fid_${fid}`,
    fid: fid,
    phoneNumber: null,
    isVerified: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  }

  // Save to database (if available)
  await db.createUserByFid(fid)

  return user
}
```

### Generate Internal JWT Token

After user creation, backend generates an internal JWT token for API requests:

```typescript
const internalToken = await authService.generateJwtToken({
  userId: user.id,
  fid: fid,
})
```

**Token Payload:**
```json
{
  "userId": "fid_12345",
  "fid": 12345,
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "prepx",
  "aud": "prepx-users"
}
```

### Store Base Account Address

Backend stores the Base Account address for the user:

```typescript
await walletService.storeBaseAccountAddress(fid, address, 'ethereum')
```

**Storage:**
- Address is stored in wallet storage service
- Linked to user's FID
- Used for balance queries and trading

### Response to Frontend

Backend returns:

```json
{
  "fid": 12345,
  "address": "0x...",
  "token": "internal_jwt_token_here",
  "user": {
    "id": "fid_12345",
    "fid": 12345,
    "baseAccountAddress": "0x...",
    "hasWallet": true
  }
}
```

---

## Wallet Display in Perpx Mini App

### Wallet State Management

**Location**: `lib/wallet/IntegratedWalletContext.tsx`

The app maintains wallet state:

```typescript
interface IntegratedWalletState {
  isConnected: boolean
  primaryWallet: ClientUserWallet | null // Base Account wallet
  tradingWallet: ClientUserWallet | null // Trading vault wallet
  baseAccountAddress: string | null
  tradingWalletAddress: string | null
  allWallets: ClientUserWallet[]
  ethBalance: string
  ethBalanceFormatted: string
  holdings: TokenBalance[]
  totalPortfolioValue: number
  avantisBalance: number // Trading vault balance
  isLoading: boolean
}
```

### Fetching Wallets

**Location**: `lib/wallet/IntegratedWalletContext.tsx` → `refreshWallets()`

```typescript
// Fetch wallets from API
const wallets = await clientWalletService.getAllUserWallets()

// Separate Base Account and Trading Wallet
const baseWallet = wallets.find(w => w.walletType === 'base-account')
const tradingWallet = wallets.find(w => w.walletType === 'trading')
```

**API Endpoint**: `GET /api/wallet/user-wallets`

Returns:
```json
{
  "wallets": [
    {
      "id": "fid_12345_base-account",
      "address": "0x...",
      "chain": "base",
      "walletType": "base-account"
    },
    {
      "id": "fid_12345_trading",
      "address": "0x...",
      "chain": "ethereum",
      "walletType": "trading"
    }
  ]
}
```

### Displaying Wallets in UI

**Location**: `app/home/page.tsx`

The home page displays:

1. **Total Portfolio Balance**
   - Shows: `Base Account Balance + Trading Vault Balance`
   - Component: `PortfolioBalanceCard`

2. **Your Holdings**
   - Lists all tokens from both wallets
   - Shows: ETH, USDC, etc.
   - Component: `HoldingsSection`

3. **Wallet Info**
   - Base Account address
   - Trading Vault address (if exists)
   - Component: `WalletInfoCard`

### Balance Calculation

**Location**: `lib/wallet/IntegratedWalletContext.tsx` → `refreshBalances()`

```typescript
// 1. Fetch Base Account balances
const balanceData = await fetchBalanceData(baseAccountAddress)
// Returns: { totalPortfolioValue, holdings: [...] }

// 2. Fetch Trading Vault balances (if exists)
if (tradingWalletAddress && tradingWalletAddress !== baseAccountAddress) {
  const tradingBalanceData = await fetchBalanceData(tradingWalletAddress)
  avantisBalance = tradingBalanceData.totalPortfolioValue
}

// 3. Calculate total
const totalPortfolioValue = balanceData.totalPortfolioValue + avantisBalance
```

---

## Deposit Flow

### Overview

Users can deposit ETH or USDC from their Farcaster wallet (Base Account) to the backend trading vault for automated trading.

### Step 1: User Clicks Deposit Button

**Location**: `app/home/page.tsx` → `TradingCard` component

The deposit form appears when:
- Trading vault balance is $0
- User wants to fund automated trading

**UI Elements:**
- Asset selector: USDC or ETH
- Amount input field
- Deposit button
- Shows: Base wallet address and Trading vault address

### Step 2: Prepare Deposit Transaction

**Frontend**: `app/home/page.tsx` → `handleDeposit()`

```typescript
const handleDeposit = async ({ amount, asset }) => {
  // Call deposit API
  const response = await fetch('/api/wallet/deposit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      asset, // 'USDC' or 'ETH'
      amount,
      baseAddress: baseAccountAddress
    })
  })
}
```

### Step 3: Backend Prepares Transaction

**Location**: `app/api/wallet/deposit/route.ts`

```typescript
// 1. Verify authentication
const payload = await authService.verifyToken(token)

// 2. Get Base Account address
const baseAddress = await walletService.getBaseAccountAddress(payload.fid)

// 3. Ensure trading wallet exists (create if needed)
const tradingWallet = await walletService.ensureTradingWallet(payload.fid)
const destination = tradingWallet.address

// 4. Prepare transaction
if (asset === 'ETH') {
  transaction = {
    from: baseAddress,
    to: destination,
    value: ethers.parseEther(amount),
    data: '0x'
  }
} else if (asset === 'USDC') {
  transaction = {
    from: baseAddress,
    to: network.usdcAddress, // USDC contract address
    value: '0x0',
    data: ERC20_INTERFACE.encodeFunctionData('transfer', [destination, amountInUnits])
  }
}
```

### Step 4: Frontend Signs Transaction

**Location**: `app/home/page.tsx` → `handleDeposit()`

```typescript
// Sign and send transaction via Base Account SDK
const txHash = await signAndSendTransaction(transaction)

// Wait for confirmation
await waitForTransaction(txHash, 2)

// Refresh balances
await refreshBalances()
```

**Base Account SDK Signing:**
```typescript
// Location: lib/hooks/useBaseAccountTransactions.ts
const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [transaction]
})
```

### Step 5: Transaction Confirmation

After transaction is confirmed:
- Funds are transferred from Base Account → Trading Vault
- Balances are refreshed automatically
- User sees updated total balance

### Transaction Flow Diagram

```
User Clicks Deposit
    ↓
Frontend: POST /api/wallet/deposit
    ↓
Backend: Verify auth, get addresses, prepare transaction
    ↓
Backend: Return transaction data
    ↓
Frontend: Sign transaction via Base Account SDK
    ↓
Transaction sent to blockchain
    ↓
Wait for confirmation
    ↓
Refresh balances
    ↓
Display updated balance
```

---

## Avantis Trading Flow

### Overview

Avantis is a decentralized perpetual trading protocol. Perpx integrates with Avantis to enable trading of perpetual futures.

### Architecture

```
Perpx Frontend
    ↓
Next.js API Routes (/api/trading/*)
    ↓
Trading Engine (Node.js)
    ↓
Avantis Service (Python)
    ↓
Avantis Protocol (Smart Contracts)
```

### Trading Modes

#### 1. Manual Trading (Base Account)

**Flow:**
1. User selects trading parameters
2. Frontend calls `/api/trading/prepare-transaction`
3. Trading engine prepares transaction via Avantis service
4. Frontend signs transaction via Base Account SDK
5. Transaction sent to blockchain

**Location**: `lib/hooks/useBaseAccountTrading.ts`

```typescript
const prepareAndSignTransaction = async (params) => {
  // 1. Prepare transaction
  const response = await fetch('/api/trading/prepare-transaction', {
    method: 'POST',
    body: JSON.stringify(params)
  })
  
  const { transaction } = await response.json()
  
  // 2. Sign via Base Account SDK
  const txHash = await signAndSendTransaction(transaction)
  
  return { success: true, txHash }
}
```

#### 2. Automated Trading (Trading Vault)

**Flow:**
1. User starts trading session
2. Trading engine uses trading vault private key
3. Avantis service signs transactions automatically
4. No user interaction needed

**Location**: `app/api/trading/start/route.ts`

```typescript
// Get trading wallet with private key
const tradingWallet = await walletService.getWalletWithKey(fid, 'ethereum')

// Send to trading engine
await fetch(`${tradingEngineUrl}/api/trading/start`, {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: tradingWallet.address,
    avantisApiWallet: tradingWallet.privateKey, // For automated trading
    isBaseAccount: false
  })
})
```

### Opening a Position

#### Step 1: Prepare Transaction

**API**: `POST /api/trading/prepare-transaction`

**Request:**
```json
{
  "action": "open-position",
  "symbol": "BTC",
  "collateral": 100,
  "leverage": 10,
  "is_long": true,
  "tp": 50000,
  "sl": 40000
}
```

**Backend Process:**
1. Verify authentication
2. Get user's wallet address
3. Call Avantis service to prepare transaction
4. Return transaction data

**Location**: `app/api/trading/prepare-transaction/route.ts`

```typescript
// Call Avantis service
const avantisResponse = await fetch(`${avantisServiceUrl}/api/prepare/open-position`, {
  method: 'POST',
  body: JSON.stringify({
    symbol,
    collateral,
    leverage,
    is_long,
    tp,
    sl,
    wallet_address: walletAddress
  })
})

// Return transaction data
return {
  transaction: {
    to: contractAddress,
    data: encodedTransaction,
    value: '0x0',
    gas: estimatedGas
  }
}
```

#### Step 2: Sign & Execute

**Frontend:**
```typescript
// Sign transaction
const txHash = await signAndSendTransaction(transaction)

// Wait for confirmation
await waitForTransaction(txHash)
```

#### Step 3: Position Opened

After confirmation:
- Position appears in user's portfolio
- PnL tracking begins
- Real-time updates via WebSocket

### Closing a Position

**API**: `POST /api/trading/close-position`

**Request:**
```json
{
  "pair_index": 0
}
```

**Process:**
1. Verify authentication
2. Get user's wallet
3. Call Avantis service to close position
4. Sign transaction (if Base Account) or auto-sign (if trading vault)
5. Position closed, PnL calculated

### Trading Engine Integration

**Location**: `trading-engine/`

The trading engine:
- Manages trading sessions
- Tracks positions and PnL
- Communicates with Avantis service
- Provides WebSocket updates

**Key Endpoints:**
- `POST /api/trading/start` - Start trading session
- `POST /api/trading/stop` - Stop trading session
- `GET /api/trading/session/:id` - Get session status
- `GET /api/positions` - Get user positions

### Avantis Service

**Location**: `avantis-service/`

Python service that:
- Interacts with Avantis smart contracts
- Prepares transaction data
- Executes trades (with private key)
- Queries balances and positions

**Key Endpoints:**
- `POST /api/open-position` - Open position
- `POST /api/close-position` - Close position
- `GET /api/balance` - Get balance
- `GET /api/positions` - Get positions

---

## API Endpoints Reference

### Authentication

#### `GET /api/auth/base-account`
Verify Base Account token and create user

**Headers:**
```
Authorization: Bearer <base_account_jwt_token>
```

**Query Params:**
- `address` (optional): Base Account address

**Response:**
```json
{
  "fid": 12345,
  "address": "0x...",
  "token": "internal_jwt_token",
  "user": {
    "id": "fid_12345",
    "fid": 12345,
    "baseAccountAddress": "0x...",
    "hasWallet": true
  }
}
```

### Wallet Management

#### `GET /api/wallet/user-wallets`
Get user's wallets

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
```

**Response:**
```json
{
  "wallets": [
    {
      "id": "fid_12345_base-account",
      "address": "0x...",
      "chain": "base",
      "walletType": "base-account"
    },
    {
      "id": "fid_12345_trading",
      "address": "0x...",
      "chain": "ethereum",
      "walletType": "trading"
    }
  ]
}
```

#### `GET /api/wallet/balances`
Get wallet balances

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
```

**Query Params:**
- `address`: Wallet address

**Response:**
```json
{
  "address": "0x...",
  "balance": {
    "ethBalance": "0.0036",
    "ethBalanceFormatted": "0.0036 ETH",
    "totalPortfolioValue": 39.85,
    "holdings": [
      {
        "token": {
          "symbol": "ETH",
          "name": "Ethereum",
          "address": "0x0000...",
          "decimals": 18,
          "isNative": true
        },
        "balance": "3600000000000000",
        "balanceFormatted": "0.0036 ETH",
        "valueUSD": 9.85
      },
      {
        "token": {
          "symbol": "USDC",
          "name": "USD Coin",
          "address": "0x8335...",
          "decimals": 6
        },
        "balance": "30000000",
        "balanceFormatted": "30.0000 USDC",
        "valueUSD": 30.00
      }
    ]
  }
}
```

### Deposits

#### `POST /api/wallet/deposit`
Prepare deposit transaction

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "asset": "USDC",
  "amount": "20",
  "baseAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "asset": "USDC",
  "amount": "20",
  "depositAddress": "0x...",
  "transaction": {
    "from": "0x...",
    "to": "0x8335...",
    "value": "0x0",
    "data": "0x...",
    "gas": "0x30d40"
  }
}
```

### Trading

#### `POST /api/trading/start`
Start trading session

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "totalBudget": 100,
  "profitGoal": 20,
  "maxPerSession": 5,
  "leverage": 10
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_123",
  "status": "started"
}
```

#### `POST /api/trading/prepare-transaction`
Prepare trading transaction

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "action": "open-position",
  "symbol": "BTC",
  "collateral": 100,
  "leverage": 10,
  "is_long": true
}
```

**Response:**
```json
{
  "transaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "0x0",
    "gas": "0x186a0"
  },
  "params": {
    "symbol": "BTC",
    "collateral": 100,
    "leverage": 10
  }
}
```

#### `GET /api/positions`
Get user positions

**Headers:**
```
Authorization: Bearer <internal_jwt_token>
```

**Response:**
```json
{
  "positions": [
    {
      "pair_index": 0,
      "symbol": "BTC",
      "is_long": true,
      "collateral": 100,
      "leverage": 10,
      "entry_price": 45000,
      "current_price": 46000,
      "pnl": 22.22,
      "pnl_percentage": 22.22
    }
  ]
}
```

---

## Security Considerations

### Authentication
- Base Account JWT tokens are verified using Base Account client
- Internal JWT tokens are signed with secret key
- Tokens expire after 1 hour

### Private Keys
- Trading vault private keys are encrypted at rest
- Private keys are never exposed to frontend
- Only used server-side for automated trading

### Transaction Signing
- Base Account transactions require user approval
- Trading vault transactions are signed server-side
- All transactions are logged for audit

---

## Error Handling

### Common Errors

1. **Unauthorized (401)**
   - Token missing or invalid
   - Solution: Re-authenticate

2. **No Wallet Found (404)**
   - User doesn't have a wallet
   - Solution: Create wallet first

3. **Insufficient Balance (400)**
   - Not enough funds for transaction
   - Solution: Deposit more funds

4. **Transaction Failed (500)**
   - Blockchain transaction failed
   - Solution: Check transaction on BaseScan

---

## Testing

### Local Development

1. **Start Services:**
   ```bash
   # Next.js app
   npm run dev
   
   # Trading engine
   cd trading-engine && npm start
   
   # Avantis service
   cd avantis-service && python -m uvicorn main:app --reload
   ```

2. **Test Authentication:**
   - Open app in Base app
   - Should auto-authenticate
   - Check console for FID and address

3. **Test Deposit:**
   - Click deposit button
   - Enter amount
   - Sign transaction
   - Verify balance updates

4. **Test Trading:**
   - Start trading session
   - Open position
   - Check positions endpoint
   - Close position

---

## Troubleshooting

### Wallet Not Showing
- Check if user is authenticated
- Verify FID is stored
- Check wallet API response

### Balance Not Updating
- Wait for transaction confirmation
- Manually refresh balances
- Check console logs for errors

### Deposit Failing
- Verify Base Account has funds
- Check transaction on BaseScan
- Ensure correct network (Base)

### Trading Not Working
- Verify trading vault has funds
- Check trading engine is running
- Verify Avantis service is accessible

---

## Future Improvements

1. **Multi-chain Support**
   - Support for other chains
   - Cross-chain deposits

2. **Enhanced Security**
   - Multi-sig wallets
   - Hardware wallet support

3. **Better UX**
   - Transaction status tracking
   - Real-time balance updates
   - Push notifications

4. **Advanced Trading**
   - More trading strategies
   - Portfolio management
   - Risk management tools

