/**
 * Test Database Connection
 * 
 * This script tests the Supabase connection and verifies tables exist.
 * 
 * Usage:
 *   npx tsx scripts/test-db-connection.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseClient } from '../lib/db/supabase';

async function testConnection() {
  console.log('🧪 Testing Supabase Connection...\n');
  console.log('═'.repeat(60));

  try {
    // Test 1: Connect to Supabase
    console.log('1️⃣  Connecting to Supabase...');
    const supabase = getSupabaseClient();
    console.log('✅ Connected successfully\n');

    // Test 2: Check if tables exist
    console.log('2️⃣  Checking if tables exist...');
    const tables = ['wallets', 'users', 'wallet_metadata', 'wallet_audit_log'];
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table as any)
          .select('id', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ Table "${table}" - Error: ${error.message}`);
        } else {
          console.log(`✅ Table "${table}" - Exists (${count ?? 0} rows)`);
        }
      } catch (err) {
        console.log(`❌ Table "${table}" - ${err}`);
      }
    }

    // Test 3: Test insert and delete
    console.log('\n3️⃣  Testing insert/delete operations...');
    const testFid = 999999;
    
    // Insert test wallet
    const { error: insertError } = await supabase
      .from('wallets')
      .insert({
        fid: testFid,
        address: '0x0000000000000000000000000000000000000000',
        encrypted_private_key: 'test_encrypted_key',
        iv: 'test_iv',
        chain: 'ethereum',
        wallet_type: 'trading',
      });

    if (insertError) {
      console.log(`❌ Insert failed: ${insertError.message}`);
    } else {
      console.log('✅ Insert successful');

      // Delete test wallet
      const { error: deleteError } = await supabase
        .from('wallets')
        .delete()
        .eq('fid', testFid);

      if (deleteError) {
        console.log(`❌ Delete failed: ${deleteError.message}`);
      } else {
        console.log('✅ Delete successful');
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 All tests passed! Database is ready.');
    console.log('═'.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('1. Run migration: npx tsx scripts/migrate-wallets-to-db.ts');
    console.log('2. Test wallet creation');
    console.log('3. Deploy to production\n');

    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check .env.local has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.log('2. Verify tables created: Run database/schema.sql in Supabase SQL Editor');
    console.log('3. Check Supabase project is active\n');
    process.exit(1);
  }
}

testConnection();

