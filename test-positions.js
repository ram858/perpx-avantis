#!/usr/bin/env node

// Test script to check if we can fetch positions from Hyperliquid
const https = require('https');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const privateKey = process.env.HYPERLIQUID_PK;
const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false';

console.log('🔍 Testing Hyperliquid Position Fetching...\n');

if (!privateKey) {
  console.error('❌ HYPERLIQUID_PK not found in environment');
  process.exit(1);
}

// Derive wallet address from private key (simplified)
const crypto = require('crypto');
const secp256k1 = require('secp256k1');

try {
  // Remove 0x prefix and convert to buffer
  const privateKeyBuffer = Buffer.from(privateKey.slice(2), 'hex');
  
  // Get public key
  const publicKey = secp256k1.publicKeyCreate(privateKeyBuffer, false);
  
  // Get address (last 20 bytes of keccak256 hash)
  const hash = crypto.createHash('sha3-256');
  hash.update(publicKey.slice(1)); // Remove first byte (0x04)
  const addressBytes = hash.digest().slice(-20);
  const walletAddress = '0x' + addressBytes.toString('hex');
  
  console.log(`✅ Wallet address derived: ${walletAddress}`);
  
  // Test API connectivity
  const apiUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
  console.log(`✅ Using API: ${apiUrl}`);
  
  // Test clearinghouse state endpoint
  testClearinghouseState(walletAddress, apiUrl);
  
} catch (error) {
  console.error('❌ Error deriving wallet address:', error.message);
  console.log('💡 Note: This is expected if secp256k1 is not installed');
  console.log('   The trading engine uses a different method to derive addresses');
  
  // Test with a dummy address to check API connectivity
  console.log('\n🔧 Testing API connectivity with dummy address...');
  testClearinghouseState('0x1234567890123456789012345678901234567890', isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz');
}

function testClearinghouseState(address, apiUrl) {
  const url = `${apiUrl}/clearinghouseState`;
  
  const postData = JSON.stringify({
    user: address.toLowerCase()
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 10000
  };
  
  console.log(`\n📡 Testing clearinghouse state for address: ${address}`);
  console.log(`   URL: ${url}`);
  
  const req = https.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`✅ API Response Status: ${res.statusCode}`);
      
      try {
        const response = JSON.parse(data);
        
        if (response.marginSummary) {
          console.log('✅ Clearinghouse state received successfully');
          console.log(`   Account Value: $${response.marginSummary.accountValue || '0'}`);
          console.log(`   Total Margin Used: $${response.marginSummary.totalMarginUsed || '0'}`);
          
          if (response.assetPositions && response.assetPositions.length > 0) {
            console.log(`   Open Positions: ${response.assetPositions.length}`);
            response.assetPositions.forEach((pos, index) => {
              const coin = pos.position?.coin || 'Unknown';
              const size = pos.position?.szi || '0';
              const entryPrice = pos.position?.entryPx || '0';
              console.log(`     ${index + 1}. ${coin}: ${size} @ $${entryPrice}`);
            });
          } else {
            console.log('   Open Positions: 0');
          }
        } else {
          console.log('⚠️  No margin summary in response (wallet may not be connected to Hyperliquid)');
        }
        
        // Test if this is a valid Hyperliquid response
        if (response.marginSummary || response.assetPositions !== undefined) {
          console.log('\n🎯 Trading System Status: READY');
          console.log('   ✅ Can connect to Hyperliquid API');
          console.log('   ✅ Can fetch wallet state');
          console.log('   ✅ Trading engine should be able to open positions');
        } else {
          console.log('\n⚠️  Trading System Status: PARTIAL');
          console.log('   ✅ Can connect to Hyperliquid API');
          console.log('   ❓ Wallet state unclear (may need to connect wallet to Hyperliquid)');
        }
        
      } catch (parseError) {
        console.log('⚠️  Could not parse API response as JSON');
        console.log('   Raw response:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ API request failed:', error.message);
  });
  
  req.on('timeout', () => {
    console.error('❌ API request timed out');
    req.destroy();
  });
  
  req.write(postData);
  req.end();
}
