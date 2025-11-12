# Potential Issues Report

## 🔴 Critical Issues

### 1. **Weak JWT Secret Default**
**Location**: `lib/services/AuthService.ts:23`
```typescript
this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
```

**Issue**: Using a weak default secret if environment variable is missing. This is a security risk.

**Fix**:
```typescript
this.jwtSecret = process.env.JWT_SECRET || (() => {
  throw new Error('JWT_SECRET environment variable is required');
})();
```

**Priority**: 🔴 Critical - Security vulnerability

---

### 2. **Missing Error Handling in Auth Endpoint**
**Location**: `app/api/auth/base-account/route.ts:40`
```typescript
const address = (payload as any).address || null;
```

**Issue**: No validation that `payload.sub` (FID) is a valid number before using it.

**Fix**: Add validation:
```typescript
const fid = payload.sub;
if (!fid || typeof fid !== 'number' || fid <= 0) {
  return NextResponse.json(
    { error: 'Invalid FID in token', fid: null },
    { status: 401 }
  );
}
```

**Priority**: 🟡 Medium - Could cause runtime errors

---

### 3. **Race Condition in Wallet Refresh**
**Location**: `lib/wallet/IntegratedWalletContext.tsx:247-252`

**Issue**: `refreshBalances` is called in useEffect without checking if component is still mounted, and `refreshBalances` depends on `state.primaryWallet` which could change.

**Current Code**:
```typescript
useEffect(() => {
  if (state.primaryWallet && (isMetaMaskConnected || metaMaskAccount)) {
    refreshBalances();
  }
}, [isMetaMaskConnected, metaMaskAccount, state.primaryWallet, refreshBalances]);
```

**Fix**: Add cleanup and mounted check:
```typescript
useEffect(() => {
  let mounted = true;
  
  if (state.primaryWallet && (isMetaMaskConnected || metaMaskAccount)) {
    refreshBalances().catch(err => {
      if (mounted) {
        console.error('[IntegratedWallet] Error refreshing balances:', err);
      }
    });
  }
  
  return () => {
    mounted = false;
  };
}, [isMetaMaskConnected, metaMaskAccount, state.primaryWallet, refreshBalances]);
```

**Priority**: 🟡 Medium - Could cause memory leaks or state updates on unmounted components

---

## 🟡 Medium Priority Issues

### 4. **Missing Input Validation in API Routes**
**Location**: `app/api/wallet/user-wallets/route.ts:81`

**Issue**: No validation of `chain` parameter before using it.

**Fix**:
```typescript
const { chain, mnemonic } = await request.json();
const chainType = chain || 'ethereum';

// Validate chain
const validChains = ['ethereum', 'bitcoin', 'solana', 'aptos'];
if (chain && !validChains.includes(chain.toLowerCase())) {
  return NextResponse.json(
    { error: `Invalid chain. Must be one of: ${validChains.join(', ')}` },
    { status: 400 }
  );
}
```

**Priority**: 🟡 Medium - Security and data integrity

---

### 5. **Excessive Console Logging in Production**
**Location**: Multiple files (239 console.log/error/warn statements found)

**Issue**: Too many console statements that should be removed or gated in production.

**Fix**: Use environment-based logging:
```typescript
const isDev = process.env.NODE_ENV === 'development';
const log = isDev ? console.log : () => {};
const logError = console.error; // Always log errors
```

**Priority**: 🟡 Medium - Performance and security (information leakage)

---

### 6. **Missing Error Boundaries in Critical Components**
**Location**: Various components

**Issue**: Not all components are wrapped in error boundaries, which could crash the entire app.

**Recommendation**: Ensure all major sections have error boundaries:
- Trading dashboard
- Wallet components
- Position displays

**Priority**: 🟡 Medium - User experience

---

### 7. **Potential Memory Leak in usePositions Hook**
**Location**: `lib/hooks/usePositions.ts:208-253`

**Issue**: The `fetchPositions` function is recreated on every render, which could cause the useEffect to run more often than needed.

**Current**: `fetchPositions` is in dependency array but recreated frequently.

**Fix**: Ensure `fetchPositions` is properly memoized with `useCallback` (it already is, but verify dependencies).

**Priority**: 🟡 Medium - Performance

---

### 8. **No Rate Limiting on API Endpoints**
**Location**: All API routes

**Issue**: API endpoints don't have rate limiting, which could lead to abuse.

**Recommendation**: Add rate limiting middleware:
```typescript
// Example with next-rate-limit or similar
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

**Priority**: 🟡 Medium - Security and performance

---

## 🟢 Low Priority / Improvements

### 9. **Type Safety: Using `any` Types**
**Location**: Multiple files

**Issues Found**:
- `lib/services/BaseAccountTransactionService.ts:22` - `sdk: any`
- `app/api/auth/base-account/route.ts:40` - `(payload as any).address`

**Recommendation**: Create proper types for SDK and payload structures.

**Priority**: 🟢 Low - Code quality

---

### 10. **Missing Request Timeout Handling**
**Location**: API routes and fetch calls

**Issue**: No timeout on API requests, which could hang indefinitely.

**Recommendation**: Add timeout to fetch calls:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  // handle error
}
```

**Priority**: 🟢 Low - User experience

---

### 11. **Inconsistent Error Messages**
**Location**: Multiple files

**Issue**: Error messages are inconsistent - some are user-friendly, others are technical.

**Recommendation**: Standardize error messages using the error handling utility.

**Priority**: 🟢 Low - User experience

---

### 12. **Missing Loading States**
**Location**: Some components

**Issue**: Not all async operations show loading states.

**Recommendation**: Ensure all async operations have loading indicators.

**Priority**: 🟢 Low - User experience

---

## 🔧 Quick Fixes Summary

### Immediate Actions Required:
1. ✅ Fix JWT secret default (throw error if missing)
2. ✅ Add FID validation in auth endpoint
3. ✅ Add input validation for chain parameter
4. ✅ Add cleanup in useEffect hooks

### Should Fix Soon:
5. ⚠️ Reduce console logging in production
6. ⚠️ Add rate limiting to API routes
7. ⚠️ Add request timeouts

### Nice to Have:
8. 💡 Improve type safety (remove `any` types)
9. 💡 Standardize error messages
10. 💡 Add more error boundaries

---

## Testing Recommendations

1. **Security Testing**:
   - Test with missing JWT_SECRET
   - Test with invalid tokens
   - Test with malformed requests

2. **Performance Testing**:
   - Test with rapid API calls (rate limiting)
   - Test memory usage over time
   - Test with slow network connections

3. **Error Handling Testing**:
   - Test with network failures
   - Test with invalid data
   - Test with concurrent requests

---

## Environment Variables Checklist

Ensure these are set in production:
- ✅ `JWT_SECRET` - Must be set (no default)
- ✅ `ENCRYPTION_SECRET` - Must be set
- ✅ `NEXT_PUBLIC_APP_URL` - Must match deployment URL
- ✅ `TRADING_ENGINE_URL` - Must be set
- ✅ `AVANTIS_API_URL` - Must be set

---

## Next Steps

1. **Immediate**: Fix critical security issues (#1, #2)
2. **This Week**: Fix medium priority issues (#3, #4, #5)
3. **This Month**: Address low priority improvements

