# Base Account Integration Guide

## Overview

This document explains how the Perpx-Avantis mini app integrates with Base Accounts for trading.

## Key Concepts

### Base Accounts
- **Smart Wallets (ERC-4337)**: Base Accounts are smart wallets, not traditional EOA wallets
- **No Private Keys**: Base Accounts don't expose private keys - they use account abstraction
- **Universal Sign-On**: One passkey works across all Base-enabled apps
- **Built-in Payments**: One-tap USDC payments via Base Account SDK

### How Trading Works with Base Accounts

1. **User Authentication**:
   - User signs in via Base App
   - App gets Base Account address via `sdk.provider.request({ method: 'eth_accounts' })`
   - User's FID (Farcaster ID) is used for identification

2. **Balance Checking**:
   - Use Base Account address to check balances on Avantis
   - Query Avantis API with the address
   - Display balance in the UI

3. **Transaction Signing**:
   - **For Base Accounts**: Use Base Account SDK to sign transactions
   - Transactions are signed via `sdk.provider.request()` methods
   - No private key needed - Base Account handles signing

4. **Trading Engine**:
   - Trading engine receives Base Account address
   - Can check balances and positions
   - For automated trading, frontend must sign transactions via Base Account SDK
   - Trading engine can't execute trades directly (no private key)

## Implementation Details

### Frontend (Next.js)

#### 1. Get Base Account Address
```typescript
// In useBaseMiniApp hook
const getBaseAccountAddress = async () => {
  const provider = sdk.provider;
  const accounts = await provider.request({ method: 'eth_accounts' });
  return accounts[0]; // Base Account address
};
```

#### 2. Store Base Account Address
- Store address in `AuthContext` when user authenticates
- Use address for balance checks and trading

#### 3. Sign Transactions
```typescript
// For Base Account transactions
const signTransaction = async (tx: TransactionRequest) => {
  const provider = sdk.provider;
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [tx],
  });
  return hash;
};
```

### Backend (Trading Engine)

#### 1. Accept Base Account Address
- Trading engine API accepts `walletAddress` and `isBaseAccount` flag
- If `isBaseAccount: true`, no private key is provided
- Trading engine stores address for balance/position queries

#### 2. Balance & Position Queries
- Use Base Account address to query Avantis API
- Check balances, positions, PnL
- All read operations work normally

#### 3. Trade Execution
- **Automated Trading**: Requires private key (not available for Base Accounts)
- **Manual Trading**: Frontend signs transactions via Base Account SDK
- Trading engine can prepare trade parameters, frontend executes

## API Changes

### Trading Start Endpoint

**Request:**
```json
{
  "maxBudget": 100,
  "profitGoal": 20,
  "maxPerSession": 3,
  "userFid": 12345,
  "walletAddress": "0x...", // Base Account address
  "isBaseAccount": true,     // Flag indicating Base Account
  "avantisApiWallet": null   // null for Base Accounts
}
```

**Response:**
```json
{
  "sessionId": "session_123",
  "status": "started",
  "note": "Base Account detected - transactions will be signed via Base Account SDK"
}
```

## Migration Path

### Current State
- App creates wallets for users
- Stores private keys
- Trading engine uses private keys for automated trading

### Target State
- Use Base Account address (no wallet creation needed)
- No private key storage
- Frontend signs transactions via Base Account SDK
- Trading engine works with addresses for queries

### Hybrid Approach (Current Implementation)
- Support both Base Accounts and traditional wallets
- If Base Account: use address, no private key
- If traditional wallet: use private key for automated trading
- Flag `isBaseAccount` indicates which type

## Benefits

1. **Better UX**: Users use their existing Base Account
2. **Security**: No private key storage needed
3. **Seamless**: Works with Base App's built-in features
4. **Compatible**: Still supports traditional wallets for automated trading

## Limitations

1. **Automated Trading**: Requires private key (not available for Base Accounts)
   - **Solution**: Use Base Account SDK on frontend for transaction signing
   - Or create a separate trading wallet for automated strategies

2. **Backend Execution**: Trading engine can't execute trades directly for Base Accounts
   - **Solution**: Frontend signs transactions, backend prepares parameters

## Next Steps

1. ✅ Get Base Account address from SDK
2. ✅ Store address in auth context
3. ✅ Update trading engine to accept Base Account addresses
4. ⏳ Implement Base Account transaction signing on frontend
5. ⏳ Update trading UI to use Base Account SDK for transactions
6. ⏳ Test end-to-end trading flow with Base Accounts

## References

- [Base Account Docs](https://docs.base.org/base-account/overview/what-is-base-account)
- [Base Mini Apps Docs](https://docs.base.org/mini-apps/quickstart/migrate-existing-apps)
- [Base Account SDK](https://docs.base.org/base-account/reference/core/getProvider)

