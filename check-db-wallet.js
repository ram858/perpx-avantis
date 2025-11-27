#!/usr/bin/env node

/**
 * Check what trading wallet address is stored in database for a user
 * This helps identify if there's a mismatch between UI and database
 */

const { ethers } = require('ethers');

// Configuration
const FID = 1464243; // From the UI screenshot
const PRIVATE_KEY_UI = '0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e';
const EXPECTED_WALLET_UI = '0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4';
const ACTUAL_RECIPIENT = '0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F';

console.log('🔍 Wallet Address Verification\n');
console.log('='.repeat(70));

// Verify UI wallet address from private key
const wallet = new ethers.Wallet(PRIVATE_KEY_UI);
const derivedAddress = wallet.address;

console.log('📝 UI Information:');
console.log(`   FID: ${FID}`);
console.log(`   Private Key: ${PRIVATE_KEY_UI.slice(0, 10)}...${PRIVATE_KEY_UI.slice(-4)}`);
console.log(`   Expected Wallet (from UI): ${EXPECTED_WALLET_UI}`);
console.log(`   Derived Address (from PK): ${derivedAddress}`);
console.log('');

if (derivedAddress.toLowerCase() === EXPECTED_WALLET_UI.toLowerCase()) {
  console.log('✅ Private key matches UI wallet address');
} else {
  console.log('❌ Private key does NOT match UI wallet address!');
  console.log(`   Expected: ${EXPECTED_WALLET_UI}`);
  console.log(`   Derived: ${derivedAddress}`);
}
console.log('');

console.log('📊 Transaction Information:');
console.log(`   Funds sent to: ${ACTUAL_RECIPIENT}`);
console.log(`   Transaction: 0x0c281560193b5b8c9555bc06f21b3d1e9ef8f2ccb93dd2c9dc82522449e3a857`);
console.log('');

if (ACTUAL_RECIPIENT.toLowerCase() === EXPECTED_WALLET_UI.toLowerCase()) {
  console.log('✅ Transaction recipient matches UI wallet');
} else {
  console.log('❌ Transaction recipient does NOT match UI wallet!');
  console.log(`   UI Wallet: ${EXPECTED_WALLET_UI}`);
  console.log(`   Transaction To: ${ACTUAL_RECIPIENT}`);
  console.log('');
  console.log('⚠️  This means:');
  console.log('   1. The deposit endpoint returned a DIFFERENT wallet address');
  console.log('   2. OR the database has a different wallet stored for your FID');
  console.log('   3. OR the wallet was recreated/changed at some point');
}
console.log('');

console.log('💡 Next Steps:');
console.log('   1. Check database: Query wallets table for FID', FID);
console.log('   2. Check deposit endpoint: See what address it returns');
console.log('   3. Verify: The recipient address might be an old wallet');
console.log('   4. Solution: Update database or use correct wallet address');

