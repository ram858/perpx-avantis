# 🗄️ Database Setup Instructions

## Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase project: https://jbigcaujbysqkbbvnwfd.supabase.co
2. Click on **Settings** (gear icon) in the left sidebar
3. Click on **API** section
4. Find **service_role** key (NOT the anon key)
5. Click "Reveal" and copy it

⚠️ **Important**: The service_role key has full database access. Never expose it in frontend code!

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
SUPABASE_URL=https://jbigcaujbysqkbbvnwfd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaWdjYXVqYnlzcWtiYnZud2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDA1OTksImV4cCI6MjA3ODY3NjU5OX0.MAGX3hXGF3WbC8xMuFU_ZiRP7--UsZMJM3J9XQ_OuDU
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Public keys for frontend
NEXT_PUBLIC_SUPABASE_URL=https://jbigcaujbysqkbbvnwfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaWdjYXVqYnlzcWtiYnZud2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDA1OTksImV4cCI6MjA3ODY3NjU5OX0.MAGX3hXGF3WbC8xMuFU_ZiRP7--UsZMJM3J9XQ_OuDU

# Keep your existing encryption and JWT secrets
ENCRYPTION_SECRET=your-existing-encryption-secret
JWT_SECRET=your-existing-jwt-secret
```

## Step 3: Create Database Tables

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **+ New query**
4. Copy the entire contents of `database/schema.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl/Cmd + Enter)

### Option B: Using psql Command Line

```bash
# Copy the connection string from Supabase Settings > Database > Connection String (Transaction Pooling mode)
psql "postgresql://postgres.jbigcaujbysqkbbvnwfd:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" -f database/schema.sql
```

## Step 4: Verify Tables Created

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see:
- ✅ users
- ✅ wallets
- ✅ wallet_metadata
- ✅ wallet_audit_log

## Step 5: Test Connection

Run this query to test:

```sql
SELECT COUNT(*) FROM wallets;
```

Should return: `0` (empty table, which is correct)

## Next Steps

Once the database is set up, I'll:
1. ✅ Create `DatabaseWalletStorageService.ts`
2. ✅ Update `BaseAccountWalletService.ts`
3. ✅ Create migration script to move existing wallets from filesystem
4. ✅ Test the new system

---

## Quick Reference

**Project URL**: https://jbigcaujbysqkbbvnwfd.supabase.co  
**Database**: `postgres` (default)  
**Region**: Your selected region  

**Tables Created**:
- `users` - User accounts by FID
- `wallets` - Encrypted wallet storage
- `wallet_metadata` - Balance and transaction tracking
- `wallet_audit_log` - Security audit trail

---

## Troubleshooting

**Issue**: "Permission denied for table"
- **Solution**: Make sure you're using the service_role key, not the anon key

**Issue**: "Relation already exists"
- **Solution**: Tables already created. Run `DROP TABLE wallets CASCADE;` first (if safe to do so)

**Issue**: "Cannot connect to database"
- **Solution**: Check if your IP is allowed in Supabase Network Restrictions

---

## Security Notes

🔒 **Private Keys**:
- Still encrypted with AES-256 before storing
- `ENCRYPTION_SECRET` remains the same
- No changes to encryption logic

🔐 **Row Level Security**:
- Enabled on all tables
- Only service_role has full access
- Frontend uses anon key with limited permissions

✅ **Ready to proceed once database is set up!**

