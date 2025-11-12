# Wallet Integration Analysis - Farcaster Mini App

## Overview
This document compares the current Perpx wallet implementation with the [Farcaster Mini App wallet documentation](https://miniapps.farcaster.xyz/docs/guides/wallets) to identify gaps and improvements.

## Current Implementation ✅

### What You're Doing Right:
1. ✅ **SDK Integration**: Using `@farcaster/miniapp-sdk` correctly
2. ✅ **Quick Auth**: Implementing Base Account authentication via `sdk.quickAuth.getToken()`
3. ✅ **Provider Access**: Accessing Ethereum provider via `sdk.provider` (works, but not recommended method)
4. ✅ **Transaction Signing**: Implementing transaction signing via `eth_sendTransaction`
5. ✅ **Address Retrieval**: Getting wallet address via `eth_accounts` and `eth_requestAccounts`

### Current Code Locations:
- **Authentication**: `lib/hooks/useBaseMiniApp.ts` - `getBaseAccountAddress()` and `authenticate()`
- **Transaction Service**: `lib/services/BaseAccountTransactionService.ts` - `signAndSendTransaction()`
- **Wallet Context**: `lib/wallet/IntegratedWalletContext.tsx` - Wallet state management

---

## Missing Features & Recommendations

### 1. ⚠️ **Not Using Recommended Provider Method**

**Current:**
```typescript
const provider = (sdk as any)?.provider;  // Using sdk.provider directly
```

**Recommended (from docs):**
```typescript
const provider = sdk.wallet.getEthereumProvider();  // Recommended method
```

**Impact**: Low - Your current method works, but the recommended method is more explicit and future-proof.

**Location to Fix**: `lib/hooks/useBaseMiniApp.ts` line 122

---

### 2. ⚠️ **Not Using Wagmi (Recommended but Optional)**

**Current**: Direct SDK usage with custom hooks

**Recommended**: Use Wagmi with `@farcaster/miniapp-wagmi-connector` for:
- Better type safety
- Automatic connection handling
- Standardized React hooks
- Better developer experience

**Impact**: Medium - Not required, but would improve code quality and maintainability.

**What You'd Need**:
1. Install: `npm install wagmi @farcaster/miniapp-wagmi-connector`
2. Setup Wagmi config with the connector
3. Use Wagmi hooks (`useAccount`, `useConnect`, `useSendTransaction`, etc.)

---

### 3. ❌ **Missing: Automatic Connection Check**

**Current**: Manual connection check - you check `eth_accounts` and then `eth_requestAccounts`

**Recommended**: Wagmi connector automatically connects if user already has a connected wallet (`isConnected` will be true automatically)

**Impact**: Low - Your current implementation works, but automatic connection provides better UX.

**Current Code** (`lib/hooks/useBaseMiniApp.ts`):
```typescript
// You're doing this manually
const accounts = await provider.request({ method: 'eth_accounts' });
if (!accounts || accounts.length === 0) {
  const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' });
}
```

**With Wagmi**: This is handled automatically by the connector.

---

### 4. ❌ **Missing: Batch Transaction Support (EIP-5792)**

**Current**: Only single transactions via `eth_sendTransaction`

**Recommended**: Support batch transactions via `wallet_sendCalls` for:
- Approve + Swap in one step
- Multiple operations in single confirmation
- Better UX for complex DeFi interactions

**Impact**: Medium - Would improve UX for trading operations (e.g., approve USDC + open position in one step).

**Example Use Case for Perpx**:
```typescript
// Approve USDC and open position in one transaction
sendCalls({
  calls: [
    {
      to: USDC_CONTRACT,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [AVANTIS_CONTRACT, amount]
      })
    },
    {
      to: AVANTIS_CONTRACT,
      data: encodeFunctionData({
        abi: avantisAbi,
        functionName: 'openPosition',
        args: [/* position params */]
      })
    }
  ]
})
```

**Location to Add**: `lib/services/BaseAccountTransactionService.ts`

---

## Recommended Improvements

### Priority 1: Use Recommended Provider Method (Quick Fix)

**File**: `lib/hooks/useBaseMiniApp.ts`

**Change**:
```typescript
// Before
const provider = (sdk as any)?.provider;

// After
const provider = sdk.wallet?.getEthereumProvider?.() || (sdk as any)?.provider;
```

---

### Priority 2: Add Batch Transaction Support (Medium Effort)

**File**: `lib/services/BaseAccountTransactionService.ts`

**Add Method**:
```typescript
async sendBatchTransactions(calls: Array<{
  to: string;
  value?: string;
  data?: string;
}>): Promise<string> {
  if (!this.sdk?.provider) {
    throw new Error('Base Account SDK provider not available');
  }

  try {
    // Check if wallet supports batch transactions
    const hash = await this.sdk.provider.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '1.0',
        chainId: `eip155:${chainId}`, // e.g., "eip155:8453" for Base
        calls: calls.map(call => ({
          to: call.to,
          value: call.value || '0x0',
          data: call.data || '0x',
        })),
      }],
    });

    return hash as string;
  } catch (error) {
    // Fallback to individual transactions if batch not supported
    console.warn('Batch transactions not supported, falling back to individual transactions');
    // ... implement fallback
  }
}
```

---

### Priority 3: Consider Wagmi Migration (Long-term)

**Benefits**:
- Better type safety
- Standardized patterns
- Automatic connection handling
- Better React integration
- Community support

**Effort**: High - Would require refactoring wallet-related code

**Decision**: Only if you want to improve maintainability and align with ecosystem standards. Your current implementation works fine.

---

## Summary

### ✅ What's Working:
- Basic wallet connection ✅
- Transaction signing ✅
- Address retrieval ✅
- Authentication ✅

### ⚠️ Minor Improvements:
1. Use `sdk.wallet.getEthereumProvider()` instead of `sdk.provider`
2. Add automatic connection check (or use Wagmi)

### ❌ Missing Features:
1. **Batch Transactions (EIP-5792)** - Would improve UX for approve + trade operations

### 📊 Recommendation:
- **Quick Win**: Update to use `sdk.wallet.getEthereumProvider()`
- **Medium Priority**: Add batch transaction support for better UX
- **Optional**: Consider Wagmi migration for long-term maintainability

---

## References
- [Farcaster Mini App Wallet Docs](https://miniapps.farcaster.xyz/docs/guides/wallets)
- [Wagmi Documentation](https://wagmi.sh)
- [EIP-5792: wallet_sendCalls](https://eips.ethereum.org/EIPS/eip-5792)

