# 🔐 Wallet Storage System - Without Database

## Where Are Wallets Stored?

**Answer**: Wallets are stored in the **local filesystem** as encrypted JSON files.

### Storage Location

**Default Path**: `./storage/wallets/`  
**File Pattern**: `wallet_{FID}_{CHAIN}.json`

**Example Files**:
- `wallet_1464243_ethereum.json` - Trading wallet for FID 1464243
- `wallet_1464243_base-account.json` - Base Account address for FID 1464243

### Storage Configuration

```typescript
// lib/services/WalletStorageService.ts
constructor() {
  this.storagePath = process.env.WALLET_STORAGE_PATH || './storage/wallets';
}
```

**Environment Variable**: `WALLET_STORAGE_PATH`  
**Default**: `./storage/wallets` (in project root)

---

## How Wallets Are Created

### 1. Trading Wallet Creation Flow

**When**: First deposit or when user starts trading

```typescript
// lib/services/BaseAccountWalletService.ts

async ensureTradingWallet(fid: number) {
  // Check if wallet exists
  const existing = await this.getWalletWithKey(fid, 'ethereum');
  if (existing && existing.privateKey) {
    return existing; // Already exists
  }
  
  // Create new wallet
  return await this.createTradingWallet(fid, 'ethereum');
}

async createTradingWallet(fid: number, chain: string) {
  // Step 1: Generate new Ethereum wallet
  const ethereumService = new EthereumWalletService();
  const walletInfo = await ethereumService.generateWallet();
  // Returns: { address, privateKey, mnemonic }
  
  // Step 2: Encrypt and store wallet
  await this.walletStorage.storeWallet(fid, {
    address: walletInfo.address,
    privateKey: walletInfo.privateKey, // Will be encrypted
    chain: chain,
  });
  
  return {
    id: `fid_${fid}_ethereum`,
    address: walletInfo.address,
    chain: chain,
    privateKey: walletInfo.privateKey,
    createdAt: new Date(),
  };
}
```

### 2. Storage Process

```typescript
// lib/services/WalletStorageService.ts

async storeWallet(fid: number, wallet: { address, privateKey, chain }) {
  // Step 1: Encrypt private key
  const encrypted = this.encryptionService.encrypt(wallet.privateKey);
  
  // Step 2: Create JSON structure
  const storedWallet = {
    address: wallet.address,
    encryptedPrivateKey: encrypted.encrypted,
    iv: encrypted.iv, // Initialization vector for decryption
    chain: wallet.chain,
    createdAt: new Date().toISOString(),
  };
  
  // Step 3: Save to file
  const filePath = `${storagePath}/wallet_${fid}_${chain}.json`;
  await fs.writeFile(filePath, JSON.stringify(storedWallet, null, 2));
}
```

**File Contents Example**:
```json
{
  "address": "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2",
  "encryptedPrivateKey": "a1b2c3d4...", // AES-256 encrypted
  "iv": "1a2b3c4d...", // Initialization vector
  "chain": "ethereum",
  "createdAt": "2025-01-14T12:00:00.000Z"
}
```

---

## How Wallets Are Fetched

### 1. Get Wallet Address Only

```typescript
// lib/services/BaseAccountWalletService.ts

async getWalletAddress(fid: number, chain: string) {
  return await this.walletStorage.getWalletAddress(fid, chain);
}

// lib/services/WalletStorageService.ts
async getWalletAddress(fid: number, chain: string) {
  // Step 1: Read file
  const filePath = `${storagePath}/wallet_${fid}_${chain}.json`;
  const stored = await fs.readFile(filePath, 'utf-8');
  const wallet = JSON.parse(stored);
  
  // Step 2: Return address only (no decryption needed)
  return wallet.address;
}
```

### 2. Get Wallet With Private Key

```typescript
// lib/services/BaseAccountWalletService.ts

async getWalletWithKey(fid: number, chain: string) {
  // Step 1: Get stored wallet
  const stored = await this.walletStorage.getWallet(fid, chain);
  
  if (!stored) return null;
  
  // Step 2: Decrypt private key
  const privateKey = await this.walletStorage.getPrivateKey(fid, chain);
  
  // Step 3: Return wallet object
  return {
    id: `fid_${fid}_${chain}`,
    address: stored.address,
    chain: stored.chain,
    privateKey: privateKey,
    createdAt: new Date(stored.createdAt),
  };
}

// lib/services/WalletStorageService.ts
async getPrivateKey(fid: number, chain: string) {
  // Step 1: Read encrypted wallet
  const stored = await this.getWallet(fid, chain);
  
  // Step 2: Decrypt private key
  const decrypted = this.encryptionService.decrypt(
    stored.encryptedPrivateKey,
    stored.iv
  );
  
  return decrypted;
}
```

---

## Encryption Details

### Encryption Service

```typescript
// lib/services/EncryptionService.ts

export class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private key: Buffer;
  
  constructor() {
    // Encryption key from environment variable
    const secretKey = process.env.ENCRYPTION_KEY || 'default-key';
    // Create 32-byte key for AES-256
    this.key = crypto.createHash('sha256').update(secretKey).digest();
  }
  
  encrypt(text: string) {
    // Generate random IV (initialization vector)
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex')
    };
  }
  
  decrypt(encrypted: string, ivHex: string) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**Security Features**:
- ✅ AES-256-CBC encryption
- ✅ Unique IV for each wallet
- ✅ 32-byte encryption key from environment
- ✅ Private keys never stored in plaintext
- ✅ Encryption key separate from storage

---

## Complete Flow Example

### User deposits $20 USDC for the first time:

1. **Frontend calls deposit API**
   ```typescript
   POST /api/wallet/deposit
   Body: { asset: 'USDC', amount: '20', baseAddress: '0x711B...' }
   ```

2. **Backend ensures trading wallet exists**
   ```typescript
   const tradingWallet = await walletService.ensureTradingWallet(fid);
   ```

3. **Check if wallet file exists**
   ```typescript
   // Try to read: ./storage/wallets/wallet_1464243_ethereum.json
   const existing = await fs.readFile(filePath);
   // Returns null (file doesn't exist)
   ```

4. **Generate new wallet**
   ```typescript
   const { address, privateKey } = ethereumService.generateWallet();
   // address: "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2"
   // privateKey: "0xa1b2c3d4..." (64 hex chars)
   ```

5. **Encrypt private key**
   ```typescript
   const encrypted = encryptionService.encrypt(privateKey);
   // encrypted: "9f8e7d6c..." (hex)
   // iv: "1a2b3c4d..." (hex)
   ```

6. **Save to file**
   ```typescript
   await fs.writeFile(
     './storage/wallets/wallet_1464243_ethereum.json',
     JSON.stringify({
       address: "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2",
       encryptedPrivateKey: "9f8e7d6c...",
       iv: "1a2b3c4d...",
       chain: "ethereum",
       createdAt: "2025-01-14T12:00:00.000Z"
     })
   );
   ```

7. **Return wallet address for deposit**
   ```typescript
   return {
     depositAddress: "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2",
     transaction: { ... }
   };
   ```

---

## Storage Directory Structure

```
perpx-avantis/
├── storage/
│   └── wallets/
│       ├── wallet_1464243_ethereum.json      # Trading wallet
│       ├── wallet_1464243_base-account.json  # Base Account address
│       ├── wallet_567890_ethereum.json       # Another user's wallet
│       └── ...
├── lib/
│   └── services/
│       ├── WalletStorageService.ts          # File I/O
│       ├── EncryptionService.ts             # Encryption/Decryption
│       └── BaseAccountWalletService.ts      # Wallet management
└── app/
    └── api/
        └── wallet/
            └── deposit/route.ts             # Uses walletService
```

---

## Security Considerations

### ✅ Secure:
- Private keys encrypted with AES-256
- Unique IV for each wallet
- Encryption key from environment variable
- Files only accessible on server (not exposed to client)
- Private keys never sent to frontend

### ⚠️ Important:
1. **Set `ENCRYPTION_KEY` in production**: Don't use default key
2. **Backup `./storage/wallets` directory**: Losing files = losing wallets
3. **Secure file permissions**: Only server process should read/write
4. **Use proper hosting**: Ensure persistent storage (Vercel has ephemeral filesystem)

---

## Production Recommendations

### For Production Deployment:

1. **Use Persistent Storage**
   - ❌ Vercel (ephemeral filesystem)
   - ✅ AWS S3 + encryption
   - ✅ Redis/Valkey (encrypted)
   - ✅ PostgreSQL (encrypted column)
   - ✅ Vercel KV (Redis-based)

2. **Update WalletStorageService**
   ```typescript
   // Instead of filesystem, use Redis/KV:
   import { kv } from '@vercel/kv';
   
   async storeWallet(fid, wallet) {
     await kv.set(`wallet:${fid}:${chain}`, JSON.stringify(wallet));
   }
   
   async getWallet(fid, chain) {
     const data = await kv.get(`wallet:${fid}:${chain}`);
     return JSON.parse(data);
   }
   ```

3. **Set Environment Variables**
   ```env
   ENCRYPTION_KEY=<strong-random-key>  # 32+ characters
   WALLET_STORAGE_PATH=./storage/wallets # Or S3 bucket
   ```

---

## Summary

**Storage Method**: Local filesystem (JSON files)  
**Location**: `./storage/wallets/wallet_{FID}_{CHAIN}.json`  
**Encryption**: AES-256-CBC with unique IV per wallet  
**Creation**: On-demand (first deposit or trading action)  
**Retrieval**: Decrypt on-the-fly when needed  

**For Production**: Migrate to persistent storage (Redis, S3, PostgreSQL, etc.)

