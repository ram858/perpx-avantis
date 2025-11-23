# Web Authentication Update Summary

## Changes Made

### 1. ✅ Session Persistence
- **Fixed**: Users no longer get new accounts on each refresh
- **Implementation**: Uses localStorage to store JWT token and user data
- **Location**: `lib/auth/AuthContext.tsx` - checks localStorage first before creating new user

### 2. ✅ Mobile Number Authentication
- **New Page**: `/auth/web` - Mobile number + OTP authentication
- **Default OTP**: `123456` for all numbers (testing only)
- **API Endpoints**:
  - `POST /api/auth/web/phone` - Request OTP
  - `POST /api/auth/web/verify-otp` - Verify OTP and authenticate

### 3. ✅ Database Updates
- **Migration File**: `database/web_users_add_phone.sql`
- **New Column**: `phone_number` in `web_users` table
- **Run this in Supabase**: Copy and execute the SQL

### 4. ✅ Mainnet Configuration
- **Updated**: Explorer URLs to use mainnet (basescan.org)
- **Config**: Avantis service already configured for `base-mainnet`

### 5. ✅ Auto Wallet Creation
- **Feature**: Trading wallet automatically created on first authentication
- **Location**: `app/api/auth/web/verify-otp/route.ts`

## How It Works

1. **User visits web version** → Redirected to `/auth/web`
2. **Enters mobile number** → OTP sent (default: 123456)
3. **Enters OTP** → Verified, user created/retrieved, wallet auto-created
4. **Session stored** → Token and user data saved in localStorage
5. **On refresh** → Session restored from localStorage (no new user created)

## Database Migration Required

Run this SQL in Supabase:

```sql
-- Add phone_number column to web_users table
ALTER TABLE web_users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;

-- Create index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_web_users_phone ON web_users(phone_number);
```

## Testing

1. Visit http://localhost:3000 (web mode)
2. Should redirect to `/auth/web`
3. Enter any phone number
4. Enter OTP: `123456`
5. Should authenticate and create wallet
6. Refresh page - should stay logged in (same user, no new account)

## Files Changed

- `app/auth/web/page.tsx` - New authentication page
- `app/api/auth/web/phone/route.ts` - OTP request endpoint
- `app/api/auth/web/verify-otp/route.ts` - OTP verification endpoint
- `lib/auth/AuthContext.tsx` - Session persistence logic
- `lib/services/WebAuthService.ts` - Phone number support
- `lib/db/supabase.ts` - Database types updated
- `components/ProtectedRoute.tsx` - Allow /auth/* access
- `app/page.tsx` - Redirect to auth page
- `app/home/page.tsx` - Mainnet explorer URL

## Next Steps

1. ✅ Run database migration (add phone_number column)
2. ✅ Test authentication flow
3. ✅ Verify session persistence
4. ✅ Confirm mainnet configuration

