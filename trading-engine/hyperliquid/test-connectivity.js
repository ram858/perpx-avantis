#!/usr/bin/env node

// Simple network connectivity test for Hyperliquid APIs
const https = require('https');
const dns = require('dns');

const endpoints = [
  { name: 'Testnet API', url: 'https://api.hyperliquid-testnet.xyz' },
  { name: 'Mainnet API', url: 'https://api.hyperliquid.xyz' }
];

async function testEndpoint(name, url) {
  return new Promise((resolve) => {
    console.log(`\n🌐 Testing ${name}...`);
    
    const req = https.get(url, (res) => {
      console.log(`✅ ${name}: Status ${res.statusCode}`);
      resolve({ success: true, status: res.statusCode });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      console.log(`⏰ ${name}: Timeout after 10 seconds`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
}

async function testDNS(hostname) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing DNS resolution for ${hostname}...`);
    
    dns.lookup(hostname, (err, address, family) => {
      if (err) {
        console.log(`❌ DNS failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      } else {
        console.log(`✅ DNS resolved: ${address} (IPv${family})`);
        resolve({ success: true, address, family });
      }
    });
  });
}

async function runTests() {
  console.log('🚀 Hyperliquid Network Connectivity Test\n');
  
  // Test DNS resolution
  await testDNS('api.hyperliquid-testnet.xyz');
  await testDNS('api.hyperliquid.xyz');
  
  // Test HTTP connectivity
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint.name, endpoint.url);
  }
  
  console.log('\n📋 Summary:');
  console.log('- If DNS tests fail: Check your internet connection and DNS settings');
  console.log('- If HTTP tests fail: The API might be down or blocked by firewall');
  console.log('- Try switching between testnet and mainnet in your .env file');
}

runTests().catch(console.error);
