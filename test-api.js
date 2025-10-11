#!/usr/bin/env node

// Test different Hyperliquid API endpoints
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false';
const testAddress = '0xaa0bA0700Cfd1489d08C63C4bd177638Be4C86F6';

console.log('🔍 Testing Hyperliquid API Endpoints...\n');

const apiUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
console.log(`✅ Testing API: ${apiUrl}`);

// Test different endpoints
const endpoints = [
  { name: 'Info', path: '/info', method: 'GET' },
  { name: 'Meta', path: '/meta', method: 'GET' },
  { name: 'Clearinghouse State', path: '/clearinghouseState', method: 'POST', data: { user: testAddress.toLowerCase() } },
  { name: 'User State', path: '/userState', method: 'POST', data: { user: testAddress.toLowerCase() } },
  { name: 'All Mids', path: '/allMids', method: 'GET' },
  { name: 'L2 Book', path: '/l2Book', method: 'POST', data: { coin: 'BTC' } }
];

let completed = 0;

endpoints.forEach((endpoint, index) => {
  setTimeout(() => {
    testEndpoint(endpoint, () => {
      completed++;
      if (completed === endpoints.length) {
        console.log('\n📊 API Testing Complete!');
        console.log('   If any endpoints returned 200, the API is working');
        console.log('   The trading engine should be able to connect and trade');
      }
    });
  }, index * 1000); // Stagger requests
});

function testEndpoint(endpoint, callback) {
  const url = `${apiUrl}${endpoint.path}`;
  
  const options = {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10000
  };
  
  if (endpoint.data) {
    options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(endpoint.data));
  }
  
  const req = https.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      const status = res.statusCode;
      const success = status === 200;
      
      console.log(`${success ? '✅' : '❌'} ${endpoint.name}: ${status}`);
      
      if (success && data.length > 0) {
        try {
          const response = JSON.parse(data);
          if (endpoint.name === 'Info') {
            console.log(`   Universe assets: ${response.universe?.length || 'unknown'}`);
          } else if (endpoint.name === 'Meta') {
            console.log(`   Universe assets: ${response.universe?.length || 'unknown'}`);
          } else if (endpoint.name === 'Clearinghouse State' || endpoint.name === 'User State') {
            if (response.marginSummary) {
              console.log(`   Account Value: $${response.marginSummary.accountValue || '0'}`);
              console.log(`   Positions: ${response.assetPositions?.length || 0}`);
            } else {
              console.log(`   No wallet data (wallet not connected to Hyperliquid)`);
            }
          } else if (endpoint.name === 'All Mids') {
            console.log(`   Price feeds: ${Object.keys(response || {}).length}`);
          } else if (endpoint.name === 'L2 Book') {
            console.log(`   Order book levels: ${response.levels?.length || 0}`);
          }
        } catch (e) {
          console.log(`   Response length: ${data.length} bytes`);
        }
      }
      
      callback();
    });
  });
  
  req.on('error', (error) => {
    console.log(`❌ ${endpoint.name}: Network error`);
    callback();
  });
  
  req.on('timeout', () => {
    console.log(`⏰ ${endpoint.name}: Timeout`);
    req.destroy();
    callback();
  });
  
  if (endpoint.data) {
    req.write(JSON.stringify(endpoint.data));
  }
  
  req.end();
}
