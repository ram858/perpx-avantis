/**
 * Verify Database Tables
 * 
 * This script verifies that all tables exist and are accessible.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseClient } from '../lib/db/supabase';

async function verifyTables() {
  console.log('🔍 Verifying Database Tables...\n');
  
  const supabase = getSupabaseClient();

  // Check each table
  const tables = ['wallets', 'users', 'wallet_metadata', 'wallet_audit_log'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table as any)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        console.log(`❌ Table "${table}" - Error: ${error.message}`);
        console.log(`   Code: ${error.code}`);
        console.log(`   Details: ${JSON.stringify(error.details)}`);
      } else {
        console.log(`✅ Table "${table}" - Accessible (${count ?? 0} rows)`);
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}" - Exception: ${err.message}`);
    }
  }

  console.log('\n💡 If you see schema cache errors:');
  console.log('1. Go to Supabase Dashboard → Settings → API');
  console.log('2. Click "Restart API" button');
  console.log('3. Wait 30 seconds and try again\n');
}

verifyTables();

