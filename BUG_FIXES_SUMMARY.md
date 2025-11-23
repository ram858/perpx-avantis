# Bug Fixes Summary

## Issues Fixed

### 1. ✅ Wallet Not Being Created After OTP Verification
**Problem**: Wallet was being created in the backend (logs confirmed), but frontend wasn't detecting it.

**Root Cause**: 
- `IntegratedWalletContext.refreshWallets()` only checked for `user?.fid`
- Web users have `user?.webUserId` instead
- So wallets were never loaded for web users

**Fix Applied**:
- Updated `refreshWallets()` to check for both `user?.fid` OR `user?.webUserId`
- Updated `createWallet()` to support web users
- Updated `useEffect` that loads wallets to support web users
- Updated dependencies to include `webUserId`

**Files Changed**:
- `lib/wallet/IntegratedWalletContext.tsx`

### 2. ✅ Positions Auto-Starting
**Problem**: Positions were being fetched even when user wasn't authenticated or had no wallet.

**Root Cause**:
- `usePositions` hook was fetching positions regardless of token/wallet status
- Polling was starting even without authentication

**Fix Applied**:
- Added token check before starting polling
- Set empty positions if no token
- Only start polling if token exists
- Only resume polling when tab becomes visible if token exists

**Files Changed**:
- `lib/hooks/usePositions.ts`

### 3. ✅ Auto-Create Wallet Effect
**Problem**: Home page auto-create wallet effect only worked for Farcaster users.

**Fix Applied**:
- Updated to skip auto-create for web users (they get wallet during OTP verification)
- Only auto-create for Farcaster users who don't have a wallet

**Files Changed**:
- `app/home/page.tsx`

## Testing

After these fixes:
1. ✅ Wallet should be detected immediately after OTP verification
2. ✅ Positions should only fetch when user is authenticated
3. ✅ No auto-starting of positions when not logged in

## Next Steps

1. Test OTP verification - wallet should appear immediately
2. Check that positions don't auto-fetch before authentication
3. Verify wallet shows up in the UI after login

