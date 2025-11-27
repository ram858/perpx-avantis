#!/usr/bin/env node

/**
 * Analyze the USDC transfer transaction
 * Decode the transaction data to find the actual recipient
 */

const { ethers } = require('ethers');

// Transaction data from user
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC Token Contract
const TRANSACTION_HASH = '0x0c281560193b5b8c9555bc06f21b3d1e9ef8f2ccb93dd2c9dc82522449e3a857';

// Function signature: transfer(address to, uint256 value)
// MethodID: 0xa9059cbb
// [0]: 0000000000000000000000001f4ef1ed23e38daa2bd1451d4cef219c93b2016f (recipient)
// [1]: 0000000000000000000000000000000000000000000000000000000000a7d8c0 (amount)

const RECIPIENT_HEX = '0x1f4ef1ed23e38daa2bd1451d4cef219c93b2016f';
const AMOUNT_HEX = '0x0000000000000000000000000000000000000000000000000000000000a7d8c0';

console.log('🔍 Transaction Analysis\n');
console.log('='.repeat(70));
console.log('📝 Transaction Details:');
console.log(`   Hash: ${TRANSACTION_HASH}`);
console.log(`   Contract: ${USDC_CONTRACT} (USDC Token Contract)`);
console.log(`   Function: transfer(address to, uint256 value)`);
console.log('');

// Decode recipient address
const recipientAddress = ethers.getAddress(RECIPIENT_HEX);
console.log('📤 Recipient Address (decoded):');
console.log(`   ${recipientAddress}`);
console.log('');

// Decode amount
const amountWei = BigInt(AMOUNT_HEX);
const amountUSDC = Number(amountWei) / 1e6; // USDC has 6 decimals
console.log('💰 Amount (decoded):');
console.log(`   ${amountUSDC} USDC`);
console.log(`   ($${amountUSDC.toFixed(2)})`);
console.log('');

console.log('='.repeat(70));
console.log('✅ Conclusion:');
console.log('');
console.log('The transaction called the USDC contract\'s transfer() function.');
console.log('The USDC contract address is NOT where funds went - it\'s the contract');
console.log('that holds all USDC tokens. The actual recipient is:');
console.log('');
console.log(`   ${recipientAddress}`);
console.log('');
console.log('This address received 11 USDC from your Farcaster wallet.');
console.log('');

// Check if this matches any known addresses
const UI_WALLET = '0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4';
const BASE_WALLET = '0x711B14f1f8d1dEaE5D622D1BA2Fb82435ea15Eba';

console.log('🔍 Address Comparison:');
console.log(`   UI Trading Wallet: ${UI_WALLET}`);
if (recipientAddress.toLowerCase() === UI_WALLET.toLowerCase()) {
  console.log('   ✅ MATCHES UI wallet!');
} else {
  console.log('   ❌ Does NOT match UI wallet');
}
console.log('');

console.log(`   Base Account Wallet: ${BASE_WALLET}`);
if (recipientAddress.toLowerCase() === BASE_WALLET.toLowerCase()) {
  console.log('   ✅ MATCHES Base wallet!');
} else {
  console.log('   ❌ Does NOT match Base wallet');
}
console.log('');

console.log(`   Transaction Recipient: ${recipientAddress}`);
console.log('');

if (recipientAddress.toLowerCase() !== UI_WALLET.toLowerCase() && 
    recipientAddress.toLowerCase() !== BASE_WALLET.toLowerCase()) {
  console.log('⚠️  WARNING:');
  console.log('   The recipient address does NOT match any wallet in your database!');
  console.log('   This means:');
  console.log('   1. The deposit endpoint returned a different address');
  console.log('   2. OR there\'s a wallet in database we haven\'t seen');
  console.log('   3. OR the transaction was sent to wrong address');
  console.log('');
  console.log('💡 Check your database for this address:');
  console.log(`   SELECT * FROM wallets WHERE address = '${recipientAddress}';`);
}

