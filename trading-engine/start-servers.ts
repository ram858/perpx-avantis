#!/usr/bin/env ts-node

// Load environment variables from trading-engine/.env first
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from trading-engine directory if it exists
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { spawn } from 'child_process';

console.log('🚀 Starting PrepX Trading Integration...\n');

// Start API Server
console.log('📡 Starting API Server...');
const apiServer = spawn('ts-node', ['api/server.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.API_PORT || '3001' }
});

// Start WebSocket Server
console.log('🔌 Starting WebSocket Server...');
const wsServer = spawn('ts-node', ['websocket/server.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.WEBSOCKET_PORT || '3002' }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  apiServer.kill('SIGTERM');
  wsServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down servers...');
  apiServer.kill('SIGTERM');
  wsServer.kill('SIGTERM');
  process.exit(0);
});

// Handle server exits
apiServer.on('exit', (code) => {
  console.log(`📡 API Server exited with code ${code}`);
  if (code !== 0) {
    process.exit(1);
  }
});

wsServer.on('exit', (code) => {
  console.log(`🔌 WebSocket Server exited with code ${code}`);
  if (code !== 0) {
    process.exit(1);
  }
});

console.log('✅ All servers started successfully!');
console.log('📡 API Server: http://localhost:3001');
console.log('🔌 WebSocket Server: ws://localhost:3002');
console.log('🌐 Next.js App: http://localhost:3000');
console.log('\nPress Ctrl+C to stop all servers');
