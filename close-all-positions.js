#!/usr/bin/env node

// Script to close all positions on Hyperliquid testnet
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🛑 Closing all Hyperliquid positions...\n');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const privateKey = process.env.HYPERLIQUID_PK;
const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false';

if (!privateKey) {
  console.error('❌ HYPERLIQUID_PK not found in environment');
  process.exit(1);
}

console.log(`✅ Using private key: ${privateKey.substring(0, 10)}...${privateKey.substring(privateKey.length - 4)}`);
console.log(`✅ Testnet mode: ${isTestnet}`);

// Create a temporary script to close positions
const closeScript = `
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  initBlockchain,
  closeAllPositions,
  getPositions
} from './trading-engine/hyperliquid/hyperliquid.js';

async function closeAllPositionsScript() {
  try {
    console.log('🔧 Initializing Hyperliquid connection...');
    await initBlockchain();
    
    console.log('📊 Fetching current positions...');
    const positions = await getPositions();
    
    if (!positions || positions.length === 0) {
      console.log('✅ No open positions found');
      return;
    }
    
    console.log(\`📋 Found \${positions.length} open positions:\`);
    positions.forEach((pos, index) => {
      const coin = pos.coin || pos.position?.coin;
      const size = pos.szi || pos.position?.szi;
      console.log(\`   \${index + 1}. \${coin}: \${size}\`);
    });
    
    console.log('\\n🛑 Closing all positions...');
    await closeAllPositions();
    
    console.log('✅ All positions closed successfully!');
    
  } catch (error) {
    console.error('❌ Error closing positions:', error);
    process.exit(1);
  }
}

closeAllPositionsScript();
`;

// Write the script to a temporary file
fs.writeFileSync('/tmp/close-positions.mjs', closeScript);

try {
  console.log('🚀 Executing position closing script...');
  
  // Execute the script
  const result = execSync('node --experimental-modules /tmp/close-positions.mjs', {
    cwd: '/Users/mokshya/Desktop/prep-x',
    encoding: 'utf8',
    stdio: 'inherit'
  });
  
  console.log('\\n🎉 Position closing completed successfully!');
  
} catch (error) {
  console.error('❌ Failed to close positions:', error.message);
  
  // Try alternative approach using the trading engine directly
  console.log('\\n🔄 Trying alternative approach...');
  
  try {
    // Change to trading engine directory and run close all
    const result = execSync('cd trading-engine/hyperliquid && node -e "require(\'./hyperliquid.js\').closeAllPositions().then(() => console.log(\'✅ Positions closed\')).catch(e => console.error(\'❌ Error:\', e))"', {
      cwd: '/Users/mokshya/Desktop/prep-x',
      encoding: 'utf8',
      stdio: 'inherit'
    });
  } catch (altError) {
    console.error('❌ Alternative approach also failed:', altError.message);
    console.log('\\n💡 Manual solution:');
    console.log('   1. Go to https://app.hyperliquid-testnet.xyz');
    console.log('   2. Connect your wallet');
    console.log('   3. Go to the Positions tab');
    console.log('   4. Click "Close All" or close each position individually');
  }
} finally {
  // Clean up temporary file
  try {
    fs.unlinkSync('/tmp/close-positions.mjs');
  } catch (e) {
    // Ignore cleanup errors
  }
}
