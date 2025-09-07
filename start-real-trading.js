#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting PrepX Real Trading System...\n');

// Check if .env.local exists
const fs = require('fs');
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  console.log('Please create a .env.local file with your Hyperliquid configuration.');
  console.log('See env.example for reference.');
  process.exit(1);
}

// Check if Hyperliquid private key is configured
require('dotenv').config({ path: envPath });

if (!process.env.HYPERLIQUID_PK || process.env.HYPERLIQUID_PK === '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef') {
  console.error('❌ HYPERLIQUID_PK not configured!');
  console.log('Please set your real Hyperliquid private key in .env.local');
  console.log('⚠️  WARNING: This will use REAL MONEY on mainnet!');
  process.exit(1);
}

console.log('✅ Environment configuration loaded');
console.log('⚠️  WARNING: This will execute REAL TRADES on Hyperliquid mainnet!');
console.log('💰 Make sure you have sufficient funds and understand the risks.\n');

// Start the real trading server
const serverProcess = spawn('node', ['simple-api-server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

serverProcess.on('close', (code) => {
  console.log(`\n🛑 Trading server exited with code ${code}`);
  process.exit(code);
});

serverProcess.on('error', (error) => {
  console.error('❌ Error starting trading server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down trading server...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down trading server...');
  serverProcess.kill('SIGTERM');
});
