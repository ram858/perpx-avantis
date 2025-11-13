# Balance Calculation System - Robust Implementation

## Overview

The balance calculation system in Perpx is designed to be **robust, accurate, and flicker-free**. It combines balances from multiple sources and displays them in a unified way.

## Balance Sources

### 1. Base Account (Farcaster Wallet)
- **Address**: User's Base Account address (from Farcaster)
- **Contains**: ETH (native) + ERC20 tokens (USDC, etc.)
- **Calculation**: Sum of all token values in USD

### 2. Trading Vault (Backend Wallet)
- **Address**: Backend-created trading wallet address
- **Contains**: ETH (native) + ERC20 tokens (USDC, etc.) deposited for trading
- **Calculation**: Sum of all token values in USD

## Total Portfolio Value Calculation

### Formula
```
Total Portfolio Value = Base Account Total + Trading Vault Total
```

Where:
- **Base Account Total** = ETH value + USDC value + other ERC20 token values (from Base Account)
- **Trading Vault Total** = ETH value + USDC value + other ERC20 token values (from Trading Vault)

### Implementation

**Location**: `lib/wallet/IntegratedWalletContext.tsx` → `refreshBalances()`

```typescript
// 1. Fetch Base Account balances
const balanceData = await fetchBalanceData(baseAccountAddress)
// Returns: { totalPortfolioValue, holdings: [...] }
// totalPortfolioValue = ETH + USDC + other tokens (all in USD)

// 2. Fetch Trading Vault balances (if exists)
if (tradingVaultAddress && tradingVaultAddress !== baseAccountAddress) {
  const tradingBalanceData = await fetchBalanceData(tradingVaultAddress)
  avantisBalance = tradingBalanceData.totalPortfolioValue
  // avantisBalance = ETH + USDC + other tokens from vault (all in USD)
}

// 3. Calculate final total
const baseAccountTotal = balanceData.totalPortfolioValue || 0
const tradingVaultTotal = avantisBalance || 0
const totalPortfolioValue = baseAccountTotal + tradingVaultTotal
```

## Holdings Display

### Individual Token Holdings

**Location**: `app/home/page.tsx` → `HoldingsSection`

The holdings section displays:
- **ETH**: Combined ETH from Base Account + Trading Vault (if both have ETH)
- **USDC**: Combined USDC from Base Account + Trading Vault (if both have USDC)
- **Other ERC20 tokens**: Combined from both wallets

### Deduplication Logic

**Location**: `lib/wallet/IntegratedWalletContext.tsx` → `refreshBalances()`

```typescript
// Combine holdings by token address
const combinedHoldingsMap = new Map<string, TokenBalance>()

// Add Base Account holdings
holdings.forEach(holding => {
  const key = holding.token.address.toLowerCase()
  combinedHoldingsMap.set(key, holding)
})

// Merge Trading Vault holdings
tradingVaultHoldings.forEach(vaultHolding => {
  const key = vaultHolding.token.address.toLowerCase()
  const existing = combinedHoldingsMap.get(key)
  
  if (existing) {
    // Merge: combine balances and values
    combinedHoldingsMap.set(key, {
      ...existing,
      balance: (BigInt(existing.balance) + BigInt(vaultHolding.balance)).toString(),
      balanceFormatted: `${totalAmount} ${symbol}`,
      valueUSD: existing.valueUSD + vaultHolding.valueUSD
    })
  } else {
    // New holding from vault
    combinedHoldingsMap.set(key, vaultHolding)
  }
})
```

## Validation & Robustness

### 1. Double-Check Calculation

The system validates the calculation by:
- Calculating total from individual holdings sum
- Comparing with the direct sum of Base Account + Trading Vault
- Logging warnings if discrepancy > $0.01

```typescript
// Validation
const holdingsSum = combinedHoldings.reduce((sum, holding) => {
  return sum + (holding.valueUSD || 0)
}, 0)

const difference = Math.abs(totalPortfolioValue - holdingsSum)
if (difference > 0.01) {
  console.warn(`Balance calculation discrepancy: ${difference.toFixed(2)}`)
}
```

### 2. Loading State Management

- **Prevents flickering**: Shows "Loading..." while fetching
- **Preserves previous values**: Doesn't reset to $0 during refresh
- **Single state update**: Updates all balances at once after all data is fetched

### 3. Error Handling

- **Graceful degradation**: If one wallet fails, shows the other
- **Fallback values**: Uses 0 if balance fetch fails
- **Error logging**: Comprehensive logging for debugging

## Display Structure

### Main Balance (Top)
```
Total Portfolio Balance: $59.85
```
- Shows: Base Account Total + Trading Vault Total
- Includes: ETH + USDC + all ERC20 tokens from both wallets

### Individual Holdings (Bottom)
```
Your Holdings:
- ETH: 0.0036 ETH ($9.85)
- USDC: 50.0000 USDC ($50.00)
```
- Shows: Combined holdings from both wallets
- ETH and ERC20 tokens displayed separately
- Each shows: Balance amount + USD value

## Example Calculation

### Scenario:
- **Base Account**: 0.0036 ETH ($9.85) + 30 USDC ($30.00) = **$39.85**
- **Trading Vault**: 20 USDC ($20.00) = **$20.00**
- **Total**: $39.85 + $20.00 = **$59.85**

### Display:
**Main Balance**: $59.85

**Holdings**:
- ETH: 0.0036 ETH ($9.85) ← from Base Account only
- USDC: 50.0000 USDC ($50.00) ← 30 from Base + 20 from Vault

## Key Features

### ✅ Robustness
- Handles missing wallets gracefully
- Validates calculations
- Prevents division by zero
- Handles network errors

### ✅ Accuracy
- Uses BigInt for precise balance calculations
- Proper decimal handling for different tokens
- USD conversion with real-time prices

### ✅ Performance
- Parallel fetching of all token balances
- Single state update prevents re-renders
- Memoized calculations

### ✅ User Experience
- No flickering (loading state)
- Smooth transitions
- Clear error messages
- Comprehensive logging

## Debugging

### Console Logs

When balances are fetched, you'll see:

```
[IntegratedWallet] ===== BALANCE CALCULATION BREAKDOWN =====
  Base Account Address: 0x...
  Trading Vault Address: 0x...
  Base Account Total: $39.85 (ETH + ERC20 tokens)
  Trading Vault Total: $20.00 (ETH + ERC20 tokens)
  Combined Total: $59.85
  Holdings Sum (validation): $59.85
  Difference: $0.00 ✓
  Combined Holdings Count: 2
  Individual Holdings:
    - ETH: $9.85 (0.0036 ETH)
    - USDC: $50.00 (50.0000 USDC)
[IntegratedWallet] ===========================================
```

## Testing Checklist

- [ ] Base Account balance shows correctly
- [ ] Trading Vault balance shows correctly
- [ ] Total = Base Account + Trading Vault
- [ ] Holdings show combined balances
- [ ] No flickering on load
- [ ] No flickering on refresh
- [ ] Loading state shows during fetch
- [ ] Error handling works
- [ ] Validation warnings appear if discrepancy

## Caching System

### Implementation

**Location**: `lib/wallet/IntegratedWalletContext.tsx`

The balance fetching system includes intelligent caching to reduce API calls and improve performance.

### Cache Features

1. **In-Memory Cache**
   - Uses `Map<string, BalanceCacheEntry>` for fast lookups
   - Cache key: `balance_${address.toLowerCase()}`
   - Stores: `{ data: RealBalanceData, timestamp: number }`

2. **Cache TTL (Time To Live)**
   - Default: **30 seconds**
   - Balances are cached for 30 seconds before requiring a fresh fetch
   - Reduces API calls significantly during rapid refreshes

3. **Automatic Cache Cleanup**
   - Old cache entries (>5 minutes) are automatically removed
   - Prevents memory leaks
   - Runs during each cache write

4. **Force Refresh Option**
   - `refreshBalances(true)` bypasses cache
   - Used after deposits/transactions
   - Ensures fresh data when needed

### Cache Invalidation

Cache is automatically invalidated when:
- **After deposits**: Both Base Account and Trading Vault caches cleared
- **After transactions**: Cache cleared for affected addresses
- **Manual invalidation**: `invalidateBalanceCache(address)` function available

### Usage Examples

```typescript
// Normal refresh (uses cache if available)
await refreshBalances()

// Force refresh (bypasses cache)
await refreshBalances(true)

// Invalidate specific address cache
invalidateBalanceCache('0x...')

// Clear all cache
clearBalanceCache()
```

### Cache Flow

```
1. Check cache for address
   ↓
2. If cached and < 30 seconds old → Return cached data
   ↓
3. If not cached or expired → Fetch from API
   ↓
4. Store in cache with timestamp
   ↓
5. Return fresh data
```

### Performance Benefits

- **Reduced API Calls**: 30-second cache reduces calls by ~95% during active use
- **Faster Response**: Cached data returns instantly
- **Better UX**: No loading flicker when refreshing within cache window
- **Lower Costs**: Fewer API calls = lower infrastructure costs

### Cache Logging

Console logs show cache usage:
```
[IntegratedWallet] Using cached balance for 0x... (age: 15s)
[IntegratedWallet] Fetching fresh balance data for 0x...
[IntegratedWallet] Cache invalidated for 0x...
```

## Future Improvements

1. ✅ **Caching**: Cache balance data to reduce API calls - **IMPLEMENTED**
2. **Real-time Updates**: WebSocket for live balance updates
3. **Historical Data**: Track balance over time
4. **Multi-chain Support**: Support for other chains
5. **Price Alerts**: Notify on significant balance changes
6. **Adaptive Cache TTL**: Adjust cache duration based on network conditions

