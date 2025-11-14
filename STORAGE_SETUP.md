# 🔐 Wallet Storage Setup Guide

## Current Storage System

**⚠️ IMPORTANT**: Your app currently stores wallets in the **local filesystem** as encrypted JSON files.

### What This Means

✅ **Pros**:
- Simple setup (no external database needed)
- Fast local access
- Encrypted storage (AES-256)

❌ **Cons**:
- **NOT suitable for production on Vercel/serverless** (ephemeral filesystem)
- Files lost on every deployment
- No backup/redundancy
- Single point of failure

---

## Current Setup (Development)

### 1. Storage Location

```
perpx-avantis/
└── storage/
    └── wallets/
        ├── wallet_1464243_ethereum.json      # Your trading wallet
        ├── wallet_1464243_base-account.json  # Base Account address
        └── ...
```

### 2. How It Works

When a user makes their first deposit:

1. **Backend creates wallet**:
   ```typescript
   const wallet = await ethereumService.generateWallet();
   // Returns: { address, privateKey }
   ```

2. **Encrypts private key**:
   ```typescript
   const encrypted = encryptionService.encrypt(wallet.privateKey);
   // Uses AES-256-CBC with ENCRYPTION_SECRET from .env
   ```

3. **Saves to file**:
   ```
   ./storage/wallets/wallet_{FID}_ethereum.json
   ```

4. **File contents**:
   ```json
   {
     "address": "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2",
     "encryptedPrivateKey": "9f8e7d6c5b4a...",
     "iv": "1a2b3c4d5e6f...",
     "chain": "ethereum",
     "createdAt": "2025-01-14T12:00:00.000Z"
   }
   ```

### 3. Required Environment Variables

Create a `.env.local` file:

```bash
# Copy from .env.example
cp .env.example .env.local

# Edit and set these variables:
ENCRYPTION_SECRET=your-strong-32-character-secret-here
JWT_SECRET=your-jwt-secret-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet
```

---

## ⚠️ For Production Deployment

### The Problem

Vercel and most serverless platforms have **ephemeral filesystems**:
- Files are deleted after each deployment
- No persistent storage between function invocations
- **All wallets would be lost on every deploy!**

### The Solution: Migrate to Persistent Storage

Choose one of these options:

---

## Option 1: Vercel KV (Redis) ⭐ Recommended

Vercel's managed Redis service - perfect for Next.js apps on Vercel.

### Setup

1. **Install Vercel KV**:
   ```bash
   npm install @vercel/kv
   ```

2. **Create KV Store** (in Vercel Dashboard):
   - Go to Storage → Create Database → KV
   - Connect to your project

3. **Update WalletStorageService**:

```typescript
// lib/services/WalletStorageService.ts
import { kv } from '@vercel/kv';

export class WalletStorageService {
  async storeWallet(fid: number, wallet: { address, privateKey, chain }) {
    const encrypted = this.encryptionService.encrypt(wallet.privateKey);
    
    const storedWallet = {
      address: wallet.address,
      encryptedPrivateKey: encrypted.encrypted,
      iv: encrypted.iv,
      chain: wallet.chain,
      createdAt: new Date().toISOString(),
    };
    
    // Store in Redis instead of filesystem
    const key = `wallet:${fid}:${wallet.chain}`;
    await kv.set(key, JSON.stringify(storedWallet));
  }
  
  async getWallet(fid: number, chain: string) {
    const key = `wallet:${fid}:${chain}`;
    const data = await kv.get(key);
    return data ? JSON.parse(data as string) : null;
  }
  
  async deleteWallet(fid: number, chain: string) {
    const key = `wallet:${fid}:${chain}`;
    await kv.del(key);
  }
}
```

**Pros**:
- ✅ Native Vercel integration
- ✅ Persistent storage
- ✅ Fast (Redis)
- ✅ Auto-backups
- ✅ Easy setup

**Cons**:
- 💰 Paid service (free tier available)

---

## Option 2: Upstash Redis

Alternative managed Redis service (works on any platform).

### Setup

1. **Create account**: https://upstash.com
2. **Create Redis database**
3. **Get credentials** (REST URL and token)
4. **Add to .env**:
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

5. **Use Redis client**:
   ```bash
   npm install @upstash/redis
   ```

6. **Update service** (similar to Vercel KV above)

---

## Option 3: PostgreSQL

Use a proper database for wallet storage.

### Setup

1. **Install Prisma**:
   ```bash
   npm install prisma @prisma/client
   npx prisma init
   ```

2. **Define schema** (`prisma/schema.prisma`):
   ```prisma
   model Wallet {
     id                   String   @id @default(cuid())
     fid                  Int
     address              String
     encryptedPrivateKey  String
     iv                   String
     chain                String
     createdAt            DateTime @default(now())
     
     @@unique([fid, chain])
   }
   ```

3. **Update service** to use Prisma:
   ```typescript
   await prisma.wallet.create({
     data: {
       fid,
       address,
       encryptedPrivateKey: encrypted.encrypted,
       iv: encrypted.iv,
       chain,
     }
   });
   ```

**Database Options**:
- Vercel Postgres
- Supabase (free tier)
- PlanetScale
- Neon

---

## Option 4: AWS S3

Store encrypted wallet files in S3.

### Setup

1. **Install AWS SDK**:
   ```bash
   npm install @aws-sdk/client-s3
   ```

2. **Update service**:
   ```typescript
   import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
   
   async storeWallet(fid: number, wallet) {
     const encrypted = this.encryptionService.encrypt(wallet.privateKey);
     const key = `wallets/wallet_${fid}_${wallet.chain}.json`;
     
     await s3.send(new PutObjectCommand({
       Bucket: 'your-bucket',
       Key: key,
       Body: JSON.stringify({ ...encrypted, address: wallet.address }),
     }));
   }
   ```

---

## Security Checklist

Before going to production:

### 1. Environment Variables
- [ ] Set strong `ENCRYPTION_SECRET` (32+ characters)
- [ ] Set unique `JWT_SECRET`
- [ ] Never commit `.env` files to git

### 2. Storage Security
- [ ] Migrate from filesystem to persistent storage
- [ ] Enable backups
- [ ] Encrypt at rest (if using database)
- [ ] Restrict access (IAM/permissions)

### 3. Code Security
- [ ] Private keys never logged
- [ ] Private keys never sent to frontend
- [ ] All API endpoints protected with JWT
- [ ] Input validation on all endpoints

### 4. Backup Strategy
- [ ] Regular backups of wallet data
- [ ] Tested restore procedure
- [ ] Offsite backup storage
- [ ] Document recovery process

---

## Quick Start (Development)

For local testing, the filesystem storage works fine:

1. **Create storage directory**:
   ```bash
   mkdir -p storage/wallets
   ```

2. **Set environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and set ENCRYPTION_SECRET
   ```

3. **Run dev server**:
   ```bash
   npm run dev
   ```

4. **Test deposit**:
   - Open app in Farcaster
   - Click "Add Funds"
   - Deposit $20 USDC
   - Check `./storage/wallets/` for created wallet file

---

## Migration Path

### Current State:
```
Filesystem → ./storage/wallets/wallet_{FID}_{CHAIN}.json
```

### Production State:
```
Redis/Database → Persistent storage with backups
```

### Migration Steps:

1. ✅ **Keep current code working** (done)
2. ⏳ **Choose storage solution** (Vercel KV recommended)
3. ⏳ **Update WalletStorageService** to use new storage
4. ⏳ **Test in staging environment**
5. ⏳ **Migrate existing wallets** (if any)
6. ⏳ **Deploy to production**
7. ⏳ **Monitor and verify**

---

## Summary

**Current Status**: ✅ Working for development  
**Production Ready**: ❌ Needs persistent storage migration

**Next Steps**:
1. Choose storage solution (Vercel KV recommended)
2. Update `WalletStorageService.ts`
3. Test thoroughly
4. Deploy with persistent storage

**Important**: Don't deploy to production with filesystem storage on Vercel/serverless platforms!

