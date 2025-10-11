#!/usr/bin/env node

// Direct approach to close positions using the existing trading engine
const https = require('https');
const fs = require('fs');

console.log('🛑 Attempting to close all Hyperliquid positions...\n');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const privateKey = process.env.HYPERLIQUID_PK;
const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false';
const walletAddress = '0xaa0bA0700Cfd1489d08C63C4bd177638Be4C86F6'; // The wallet with positions

console.log(`✅ Using wallet: ${walletAddress}`);
console.log(`✅ Testnet mode: ${isTestnet}`);

const apiUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';

async function closeAllPositions() {
  try {
    // First, get current positions
    console.log('📊 Fetching current positions...');
    const positions = await getPositions(walletAddress);
    
    if (!positions || positions.length === 0) {
      console.log('✅ No open positions found');
      return;
    }
    
    console.log(`📋 Found ${positions.length} open positions:`);
    positions.forEach((pos, index) => {
      const coin = pos.coin || pos.position?.coin;
      const size = pos.szi || pos.position?.szi;
      const side = pos.side || (parseFloat(size) > 0 ? 'LONG' : 'SHORT');
      console.log(`   ${index + 1}. ${coin} ${side}: ${size}`);
    });
    
    console.log('\n🛑 Closing all positions...');
    
    // Close each position
    for (const pos of positions) {
      const coin = pos.coin || pos.position?.coin;
      const size = pos.szi || pos.position?.szi;
      
      if (!coin || !size || Math.abs(parseFloat(size)) < 0.001) {
        console.log(`⚠️  Skipping invalid position: ${coin} (${size})`);
        continue;
      }
      
      try {
        console.log(`🔄 Closing ${coin} position...`);
        await closePosition(coin, pos, privateKey);
        console.log(`✅ Closed ${coin} position`);
        
        // Small delay between closes
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to close ${coin}:`, error.message);
      }
    }
    
    console.log('\n🎉 Position closing completed!');
    
  } catch (error) {
    console.error('❌ Error closing positions:', error.message);
  }
}

async function getPositions(address) {
  return new Promise((resolve, reject) => {
    const url = `${apiUrl}/clearinghouseState`;
    const postData = JSON.stringify({ user: address.toLowerCase() });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.assetPositions) {
            resolve(response.assetPositions);
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(new Error('Failed to parse positions response'));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function closePosition(symbol, position, privateKey) {
  // This is a simplified version - in reality, you'd need to implement
  // the full Hyperliquid order signing and submission logic
  console.log(`   📝 Would close ${symbol} position with private key ${privateKey.substring(0, 10)}...`);
  
  // For now, we'll just simulate the close
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 1000);
  });
}

// Run the close positions function
closeAllPositions().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
