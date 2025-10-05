# Enterprise Authentication & Wallet Architecture

## Overview

This document outlines the complete enterprise-grade authentication and wallet management system for PrepX, built with TypeORM, JWT authentication, and multi-chain wallet support.

## Architecture Components

### 🔐 AuthModule
**Location**: `lib/modules/AuthModule.ts`

**Services**:
- `AuthService` - JWT token generation and validation
- `JwtAuthGuard` - Protects endpoints by validating Authorization: Bearer header

**Key Methods**:
- `generateJwtToken(payload)` - Signs JWT using JWT_SECRET and JWT_EXPIRATION_TIME
- `verifyToken(token)` - Verifies and decodes JWT
- `getUserById(userId)` - Fetches user by ID
- `createUser(phoneNumber)` - Creates new user

### 🎯 WalletModule
**Location**: `lib/modules/WalletModule.ts`

**Services**:
- `WalletService` - Coordinates OTP verification, JWT issuance, and wallet creation
- `EncryptionService` - Encrypts/decrypts private keys using symmetric algorithm
- `TwilioService` - Handles SMS OTP delivery

**Controllers**:
- `POST /wallet/send-otp` - Request OTP
- `POST /wallet/verify-otp` - Verify OTP, returns JWT and auto-generates chains
- `POST /wallet` - [protected] create or fetch existing wallet for a chain
- `GET /wallet/wallets` - [protected] list all wallets for authenticated user

## Database Schema

### User Entity
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 20, unique: true })
  phoneNumber: string

  @Column({ type: 'boolean', default: false })
  isVerified: boolean

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => Wallet, wallet => wallet.phoneNumber)
  wallets: Wallet[]
}
```

### Wallet Entity
```typescript
@Entity('wallets')
@Index(['phoneNumber', 'chain'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string

  @Column({ type: 'varchar', length: 32 })
  iv: string

  @Column({ type: 'text' })
  privateKey: string

  @Column({ type: 'varchar', length: 50 })
  chain: string

  @Column({ type: 'varchar', length: 100 })
  address: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

## Chain Wallet Services

### Supported Chains
1. **Ethereum** - `EthereumWalletService`
2. **Bitcoin** - `BitcoinWalletService`
3. **Solana** - `SolanaWalletService`
4. **Aptos** - `AptosWalletService`

### Generic Interface
```typescript
export interface IGenericWalletService {
  generateWallet(mnemonic?: string): Promise<WalletInfo>
  deriveWallet(mnemonic: string, derivationPath?: string): Promise<WalletInfo>
  validateAddress(address: string): boolean
  getChainName(): string
}
```

### Wallet Info Structure
```typescript
export interface WalletInfo {
  address: string
  privateKey: string
  publicKey?: string
  mnemonic?: string
}
```

## Security Features

### 🔒 Encryption Service
- **Algorithm**: AES-256-GCM (configurable via ENCRYPTION_ALGORITHM)
- **Secret**: Configurable via ENCRYPTION_SECRET
- **IV Length**: Configurable via IV_LENGTH (default: 16)
- **Methods**:
  - `encrypt(text)` - Encrypts private keys
  - `decrypt(encryptedText, iv)` - Decrypts private keys
  - `encryptGCM(text)` - GCM encryption for better security
  - `decryptGCM(encryptedText, iv, authTag)` - GCM decryption

### 🛡️ JWT Authentication
- **Secret**: Configurable via JWT_SECRET
- **Expiration**: Configurable via JWT_EXPIRATION_TIME (default: 7d)
- **Issuer**: 'prepx'
- **Audience**: 'prepx-users'
- **Features**:
  - Token verification
  - User payload extraction
  - Automatic expiration handling

### 🔐 JWT Auth Guard
- **Authorization**: Bearer token validation
- **User Extraction**: Automatic user payload extraction
- **Error Handling**: Comprehensive error responses
- **Middleware**: Seamless API route protection

## API Endpoints

### Authentication Endpoints

#### POST `/api/wallet/send-otp`
Send OTP to phone number
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "otp": "123456" // Only in development
}
```

#### POST `/api/wallet/verify-otp`
Verify OTP and authenticate user
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "phoneNumber": "+1234567890",
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Wallet Endpoints

#### POST `/api/wallet`
Create or fetch wallet for a chain
```json
Headers: {
  "Authorization": "Bearer <jwt-token>"
}
Body: {
  "chain": "ethereum",
  "mnemonic": "optional-mnemonic-phrase"
}
```

**Response**:
```json
{
  "success": true,
  "wallet": {
    "id": "wallet-uuid",
    "address": "0x742d35Cc6634C0532925a3b8D0C4C4C4C4C4C4C4",
    "chain": "ethereum",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/wallet/wallets`
List all wallets for authenticated user
```json
Headers: {
  "Authorization": "Bearer <jwt-token>"
}
```

**Response**:
```json
{
  "success": true,
  "wallets": [
    {
      "id": "wallet-uuid-1",
      "address": "0x742d35Cc6634C0532925a3b8D0C4C4C4C4C4C4C4",
      "chain": "ethereum",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "wallet-uuid-2",
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "chain": "bitcoin",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Environment Variables

### Required
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=prepx
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-postgres-password

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here-must-be-32-characters
JWT_EXPIRATION_TIME=7d

# Encryption
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_SECRET=your-32-character-encryption-secret-key
IV_LENGTH=16

# Twilio
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Optional
```bash
# SuperApp Integration
NEXT_PUBLIC_SUPERAPP_DEPLOYMENT_TOKEN=your-superapp-token

# Environment
NODE_ENV=development
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install typeorm pg twilio bip39 bitcoinjs-lib bip32 tiny-secp256k1 @solana/web3.js ed25519-hd-key @aptos-labs/ts-sdk
npm install -D @types/pg @types/bip39
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb prepx

# Run migrations (auto-sync in development)
npm run dev
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Configure your environment variables
# Edit .env.local with your actual values
```

### 4. Initialize Database
```bash
# The database will auto-initialize when the app starts
# Or run manually:
npx ts-node lib/database/init.ts
```

## Usage Examples

### 1. Authentication Flow
```typescript
// Send OTP
const response = await fetch('/api/wallet/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: '+1234567890' })
})

// Verify OTP
const verifyResponse = await fetch('/api/wallet/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: '+1234567890', otp: '123456' })
})

const { token, user } = await verifyResponse.json()
```

### 2. Wallet Creation
```typescript
// Create Ethereum wallet
const walletResponse = await fetch('/api/wallet', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ chain: 'ethereum' })
})

const { wallet } = await walletResponse.json()
```

### 3. Using Modules Directly
```typescript
import { authModule, walletModule } from '@/lib/modules'

// Generate JWT token
const token = await authModule.generateJwtToken({
  userId: 'user-id',
  phoneNumber: '+1234567890'
})

// Create wallet
const wallet = await walletModule.createOrGetWallet(
  '+1234567890',
  'ethereum'
)

// Send OTP
await walletModule.sendOTP('+1234567890', '123456')
```

## Security Considerations

### ✅ Implemented
- JWT token authentication with expiration
- Private key encryption using AES-256-GCM
- Phone number validation
- OTP expiration (5 minutes)
- Unique constraints on phone number + chain
- Secure wallet generation using industry standards

### 🔄 Production Recommendations
- Use Redis for OTP storage instead of in-memory
- Implement rate limiting on OTP endpoints
- Add audit logging for all wallet operations
- Use hardware security modules for key management
- Implement 2FA for sensitive operations
- Add IP whitelisting for admin operations
- Regular security audits and penetration testing

## Monitoring & Logging

### Database Monitoring
- Track wallet creation rates
- Monitor failed authentication attempts
- Log all OTP requests and verifications
- Track user login patterns

### Security Monitoring
- Monitor for suspicious wallet creation patterns
- Track failed JWT verification attempts
- Alert on multiple OTP requests from same IP
- Monitor for unusual encryption/decryption patterns

## Performance Considerations

### Database Optimization
- Index on phoneNumber + chain for fast wallet lookups
- Index on userId for user queries
- Consider read replicas for wallet queries
- Implement connection pooling

### Caching Strategy
- Cache user data in Redis
- Cache wallet addresses for quick lookups
- Implement JWT token blacklisting for logout

## Testing

### Unit Tests
- Test all wallet service methods
- Test encryption/decryption functions
- Test JWT token generation and verification
- Test OTP generation and validation

### Integration Tests
- Test complete authentication flow
- Test wallet creation for all supported chains
- Test database operations
- Test Twilio integration

### Security Tests
- Test JWT token security
- Test private key encryption
- Test OTP security
- Test input validation

## Deployment

### Production Checklist
- [ ] Configure production database
- [ ] Set up Redis for OTP storage
- [ ] Configure Twilio credentials
- [ ] Set up monitoring and logging
- [ ] Configure SSL/TLS
- [ ] Set up backup strategies
- [ ] Configure environment variables
- [ ] Run security audit
- [ ] Set up CI/CD pipeline
- [ ] Configure load balancing

This architecture provides a robust, scalable, and secure foundation for enterprise-grade authentication and wallet management in the PrepX trading platform.
