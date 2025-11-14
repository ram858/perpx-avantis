# 🗄️ Migration Plan: Filesystem → PostgreSQL

## Why This Migration is CRITICAL

### Current Problems (Filesystem Storage)

❌ **Not Scalable**:
- 1 million users = 2 million files (1 trading wallet + 1 base account per user)
- Filesystem becomes extremely slow with millions of files
- Directory listing operations degrade exponentially

❌ **No Atomicity**:
- File writes can fail mid-operation
- No transaction support
- Risk of partial/corrupted writes

❌ **No Query Capabilities**:
- Can't search wallets by address
- Can't get analytics (total wallets, active users, etc.)
- Can't do batch operations efficiently

❌ **No Backup/Recovery**:
- Need to backup entire directory
- Point-in-time recovery difficult
- No built-in replication

❌ **No Concurrency Control**:
- Multiple processes could write simultaneously
- Race conditions possible
- File locking issues

❌ **Deployment Issues**:
- Ephemeral filesystems on serverless platforms
- Data lost on every deploy (Vercel, AWS Lambda, etc.)
- Difficult to migrate between servers

### Why PostgreSQL?

✅ **Scalable**: Handles billions of rows efficiently
✅ **ACID Transactions**: Atomic operations, data integrity
✅ **Powerful Queries**: Search, filter, aggregate
✅ **Automatic Backups**: Point-in-time recovery
✅ **Replication**: High availability
✅ **Connection Pooling**: Handle concurrent requests
✅ **Indexing**: Fast lookups by FID, address, etc.
✅ **Managed Services**: Vercel Postgres, Supabase, Neon (free tiers available)

---

## Migration Architecture

### Database Schema Design

```sql
-- Users table (optional but recommended)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Wallets table (main storage)
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT NOT NULL,  -- AES-256 encrypted
  iv VARCHAR(32) NOT NULL,              -- Initialization vector
  chain VARCHAR(50) NOT NULL,            -- ethereum, base-account, etc.
  wallet_type VARCHAR(20) NOT NULL,      -- trading, base-account
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(fid, chain),
  CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),  -- Valid Ethereum address
  
  -- Indexes for fast queries
  INDEX idx_fid (fid),
  INDEX idx_address (address),
  INDEX idx_wallet_type (wallet_type)
);

-- Wallet metadata (optional - for analytics)
CREATE TABLE wallet_metadata (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  balance_usd DECIMAL(20, 8) DEFAULT 0,
  last_balance_check TIMESTAMP,
  total_deposits DECIMAL(20, 8) DEFAULT 0,
  total_withdrawals DECIMAL(20, 8) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0
);

-- Audit log (recommended for security)
CREATE TABLE wallet_audit_log (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id),
  action VARCHAR(50) NOT NULL,  -- created, accessed, updated, deleted
  accessed_by VARCHAR(100),
  ip_address INET,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## Migration Plan

### Phase 1: Setup & Preparation (Day 1)

**TODOs:**

- [ ] **1.1 Choose PostgreSQL Provider**
  - Option A: Vercel Postgres (if deploying on Vercel)
  - Option B: Supabase (generous free tier)
  - Option C: Neon (serverless, good free tier)
  - Option D: Railway (simple, affordable)
  - Decision: ___________

- [ ] **1.2 Create PostgreSQL Database**
  - Create account with chosen provider
  - Create new database instance
  - Note connection string (DATABASE_URL)
  - Enable SSL connection

- [ ] **1.3 Install Dependencies**
  - [ ] Install Prisma ORM: `npm install prisma @prisma/client`
  - [ ] Install database driver: `npm install pg`
  - [ ] Install development tools: `npm install -D prisma`

- [ ] **1.4 Initialize Prisma**
  - [ ] Run: `npx prisma init`
  - [ ] Configure `.env` with `DATABASE_URL`
  - [ ] Review generated `prisma/schema.prisma`

- [ ] **1.5 Environment Variables**
  ```env
  DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
  ENCRYPTION_SECRET=your-secret-key
  JWT_SECRET=your-jwt-secret
  ```

---

### Phase 2: Database Schema Creation (Day 1-2)

**TODOs:**

- [ ] **2.1 Define Prisma Schema**
  - [ ] Create `prisma/schema.prisma` with tables
  - [ ] Define User model
  - [ ] Define Wallet model
  - [ ] Define relationships
  - [ ] Add indexes for performance

- [ ] **2.2 Create Database Tables**
  - [ ] Run: `npx prisma migrate dev --name init_wallet_tables`
  - [ ] Verify tables created: `npx prisma studio`
  - [ ] Test connection works

- [ ] **2.3 Generate Prisma Client**
  - [ ] Run: `npx prisma generate`
  - [ ] Verify types generated in `node_modules/.prisma/client`

---

### Phase 3: Create Database Service Layer (Day 2-3)

**TODOs:**

- [ ] **3.1 Create Prisma Client Singleton**
  - [ ] Create: `lib/db/prisma.ts`
  - [ ] Implement singleton pattern
  - [ ] Handle connection pooling
  - [ ] Add error handling

- [ ] **3.2 Create Database Wallet Service**
  - [ ] Create: `lib/services/DatabaseWalletStorageService.ts`
  - [ ] Implement: `storeWallet(fid, wallet)`
  - [ ] Implement: `getWallet(fid, chain)`
  - [ ] Implement: `getPrivateKey(fid, chain)`
  - [ ] Implement: `deleteWallet(fid, chain)`
  - [ ] Implement: `hasWallet(fid, chain)`
  - [ ] Implement: `getAllWalletsByFid(fid)`
  - [ ] Add transaction support
  - [ ] Add error handling

- [ ] **3.3 Update BaseAccountWalletService**
  - [ ] Replace `WalletStorageService` with `DatabaseWalletStorageService`
  - [ ] Update constructor
  - [ ] Ensure all methods still work
  - [ ] Keep encryption logic (EncryptionService)

---

### Phase 4: Data Migration (Day 3-4)

**TODOs:**

- [ ] **4.1 Create Migration Script**
  - [ ] Create: `scripts/migrate-wallets-to-db.ts`
  - [ ] Read all files from `./storage/wallets/`
  - [ ] Parse JSON files
  - [ ] Insert into PostgreSQL
  - [ ] Log success/failures
  - [ ] Create rollback capability

- [ ] **4.2 Test Migration on Staging**
  - [ ] Copy production wallet files to staging
  - [ ] Run migration script
  - [ ] Verify all wallets migrated
  - [ ] Verify encryption still works
  - [ ] Test wallet retrieval

- [ ] **4.3 Backup Current Data**
  - [ ] Backup `./storage/wallets/` directory
  - [ ] Store backup in secure location
  - [ ] Verify backup integrity
  - [ ] Document backup location

- [ ] **4.4 Run Production Migration**
  - [ ] Schedule maintenance window
  - [ ] Stop accepting new requests
  - [ ] Run migration script
  - [ ] Verify all data migrated
  - [ ] Keep filesystem backup for 30 days

---

### Phase 5: Testing & Verification (Day 4-5)

**TODOs:**

- [ ] **5.1 Unit Tests**
  - [ ] Test wallet creation
  - [ ] Test wallet retrieval
  - [ ] Test encryption/decryption
  - [ ] Test error scenarios
  - [ ] Test concurrent operations

- [ ] **5.2 Integration Tests**
  - [ ] Test deposit flow end-to-end
  - [ ] Test wallet fetching in API routes
  - [ ] Test with multiple users
  - [ ] Test edge cases (missing wallet, invalid FID, etc.)

- [ ] **5.3 Performance Tests**
  - [ ] Benchmark wallet creation (should be < 100ms)
  - [ ] Benchmark wallet retrieval (should be < 50ms)
  - [ ] Test with 1000 concurrent requests
  - [ ] Verify database indexes are used

- [ ] **5.4 Security Audit**
  - [ ] Verify encryption still works
  - [ ] Verify private keys never logged
  - [ ] Verify SQL injection prevention (Prisma handles this)
  - [ ] Verify connection string not exposed
  - [ ] Review database permissions

---

### Phase 6: Deployment (Day 5-6)

**TODOs:**

- [ ] **6.1 Update Environment Variables**
  - [ ] Set `DATABASE_URL` in production
  - [ ] Remove `WALLET_STORAGE_PATH` (no longer needed)
  - [ ] Verify `ENCRYPTION_SECRET` unchanged

- [ ] **6.2 Deploy to Staging**
  - [ ] Deploy with new database service
  - [ ] Test all wallet operations
  - [ ] Verify no errors in logs
  - [ ] Monitor performance

- [ ] **6.3 Deploy to Production**
  - [ ] Create deployment checklist
  - [ ] Deploy during low-traffic window
  - [ ] Monitor error rates
  - [ ] Monitor database connections
  - [ ] Monitor response times

- [ ] **6.4 Monitoring & Alerts**
  - [ ] Set up database monitoring
  - [ ] Set up error alerts
  - [ ] Monitor connection pool usage
  - [ ] Monitor query performance

---

### Phase 7: Cleanup (Day 7)

**TODOs:**

- [ ] **7.1 Remove Filesystem Code**
  - [ ] Archive `lib/services/WalletStorageService.ts`
  - [ ] Remove filesystem dependencies
  - [ ] Update documentation
  - [ ] Remove old migration scripts

- [ ] **7.2 Database Optimization**
  - [ ] Review query patterns
  - [ ] Add missing indexes if needed
  - [ ] Set up automatic backups
  - [ ] Configure connection pooling

- [ ] **7.3 Documentation Update**
  - [ ] Update README
  - [ ] Update API documentation
  - [ ] Document database schema
  - [ ] Create runbook for common operations

---

## Detailed Implementation Todos

### TODO 1: Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  fid          Int       @unique
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  lastLoginAt  DateTime? @map("last_login_at")
  
  wallets      Wallet[]
  
  @@map("users")
}

model Wallet {
  id                   Int      @id @default(autoincrement())
  fid                  Int
  address              String   @db.VarChar(42)
  encryptedPrivateKey  String   @map("encrypted_private_key") @db.Text
  iv                   String   @db.VarChar(32)
  chain                String   @db.VarChar(50)
  walletType           String   @map("wallet_type") @db.VarChar(20)
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")
  
  user                 User?    @relation(fields: [fid], references: [fid])
  
  @@unique([fid, chain])
  @@index([fid])
  @@index([address])
  @@index([walletType])
  @@map("wallets")
}
```

---

### TODO 2: Prisma Client Singleton (`lib/db/prisma.ts`)

**Purpose**: Create single instance of Prisma Client for the entire app

**Key Points**:
- Singleton pattern for connection pooling
- Handle hot reload in development
- Graceful shutdown on process exit
- Connection pooling configuration

---

### TODO 3: Database Wallet Service (`lib/services/DatabaseWalletStorageService.ts`)

**Methods to Implement**:

1. `storeWallet(fid, wallet)` 
   - Use Prisma `upsert` for insert or update
   - Encrypt private key before storing
   - Return created wallet

2. `getWallet(fid, chain)`
   - Query by FID and chain
   - Return wallet without decrypting

3. `getPrivateKey(fid, chain)`
   - Get wallet from database
   - Decrypt private key
   - Return decrypted key

4. `getWalletAddress(fid, chain)`
   - Query for address only
   - No decryption needed

5. `deleteWallet(fid, chain)`
   - Soft delete (recommended) or hard delete
   - Log deletion for audit

6. `hasWallet(fid, chain)`
   - Check existence without fetching data
   - Use `count()` or `findUnique()`

7. `getAllWalletsByFid(fid)`
   - Get all wallets for a user
   - Return array of wallets

---

### TODO 4: Migration Script (`scripts/migrate-wallets-to-db.ts`)

**Steps**:

1. Read all files from `./storage/wallets/`
2. Parse JSON files
3. For each wallet:
   - Extract: fid, chain, address, encryptedPrivateKey, iv, createdAt
   - Determine wallet_type from chain
   - Insert into database using Prisma
   - Log success
4. Handle errors gracefully
5. Generate migration report
6. Verify all data migrated

---

### TODO 5: Update All API Routes

**Files to Update**:
- `app/api/wallet/deposit/route.ts` ✓ (already uses service)
- `app/api/wallet/user-wallets/route.ts` ✓ (already uses service)
- `app/api/wallet/primary-with-key/route.ts` ✓ (already uses service)
- `app/api/trading/start/route.ts` ✓ (already uses service)

**Good News**: Your code already uses `BaseAccountWalletService`, so you only need to update the storage layer!

---

## Risk Mitigation

### Risks & Solutions

**Risk 1: Data Loss During Migration**
- Solution: Keep filesystem backup for 30 days
- Solution: Test migration on staging first
- Solution: Verify all wallets migrated successfully

**Risk 2: Encryption Key Mismatch**
- Solution: Use same `ENCRYPTION_SECRET`
- Solution: Test decryption after migration
- Solution: Have rollback plan

**Risk 3: Database Connection Issues**
- Solution: Connection pooling
- Solution: Retry logic
- Solution: Fallback to read replicas

**Risk 4: Performance Degradation**
- Solution: Proper indexing
- Solution: Query optimization
- Solution: Connection pooling
- Solution: Read replicas for high traffic

**Risk 5: Downtime During Migration**
- Solution: Migrate during low-traffic window
- Solution: Run filesystem and database in parallel temporarily
- Solution: Feature flag to switch between storage methods

---

## Success Metrics

**After Migration**:

✅ All wallets accessible (100% success rate)
✅ Wallet creation time < 100ms
✅ Wallet retrieval time < 50ms
✅ No data loss (verify checksums)
✅ Encryption/decryption works correctly
✅ Zero downtime during migration
✅ Database connection pool stable
✅ No memory leaks
✅ Backup and recovery tested

---

## Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| Setup & Preparation | 4-6 hours | Easy |
| Schema Creation | 2-3 hours | Easy |
| Service Layer | 8-12 hours | Medium |
| Data Migration | 4-6 hours | Medium |
| Testing | 8-12 hours | High |
| Deployment | 2-4 hours | Medium |
| Cleanup | 2-3 hours | Easy |
| **Total** | **30-46 hours** | **~1 week** |

---

## Cost Estimate

**PostgreSQL Hosting Options**:

| Provider | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| Vercel Postgres | 256 MB | $20/mo (1GB) | Vercel deployments |
| Supabase | 500 MB | $25/mo (8GB) | Full-stack apps |
| Neon | 512 MB | $19/mo (3GB) | Serverless |
| Railway | 512 MB | $5/mo (8GB) | Simple setup |

**Recommendation**: Start with free tier, upgrade as you grow

---

## Next Steps

1. **Review this plan** with your team
2. **Choose PostgreSQL provider**
3. **Set up development database**
4. **Start with Phase 1: Setup**
5. **Test thoroughly on staging**
6. **Schedule production migration**

---

## Questions to Answer Before Starting

- [ ] Which PostgreSQL provider will you use?
- [ ] What's your backup strategy?
- [ ] When can you schedule maintenance window?
- [ ] Do you have existing users/wallets to migrate?
- [ ] What's your rollback plan if migration fails?
- [ ] Who will monitor the migration?

---

**Status**: ⏳ Ready to Start  
**Priority**: 🔴 Critical (Must do before production)  
**Complexity**: 🟡 Medium  
**Impact**: 🟢 High (Enables scalability)

