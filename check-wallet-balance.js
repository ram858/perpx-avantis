#!/usr/bin/env node

/**
 * Check wallet balance and Avantis vault balance
 * Verifies if funds are stuck in the contract
 */

const { ethers } = require('ethers');

// Configuration
const PRIVATE_KEY = '0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e';
const RPC_URL = 'https://mainnet.base.org';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC

// USDC ABI (minimal - just what we need)
const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  }
];

async function checkBalances() {
  try {
    console.log('🔍 Checking Wallet Balances...\n');
    console.log('='.repeat(60));
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const walletAddress = wallet.address;
    
    console.log(`📝 Wallet Address: ${walletAddress}`);
    console.log(`🔑 Private Key: ${PRIVATE_KEY.slice(0, 10)}...${PRIVATE_KEY.slice(-4)}`);
    console.log('');
    
    // Check ETH balance
    const ethBalance = await provider.getBalance(walletAddress);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`💰 ETH Balance: ${ethBalanceFormatted} ETH`);
    console.log(`   ($${(parseFloat(ethBalanceFormatted) * 2500).toFixed(2)} @ $2500/ETH)`);
    console.log('');
    
    // Check USDC balance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const usdcBalanceRaw = await usdcContract.balanceOf(walletAddress);
    const usdcBalance = parseFloat(ethers.formatUnits(usdcBalanceRaw, 6)); // USDC has 6 decimals
    console.log(`💵 USDC Balance (Wallet): ${usdcBalance.toFixed(6)} USDC`);
    console.log(`   ($${usdcBalance.toFixed(2)})`);
    console.log('');
    
    // Check USDC allowance for Avantis Trading contract
    // Avantis Trading contract address (Base mainnet)
    const AVANTIS_TRADING_CONTRACT = '0x0000000000000000000000000000000000000000'; // Need to find actual address
    console.log('⚠️  Note: To check Avantis vault balance, we need the Avantis contract address.');
    console.log('   The vault balance is what Avantis uses for trading, not the wallet balance.');
    console.log('');
    
    // Summary
    console.log('='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   Wallet Address: ${walletAddress}`);
    console.log(`   ETH: ${ethBalanceFormatted} ETH`);
    console.log(`   USDC (Wallet): ${usdcBalance.toFixed(2)} USDC`);
    console.log('');
    
    if (usdcBalance < 0.01) {
      console.log('⚠️  WARNING: Very low USDC balance in wallet!');
      console.log('   If you transferred $11 USDC, it may be:');
      console.log('   1. In the Avantis vault (not in wallet)');
      console.log('   2. Used in a position (check Avantis UI)');
      console.log('   3. Stuck in contract approval');
    } else {
      console.log('✅ USDC is in the wallet');
    }
    
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Check Avantis UI for vault balance');
    console.log('   2. Check if any positions exist (even if UI shows 0)');
    console.log('   3. Check transaction history for contract interactions');
    
  } catch (error) {
    console.error('❌ Error checking balances:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the check
checkBalances().catch(console.error);

