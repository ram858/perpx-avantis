# ✅ PostgreSQL Migration Checklist

## Quick Start Checklist

### Pre-Migration (Day 0)
- [ ] Read `MIGRATION_TO_POSTGRESQL_PLAN.md` thoroughly
- [ ] Choose PostgreSQL provider (Vercel Postgres / Supabase / Neon)
- [ ] Get team approval
- [ ] Schedule migration date/time

---

## Week 1: Implementation

### Day 1: Setup
- [ ] Create PostgreSQL database
- [ ] Get connection string (DATABASE_URL)
- [ ] Install: `npm install prisma @prisma/client pg`
- [ ] Run: `npx prisma init`
- [ ] Add `DATABASE_URL` to `.env.local`
- [ ] Test connection works

### Day 2: Schema
- [ ] Define Prisma schema in `prisma/schema.prisma`
- [ ] Run: `npx prisma migrate dev --name init_wallets`
- [ ] Run: `npx prisma generate`
- [ ] Open `npx prisma studio` to verify tables

### Day 3: Code
- [ ] Create `lib/db/prisma.ts` (singleton)
- [ ] Create `lib/services/DatabaseWalletStorageService.ts`
- [ ] Implement all CRUD methods
- [ ] Update `BaseAccountWalletService.ts` to use new service
- [ ] Add unit tests

### Day 4: Migration Script
- [ ] Create `scripts/migrate-wallets-to-db.ts`
- [ ] Test on dummy data
- [ ] Backup existing `./storage/wallets/` directory
- [ ] Run migration on development data

### Day 5: Testing
- [ ] Test wallet creation
- [ ] Test wallet retrieval  
- [ ] Test deposit flow end-to-end
- [ ] Test with multiple concurrent users
- [ ] Performance benchmarks

### Day 6: Staging Deploy
- [ ] Deploy to staging environment
- [ ] Run migration script on staging
- [ ] Test all features on staging
- [ ] Monitor for 24 hours

### Day 7: Production Deploy
- [ ] Final backup of filesystem wallets
- [ ] Deploy to production
- [ ] Run migration script
- [ ] Verify all wallets accessible
- [ ] Monitor for issues

---

## Quick Decision Matrix

### Which Provider to Choose?

**Choose Vercel Postgres if:**
- ✅ Already deploying on Vercel
- ✅ Want tight integration
- ✅ Don't need extra features

**Choose Supabase if:**
- ✅ Want generous free tier (500MB)
- ✅ Need auth/storage later
- ✅ Want admin dashboard

**Choose Neon if:**
- ✅ Want serverless database
- ✅ Need autoscaling
- ✅ Pay per usage model

**Choose Railway if:**
- ✅ Want simplest setup
- ✅ Good free tier
- ✅ All-in-one platform

**Recommendation**: Supabase (best free tier + features)

---

## File Changes Required

### New Files to Create:
1. `prisma/schema.prisma` - Database schema
2. `lib/db/prisma.ts` - Prisma client singleton
3. `lib/services/DatabaseWalletStorageService.ts` - New storage service
4. `scripts/migrate-wallets-to-db.ts` - Migration script
5. `scripts/verify-migration.ts` - Verification script

### Files to Update:
1. `lib/services/BaseAccountWalletService.ts` - Use new storage service
2. `.env.local` - Add DATABASE_URL
3. `.gitignore` - Ignore .env files
4. `package.json` - Add Prisma scripts

### Files to Keep (No Changes):
1. `lib/services/EncryptionService.ts` - Encryption stays the same ✅
2. All API routes - Already use service layer ✅
3. Frontend code - No changes needed ✅

---

## Critical Environment Variables

```env
# Add to .env.local
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Keep these (no change)
ENCRYPTION_SECRET="your-32-char-secret"
JWT_SECRET="your-jwt-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Migration Script Pseudocode

```typescript
// scripts/migrate-wallets-to-db.ts

1. Connect to database
2. Read ./storage/wallets/ directory
3. For each *.json file:
   - Parse JSON
   - Extract fid from filename (wallet_FID_chain.json)
   - Insert into database:
     {
       fid: extracted_fid,
       address: json.address,
       encryptedPrivateKey: json.encryptedPrivateKey,
       iv: json.iv,
       chain: json.chain,
       walletType: determine_from_chain(json.chain),
       createdAt: json.createdAt
     }
   - Log success
4. Generate summary report:
   - Total files processed
   - Successful migrations
   - Failed migrations (with reasons)
5. Verify all wallets accessible
```

---

## Testing Checklist

### Unit Tests
- [ ] Test `storeWallet()` creates wallet
- [ ] Test `getWallet()` retrieves wallet
- [ ] Test `getPrivateKey()` decrypts correctly
- [ ] Test `deleteWallet()` removes wallet
- [ ] Test `hasWallet()` returns correct boolean
- [ ] Test unique constraint (fid + chain)
- [ ] Test error handling

### Integration Tests
- [ ] Test deposit creates wallet in database
- [ ] Test wallet retrieval in API routes
- [ ] Test concurrent wallet creation
- [ ] Test wallet with special characters
- [ ] Test migration script on sample data

### Performance Tests
- [ ] Wallet creation < 100ms
- [ ] Wallet retrieval < 50ms
- [ ] 100 concurrent requests handled
- [ ] Database connection pool stable
- [ ] No memory leaks

---

## Rollback Plan

**If migration fails:**

1. **Stop application**
2. **Restore from backup**:
   ```bash
   cp -r ./storage/wallets.backup ./storage/wallets
   ```
3. **Revert code changes**:
   ```bash
   git reset --hard HEAD~1
   ```
4. **Redeploy previous version**
5. **Investigate failure cause**
6. **Fix issues and retry**

---

## Success Criteria

✅ All existing wallets migrated (100% success rate)  
✅ No data loss (verified with checksums)  
✅ Encryption/decryption works correctly  
✅ All API endpoints functional  
✅ Performance metrics met  
✅ Zero downtime during migration  
✅ Database backups configured  
✅ Monitoring and alerts set up  

---

## Common Issues & Solutions

### Issue: "Connection pool timeout"
**Solution**: Increase pool size in DATABASE_URL:
```
?connection_limit=20&pool_timeout=10
```

### Issue: "Migration takes too long"
**Solution**: Batch inserts (100 at a time):
```typescript
await prisma.$transaction(batch);
```

### Issue: "Encryption fails after migration"
**Solution**: Verify ENCRYPTION_SECRET unchanged

### Issue: "Database out of connections"
**Solution**: Use Prisma connection pooling:
```typescript
const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
  log: ['error'],
})
```

---

## Post-Migration Tasks

- [ ] Remove `./storage/wallets/` after 30 days
- [ ] Remove `WalletStorageService.ts` (old file-based service)
- [ ] Update documentation
- [ ] Set up automated database backups
- [ ] Configure monitoring alerts
- [ ] Optimize queries based on usage patterns
- [ ] Add database performance monitoring

---

## Quick Reference Commands

```bash
# Prisma commands
npx prisma init                    # Initialize Prisma
npx prisma migrate dev            # Create migration
npx prisma generate               # Generate client
npx prisma studio                 # Open admin UI
npx prisma db push                # Quick schema sync (dev only)

# Migration
npm run migrate:wallets           # Run migration script
npm run verify:migration          # Verify all wallets

# Database
psql $DATABASE_URL                # Connect to database
\dt                               # List tables
\d wallets                        # Describe wallets table
SELECT COUNT(*) FROM wallets;     # Count wallets
```

---

## Estimated Timeline

| Task | Hours | When |
|------|-------|------|
| Setup database | 2h | Day 1 |
| Create schema | 3h | Day 2 |
| Write service code | 8h | Day 3 |
| Migration script | 4h | Day 4 |
| Testing | 8h | Day 5 |
| Staging deploy | 3h | Day 6 |
| Production deploy | 3h | Day 7 |
| **Total** | **31h** | **1 week** |

---

## Need Help?

- [ ] Stuck on Prisma setup? Check: https://pris.ly/d/getting-started
- [ ] Database connection issues? Check Supabase/Vercel docs
- [ ] Migration questions? Review `MIGRATION_TO_POSTGRESQL_PLAN.md`
- [ ] Performance issues? Add database indexes

---

**Status**: Ready to implement  
**Priority**: Critical  
**Complexity**: Medium  
**Time**: 1 week  

**Next Action**: Choose PostgreSQL provider and create database

