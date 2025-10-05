# Authentication System Guide

## Overview

The PrepX application now includes a comprehensive authentication system with phone number verification and automatic wallet creation.

## Features

### 🔐 Two-Step Authentication
1. **Phone Number Input**: Users enter their phone number
2. **OTP Verification**: 6-digit code sent via SMS (simulated in development)

### 🎯 Automatic Wallet Creation
- New users get a wallet created automatically upon successful authentication
- Wallet address is generated using Ethereum's wallet creation
- Private key is stored securely (in-memory for development)

### 🛡️ JWT-Based Authentication
- Secure JWT tokens with 7-day expiration
- Token verification on protected routes
- Automatic token refresh handling

## File Structure

```
app/
├── login/
│   └── page.tsx                 # Login page with 2-step flow
├── api/
│   └── auth/
│       ├── send-otp/route.ts    # Send OTP to phone number
│       ├── verify-otp/route.ts  # Verify OTP and create user
│       └── verify-token/route.ts # Verify JWT token
└── api/
    └── wallet/
        └── create/route.ts      # Create wallet for user

lib/
└── auth/
    └── AuthContext.tsx          # Authentication context and hooks

components/
└── ProtectedRoute.tsx           # Route protection component
```

## Authentication Flow

### 1. User Registration/Login
```
User enters phone number → OTP sent → User enters OTP → JWT token issued → Wallet created
```

### 2. Protected Route Access
```
User visits protected route → Check JWT token → If valid, allow access → If invalid, redirect to login
```

## API Endpoints

### POST `/api/auth/send-otp`
Send OTP to phone number
```json
{
  "phoneNumber": "+1234567890"
}
```

### POST `/api/auth/verify-otp`
Verify OTP and authenticate user
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

### POST `/api/auth/verify-token`
Verify JWT token (used by frontend)
```json
Headers: {
  "Authorization": "Bearer <jwt-token>"
}
```

### POST `/api/wallet/create`
Create wallet for authenticated user
```json
Headers: {
  "Authorization": "Bearer <jwt-token>"
}
Body: {
  "userId": "user_123",
  "phoneNumber": "+1234567890"
}
```

## Usage

### 1. Login Page
```tsx
// Navigate to /login
// User enters phone number
// OTP is sent (simulated in development)
// User enters OTP
// Authentication successful, redirect to /home
```

### 2. Protected Routes
```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute'

function MyProtectedPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  )
}
```

### 3. Authentication Context
```tsx
import { useAuth } from '@/lib/auth/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Please log in</div>
  }
  
  return (
    <div>
      <p>Welcome, {user?.phoneNumber}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Environment Variables

Create a `.env.local` file with:

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key-here

# Optional - for production SMS
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

## Development vs Production

### Development Mode
- OTP is logged to console instead of sending SMS
- In-memory storage for users and OTPs
- No external dependencies required

### Production Mode
- Integrate with SMS service (Twilio, AWS SNS, etc.)
- Use database for user storage
- Implement proper key management for wallets
- Add rate limiting and security measures

## Security Considerations

### Current Implementation
- ✅ JWT token authentication
- ✅ Phone number validation
- ✅ OTP expiration (5 minutes)
- ✅ Secure wallet generation
- ✅ Protected routes

### Production Recommendations
- 🔄 Use Redis for OTP storage
- 🔄 Implement rate limiting
- 🔄 Add phone number verification
- 🔄 Encrypt private keys
- 🔄 Add audit logging
- 🔄 Implement session management
- 🔄 Add 2FA options

## Testing

### Test Phone Numbers
In development, any valid phone number format works:
- `+1234567890`
- `1234567890`
- `+1 (555) 123-4567`

### Test OTP
In development, check the console for the OTP code.

## Troubleshooting

### Common Issues

1. **"Invalid token" error**
   - Check JWT_SECRET is set
   - Ensure token hasn't expired
   - Verify token format

2. **OTP not working**
   - Check console for OTP in development
   - Verify phone number format
   - Check OTP hasn't expired (5 minutes)

3. **Wallet creation fails**
   - Ensure user is authenticated
   - Check JWT token is valid
   - Verify user doesn't already have a wallet

### Debug Mode
Set `NODE_ENV=development` to see detailed logs and OTP codes in console.

## Next Steps

1. **SMS Integration**: Add real SMS sending for production
2. **Database Integration**: Replace in-memory storage with database
3. **Enhanced Security**: Add rate limiting, audit logs, etc.
4. **User Management**: Add user profiles, settings, etc.
5. **Wallet Management**: Add wallet import/export, multiple wallets
6. **Social Login**: Add Google, Apple, etc. login options
