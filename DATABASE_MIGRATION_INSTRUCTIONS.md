# Database Migration Instructions for Supabase

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste Migration SQL**
   - Open the file: `database/web_users_migration.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - Wait for success message

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push --file database/web_users_migration.sql
```

## Verify Migration

After running, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('web_users', 'web_wallets', 'web_wallet_metadata', 'web_wallet_audit_log');

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'web_users';
```

## What This Migration Creates

- ✅ `web_users` table - Stores web user accounts
- ✅ `web_wallets` table - Stores wallets for web users  
- ✅ `web_wallet_metadata` table - Wallet analytics
- ✅ `web_wallet_audit_log` table - Security audit logs
- ✅ Indexes for fast queries
- ✅ Row Level Security (RLS) policies
- ✅ Auto-update timestamp triggers

## Troubleshooting

If you get errors:

1. **"relation already exists"** - Tables already exist, migration was already run
2. **"permission denied"** - Make sure you're using the service role key or have proper permissions
3. **"function does not exist"** - Run the main schema.sql first to create the `update_updated_at_column()` function

## Direct SQL Command

You can also run this directly in Supabase SQL Editor:

```sql
-- Copy the entire contents of database/web_users_migration.sql
-- and paste it here, then click Run
```

