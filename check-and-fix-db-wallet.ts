/**
 * Check and fix wallet mismatch in database
 * This script helps identify and resolve the wallet address mismatch
 */

import { getSupabaseClient } from './lib/db/supabase';
import { EncryptionService } from './lib/services/EncryptionService';

const FID = 1464243;
const UI_WALLET = '0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4';
const UI_PRIVATE_KEY = '0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e';
const DATABASE_WALLET = '0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F';

async function checkAndFixWallet() {
  try {
    console.log('🔍 Checking Database Wallet for FID:', FID);
    console.log('='.repeat(70));
    
    const supabase = getSupabaseClient();
    
    // Check what's in database
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('fid', FID)
      .eq('chain', 'ethereum');
    
    if (error) {
      console.error('❌ Error querying database:', error);
      return;
    }
    
    console.log(`\n📊 Found ${wallets?.length || 0} wallet(s) in database:\n`);
    
    if (wallets && wallets.length > 0) {
      wallets.forEach((wallet: any, index: number) => {
        console.log(`Wallet ${index + 1}:`);
        console.log(`  Address: ${wallet.address}`);
        console.log(`  Chain: ${wallet.chain}`);
        console.log(`  Wallet Type: ${wallet.wallet_type}`);
        console.log(`  Created: ${wallet.created_at}`);
        console.log(`  Has Encrypted Key: ${!!wallet.encrypted_private_key}`);
        console.log('');
        
        if (wallet.address.toLowerCase() === DATABASE_WALLET.toLowerCase()) {
          console.log('  ⚠️  This is the OLD wallet (where funds are)');
        }
        if (wallet.address.toLowerCase() === UI_WALLET.toLowerCase()) {
          console.log('  ✅ This is the UI wallet (correct one)');
        }
      });
    } else {
      console.log('  No wallets found in database');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('💡 Solution:\n');
    
    // Check if UI wallet exists in database
    const uiWalletExists = wallets?.some((w: any) => 
      w.address.toLowerCase() === UI_WALLET.toLowerCase()
    );
    
    if (!uiWalletExists) {
      console.log('❌ UI wallet is NOT in database!');
      console.log('\n📝 To fix this, you need to:');
      console.log('   1. Store the UI wallet in database with its private key');
      console.log('   2. Or delete the old wallet and let the system create a new one');
      console.log('   3. But first, transfer funds from old wallet to new wallet');
    } else {
      console.log('✅ UI wallet exists in database');
      console.log('   But deposits are still going to old wallet');
      console.log('   This suggests the old wallet is being returned first');
    }
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('   The old wallet has $215 USDC');
    console.log('   Before deleting it, you need to:');
    console.log('   1. Get its private key (decrypt from database)');
    console.log('   2. Transfer funds to UI wallet');
    console.log('   3. Then delete old wallet from database');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  checkAndFixWallet().catch(console.error);
}

export { checkAndFixWallet };

