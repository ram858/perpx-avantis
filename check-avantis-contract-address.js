#!/usr/bin/env node

/**
 * Check if 0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F is the Avantis Trading contract
 */

const { ethers } = require('ethers');

const MYSTERY_ADDRESS = '0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F';
const RPC_URL = 'https://mainnet.base.org';

// Basic ERC20 ABI for checking if it's a token contract
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  }
];

// Contract detection ABI
const CONTRACT_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  }
];

async function checkAddress() {
  try {
    console.log('🔍 Checking Address Type\n');
    console.log('='.repeat(70));
    console.log(`Address: ${MYSTERY_ADDRESS}`);
    console.log('');
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check if it's a contract
    const code = await provider.getCode(MYSTERY_ADDRESS);
    const isContract = code !== '0x' && code !== '0x0';
    
    console.log(`📊 Contract Status: ${isContract ? '✅ IS A CONTRACT' : '❌ NOT A CONTRACT (EOA)'}`);
    console.log(`   Code length: ${code.length} bytes`);
    console.log('');
    
    if (isContract) {
      console.log('🔍 Checking Contract Type...');
      
      // Try to check if it's USDC
      try {
        const usdcContract = new ethers.Contract(MYSTERY_ADDRESS, ERC20_ABI, provider);
        const name = await usdcContract.name();
        const symbol = await usdcContract.symbol();
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        
        if (symbol === 'USDC') {
          console.log('');
          console.log('⚠️  This is the USDC TOKEN CONTRACT, not the Trading contract!');
          console.log('   Funds are being transferred TO the USDC contract, which is wrong.');
          console.log('   The Trading contract should APPROVE USDC, not transfer to it.');
        }
      } catch (e) {
        console.log('   Not a standard ERC20 token');
      }
      
      // Check transaction history
      console.log('');
      console.log('📝 Checking Recent Transactions...');
      console.log('   Visit: https://basescan.org/address/' + MYSTERY_ADDRESS);
      console.log('');
      
      // Check if this matches known Avantis contract addresses
      console.log('🔍 Known Avantis Addresses:');
      console.log('   USDC Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
      console.log('   Mystery:    ' + MYSTERY_ADDRESS);
      console.log('');
      
      if (MYSTERY_ADDRESS.toLowerCase() === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase()) {
        console.log('❌ This is the USDC token contract address!');
        console.log('   Funds should NOT be transferred directly to USDC contract.');
        console.log('   The Trading contract should be approved to spend USDC.');
      } else {
        console.log('✅ This is NOT the USDC contract');
        console.log('   This might be the Avantis Trading contract or vault.');
      }
    } else {
      console.log('❌ This is an EOA (Externally Owned Account), not a contract');
      console.log('   This should NOT be where funds go when opening positions.');
    }
    
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Check Avantis SDK documentation for Trading contract address');
    console.log('   2. Verify the address in the transaction that transfers funds');
    console.log('   3. Check if this is the vault address (where collateral is deposited)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAddress().catch(console.error);

