# ✅ Answer: Where Are Backend Wallets & Private Keys Stored?

## Quick Answer

**Without a database, wallets are stored in the LOCAL FILESYSTEM as ENCRYPTED JSON files.**

**Location**: `./storage/wallets/wallet_{FID}_{CHAIN}.json`

---

## How It Works

### 1. When User Makes First Deposit

```
User deposits $20 USDC
    ↓
Backend checks if trading wallet exists
    ↓
Wallet doesn't exist → Create new one
    ↓
Generate Ethereum wallet (address + private key)
    ↓
Encrypt private key with AES-256
    ↓
Save to file: ./storage/wallets/wallet_1464243_ethereum.json
    ↓
Return wallet address to frontend
```

### 2. File Structure

**File**: `./storage/wallets/wallet_1464243_ethereum.json`

**Contents**:
```json
{
  "address": "0x02608AA820C9192141E009eB9fCAE649Db7a5FF2",
  "encryptedPrivateKey": "9f8e7d6c5b4a3210...", // AES-256 encrypted
  "iv": "1a2b3c4d5e6f7890...",                  // Initialization vector
  "chain": "ethereum",
  "createdAt": "2025-01-14T12:00:00.000Z"
}
```

### 3. How They're Fetched

**Get Wallet Address Only**:
```typescript
// Read JSON file
const file = await fs.readFile('./storage/wallets/wallet_1464243_ethereum.json');
const wallet = JSON.parse(file);
return wallet.address; // No decryption needed
```

**Get Wallet With Private Key**:
```typescript
// Read JSON file
const file = await fs.readFile('./storage/wallets/wallet_1464243_ethereum.json');
const wallet = JSON.parse(file);

// Decrypt private key
const decrypted = encryptionService.decrypt(
  wallet.encryptedPrivateKey,
  wallet.iv
);

return {
  address: wallet.address,
  privateKey: decrypted // Only on backend, never sent to frontend
};
```

---

## Code Flow

### Creation (`BaseAccountWalletService.ts`)

```typescript
async ensureTradingWallet(fid: number) {
  // Check if exists
  const existing = await this.walletStorage.getWallet(fid, 'ethereum');
  if (existing) return existing; // Already have it
  
  // Create new wallet
  return await this.createTradingWallet(fid, 'ethereum');
}

async createTradingWallet(fid: number, chain: string) {
  // Generate new Ethereum wallet
  const wallet = await ethereumService.generateWallet();
  // Returns: { address: "0x...", privateKey: "0x..." }
  
  // Encrypt and save
  await this.walletStorage.storeWallet(fid, {
    address: wallet.address,
    privateKey: wallet.privateKey,
    chain: chain
  });
  
  return wallet;
}
```

### Storage (`WalletStorageService.ts`)

```typescript
async storeWallet(fid: number, wallet) {
  // Encrypt private key
  const encrypted = this.encryptionService.encrypt(wallet.privateKey);
  
  // Prepare JSON
  const data = {
    address: wallet.address,
    encryptedPrivateKey: encrypted.encrypted,
    iv: encrypted.iv,
    chain: wallet.chain,
    createdAt: new Date().toISOString()
  };
  
  // Save to file
  const filePath = `./storage/wallets/wallet_${fid}_${chain}.json`;
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async getWallet(fid: number, chain: string) {
  const filePath = `./storage/wallets/wallet_${fid}_${chain}.json`;
  const file = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(file);
}

async getPrivateKey(fid: number, chain: string) {
  const wallet = await this.getWallet(fid, chain);
  
  // Decrypt
  const decrypted = this.encryptionService.decrypt(
    wallet.encryptedPrivateKey,
    wallet.iv
  );
  
  return decrypted;
}
```

### Encryption (`EncryptionService.ts`)

```typescript
class EncryptionService {
  constructor() {
    this.secret = process.env.ENCRYPTION_SECRET; // From .env
  }
  
  encrypt(text: string) {
    const iv = crypto.randomBytes(16); // Random IV
    const key = crypto.scryptSync(this.secret, 'salt', 32); // 32-byte key
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return { encrypted, iv: iv.toString('hex') };
  }
  
  decrypt(encrypted: string, iv: string) {
    const key = crypto.scryptSync(this.secret, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

---

## Security Features

✅ **Private keys encrypted** (AES-256-CBC)  
✅ **Unique IV per wallet** (prevents pattern attacks)  
✅ **Encryption secret from environment** (not hardcoded)  
✅ **Server-only access** (files never exposed to client)  
✅ **Private keys never sent to frontend**  

---

## Directory Structure

```
perpx-avantis/
├── storage/
│   └── wallets/
│       ├── wallet_1464243_ethereum.json      ← Your trading wallet
│       ├── wallet_1464243_base-account.json  ← Your Base Account address
│       └── .gitignore                        ← Protects wallet files
│
├── lib/
│   └── services/
│       ├── WalletStorageService.ts          ← File I/O operations
│       ├── EncryptionService.ts             ← Encrypt/decrypt
│       └── BaseAccountWalletService.ts      ← Wallet management
│
└── app/
    └── api/
        └── wallet/
            └── deposit/route.ts             ← Uses walletService
```

---

## For Your Specific Case

**Your FID**: 1464243

**Your Files**:
- `storage/wallets/wallet_1464243_ethereum.json` - Trading wallet (with private key)
- `storage/wallets/wallet_1464243_base-account.json` - Base Account address (no private key)

**When you deposited $20**:
1. Backend checked for `wallet_1464243_ethereum.json`
2. File didn't exist → Generated new wallet
3. Encrypted private key with ENCRYPTION_SECRET
4. Saved to `storage/wallets/wallet_1464243_ethereum.json`
5. Returned address for deposit destination

**Balance shows $0 because**:
- The deposit transaction might still be confirming
- Or the balance fetch is looking at the wrong address
- Check BaseScan to see if funds arrived at the wallet address

---

## ⚠️ Important Notes

### For Development (Current Setup)
✅ **Works fine** - Files persist on your local machine

### For Production (⚠️ CRITICAL)
❌ **Filesystem doesn't work on Vercel/serverless**
- Files deleted on every deployment
- All wallets lost on redeploy
- **Need to migrate to**: Redis, PostgreSQL, or S3

**Solution**: Migrate to Vercel KV (Redis) or PostgreSQL before production deploy

See `STORAGE_SETUP.md` for migration guide.

---

## Summary

| Question | Answer |
|----------|--------|
| **Where stored?** | Local filesystem: `./storage/wallets/*.json` |
| **How created?** | Auto-created on first deposit |
| **How encrypted?** | AES-256-CBC with ENCRYPTION_SECRET |
| **How fetched?** | Read file → Decrypt private key |
| **Production ready?** | ❌ No - needs persistent storage |

**Current Status**: ✅ Working for development  
**Next Step**: Migrate to persistent storage (Redis/PostgreSQL) for production

