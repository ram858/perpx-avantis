# Web Authentication Implementation

## Overview

This implementation adds web user authentication support alongside the existing Farcaster authentication, allowing the application to work in both Farcaster (Base context) and web environments. **Web users automatically get a trading wallet created when they authenticate**, making testing seamless.

## What Was Implemented

### 1. Database Schema
- **File**: `database/web_users_migration.sql`
- Created separate tables for web users:
  - `web_users` - Stores web user accounts (email/username optional)
  - `web_wallets` - Stores wallets for web users
  - `web_wallet_metadata` - Wallet analytics
  - `web_wallet_audit_log` - Security audit logs

### 2. Services

#### WebAuthService
- **File**: `lib/services/WebAuthService.ts`
- Handles web user authentication
- Creates/gets web users
- Generates JWT tokens for web users
- Methods:
  - `createOrGetWebUser()` - Create or get web user
  - `generateJwtToken()` - Generate JWT for web user
  - `verifyToken()` - Verify web JWT token
  - `createAnonymousUser()` - Quick anonymous user creation

#### WebWalletService
- **File**: `lib/services/WebWalletService.ts`
- **Automatically creates trading wallet when user is created**
- Handles wallet operations for web users
- Methods:
  - `createTradingWalletForUser()` - **Auto-creates wallet on user creation**
  - `ensureTradingWallet()` - Ensures wallet exists (creates if needed)
  - `getWallet()` - Get wallet for user
  - `getPrivateKey()` - Get decrypted private key

### 3. API Endpoints

#### Web Authentication
- **File**: `app/api/auth/web/route.ts`
- **POST** `/api/auth/web` - Create/authenticate web user (auto-creates wallet)
- **GET** `/api/auth/web` - Get current web user info

### 4. Updated Routes (Support Both Contexts)

#### Wallet Routes
- **File**: `app/api/wallet/user-wallets/route.ts`
  - Now supports both Farcaster and Web users
  - Automatically detects context from JWT token

- **File**: `app/api/wallet/primary-with-key/route.ts`
  - Now supports both Farcaster and Web users
  - Returns private key for trading operations

### 5. Frontend Updates

#### AuthContext
- **File**: `lib/auth/AuthContext.tsx`
- Automatically authenticates web users when not in Base context
- Creates user and wallet automatically on first visit
- Updated User interface to include `webUserId`

### 6. Utilities

#### Auth Helper
- **File**: `lib/utils/authHelper.ts`
- `verifyTokenAndGetContext()` - Detects Farcaster vs Web from token

#### Database Types
- **File**: `lib/db/supabase.ts`
- Updated to include web tables in TypeScript types

## How It Works

### Farcaster Flow (Unchanged)
1. User authenticates via Base Account
2. JWT token contains FID
3. Uses `users` and `wallets` tables
4. Wallet created on deposit

### Web Flow (New)
1. User visits web version (not in Base context)
2. Frontend automatically calls `/api/auth/web`
3. **Backend creates web user AND trading wallet automatically**
4. Returns JWT token with `webUserId`
5. Uses `web_users` and `web_wallets` tables
6. **Wallet is ready immediately for testing**

## Usage

### Running Database Migration

```sql
-- Run this in your Supabase SQL editor or PostgreSQL
\i database/web_users_migration.sql
```

Or copy the contents of `database/web_users_migration.sql` and run in Supabase dashboard.

### Testing Web Authentication

1. **Start your app in web mode** (not in Base/Farcaster context)
2. The app will automatically:
   - Create a web user
   - Create a trading wallet
   - Authenticate the user
3. **No manual steps required!**

### API Usage

#### Create Web User (with auto-wallet)
```typescript
POST /api/auth/web
Content-Type: application/json

{}
// Returns: { user, token, wallet }
```

#### Get Web User Info
```typescript
GET /api/auth/web
Authorization: Bearer <token>
```

## Key Features

✅ **Automatic Wallet Creation** - Web users get trading wallet immediately  
✅ **No Breaking Changes** - Farcaster flow unchanged  
✅ **Separate Tables** - Clean separation between Farcaster and Web users  
✅ **Same Functionality** - All trading features work in both contexts  
✅ **JWT Authentication** - Ready for future enhancements  

## Environment Variables

No new environment variables required. Uses existing:
- `JWT_SECRET` - For JWT token signing
- `SUPABASE_URL` - Database connection
- `SUPABASE_SERVICE_ROLE_KEY` - Database access

## Next Steps

1. **Run the migration** in your Supabase database
2. **Test in web mode** - Visit the app outside Base context
3. **Verify wallet creation** - Check that trading wallet is auto-created
4. **Test trading** - Ensure all trading features work with web users

## Notes

- Web users are identified by `webUserId` in JWT tokens
- Farcaster users are identified by `fid` in JWT tokens
- The system automatically detects which context to use
- All existing Farcaster functionality remains unchanged

