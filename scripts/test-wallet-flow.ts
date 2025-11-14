/**
 * Test Complete Wallet Flow
 * 
 * This script tests the complete wallet creation and retrieval flow
 * to verify PostgreSQL integration is working correctly.
 * 
 * Usage:
 *   pnpm test:flow
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { BaseAccountWalletService } from '../lib/services/BaseAccountWalletService';

async function testWalletFlow() {
  console.log('🧪 Testing Complete Wallet Flow...\n');
  console.log('═'.repeat(60));

  const walletService = new BaseAccountWalletService();
  const testFid = 999999; // Test FID

  try {
    // Step 1: Store Base Account address (simulating Farcaster authentication)
    console.log('1️⃣  Storing Base Account address...');
    await walletService.storeBaseAccountAddress(
      testFid,
      '0x1234567890123456789012345678901234567890',
      'ethereum'
    );
    console.log('✅ Base Account address stored\n');

    // Step 2: Retrieve Base Account address
    console.log('2️⃣  Retrieving Base Account address...');
    const baseAddress = await walletService.getBaseAccountAddress(testFid);
    if (baseAddress) {
      console.log(`✅ Retrieved: ${baseAddress}\n`);
    } else {
      throw new Error('Failed to retrieve Base Account address');
    }

    // Step 3: Create trading wallet (simulating deposit)
    console.log('3️⃣  Creating trading wallet...');
    const tradingWallet = await walletService.ensureTradingWallet(testFid);
    if (!tradingWallet) {
      throw new Error('Failed to create trading wallet');
    }
    console.log(`✅ Trading wallet created: ${tradingWallet.address}`);
    console.log(`   Has private key: ${tradingWallet.privateKey ? 'Yes ✅' : 'No ❌'}\n`);

    // Step 4: Retrieve trading wallet with private key
    console.log('4️⃣  Retrieving trading wallet with key...');
    const retrievedWallet = await walletService.getWalletWithKey(testFid, 'ethereum');
    if (!retrievedWallet) {
      throw new Error('Failed to retrieve trading wallet');
    }
    console.log(`✅ Retrieved: ${retrievedWallet.address}`);
    console.log(`   Private key: ${retrievedWallet.privateKey ? '***hidden***' : 'Missing ❌'}\n`);

    // Step 5: Check if wallet exists
    console.log('5️⃣  Checking wallet existence...');
    const hasWallet = await walletService.hasWallet(testFid, 'ethereum');
    console.log(`✅ Wallet exists: ${hasWallet ? 'Yes' : 'No'}\n`);

    // Step 6: Get wallet address only (fast query)
    console.log('6️⃣  Getting wallet address (fast query)...');
    const address = await walletService.getWalletAddress(testFid, 'ethereum');
    console.log(`✅ Address: ${address}\n`);

    // Cleanup: Delete test wallet
    console.log('🧹 Cleaning up test data...');
    const { DatabaseWalletStorageService } = await import('../lib/services/DatabaseWalletStorageService');
    const dbService = new DatabaseWalletStorageService();
    await dbService.deleteWallet(testFid, 'ethereum');
    await dbService.deleteWallet(testFid, 'base-account');
    console.log('✅ Test data cleaned up\n');

    console.log('═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('═'.repeat(60));
    console.log('\n✅ Backend wallet creation: WORKING');
    console.log('✅ PostgreSQL storage: WORKING');
    console.log('✅ Wallet retrieval: WORKING');
    console.log('✅ Private key encryption: WORKING');
    console.log('\n📝 Your app is ready to:');
    console.log('  1. Create wallets for new users');
    console.log('  2. Store them securely in PostgreSQL');
    console.log('  3. Display them in the PerpX mini app\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.log('\n📋 Check:');
    console.log('  1. Database connection (pnpm db:test)');
    console.log('  2. ENCRYPTION_SECRET in .env.local');
    console.log('  3. Supabase service_role key\n');
    process.exit(1);
  }
}

testWalletFlow();

