#!/usr/bin/env node

/**
 * Fix wallet mismatch issue
 * Checks database and provides solution to sync wallet addresses
 */

const { ethers } = require('ethers');

// Configuration
const FID = 1464243;
const UI_WALLET = '0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4';
const UI_PRIVATE_KEY = '0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e';
const DATABASE_WALLET = '0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F'; // Where funds actually went

console.log('🔧 Wallet Mismatch Fix Tool\n');
console.log('='.repeat(70));
console.log('📊 Current Situation:');
console.log(`   FID: ${FID}`);
console.log(`   UI Shows Wallet: ${UI_WALLET}`);
console.log(`   Database Has Wallet: ${DATABASE_WALLET}`);
console.log(`   Funds Location: ${DATABASE_WALLET} ($215 USDC)`);
console.log('');

// Verify UI wallet
const wallet = new ethers.Wallet(UI_PRIVATE_KEY);
const derivedAddress = wallet.address;

if (derivedAddress.toLowerCase() === UI_WALLET.toLowerCase()) {
  console.log('✅ UI wallet private key is correct');
} else {
  console.log('❌ UI wallet private key does NOT match address!');
}
console.log('');

console.log('='.repeat(70));
console.log('🔍 Problem Analysis:');
console.log('');
console.log('The deposit endpoint uses `ensureTradingWallet(fid)` which returns');
console.log('the wallet address stored in the database. Your database has a');
console.log('DIFFERENT wallet address than what the UI is showing.');
console.log('');
console.log('This means:');
console.log('  1. Database has old wallet: ' + DATABASE_WALLET);
console.log('  2. UI shows new wallet: ' + UI_WALLET);
console.log('  3. Deposits go to database wallet (old one)');
console.log('  4. UI shows different wallet (new one)');
console.log('');

console.log('='.repeat(70));
console.log('💡 Solution Options:\n');

console.log('OPTION 1: Update Database to Use UI Wallet (Recommended)');
console.log('  - Delete old wallet from database');
console.log('  - Create new wallet with UI address and private key');
console.log('  - This will sync database with UI');
console.log('  - Future deposits will go to correct wallet');
console.log('  - ⚠️  You will need to transfer funds from old wallet first');
console.log('');

console.log('OPTION 2: Get Private Key for Database Wallet');
console.log('  - Find the private key for: ' + DATABASE_WALLET);
console.log('  - This wallet has $215 USDC');
console.log('  - You can use it to access the funds');
console.log('  - But UI will still show wrong wallet');
console.log('');

console.log('OPTION 3: Transfer Funds from Old to New Wallet');
console.log('  - Get private key for: ' + DATABASE_WALLET);
console.log('  - Transfer $215 USDC to: ' + UI_WALLET);
console.log('  - Then update database to use new wallet');
console.log('');

console.log('='.repeat(70));
console.log('📝 SQL Query to Check Database:');
console.log('');
console.log(`SELECT * FROM wallets WHERE fid = ${FID} AND chain = 'ethereum';`);
console.log('');

console.log('📝 SQL Query to Delete Old Wallet:');
console.log('');
console.log(`DELETE FROM wallets WHERE fid = ${FID} AND chain = 'ethereum' AND address = '${DATABASE_WALLET}';`);
console.log('');

console.log('⚠️  WARNING:');
console.log('  - Deleting the old wallet will lose access to $215 USDC');
console.log('  - Make sure to transfer funds first OR get the private key');
console.log('  - The private key for the old wallet is encrypted in database');
console.log('');

console.log('💡 Recommended Steps:');
console.log('  1. Query database to see all wallets for your FID');
console.log('  2. Get the private key for the old wallet (decrypt from database)');
console.log('  3. Transfer funds from old wallet to new wallet');
console.log('  4. Delete old wallet from database');
console.log('  5. Ensure new wallet is properly stored in database');

