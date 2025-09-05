#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting PrepX Integrated Trading App...\n');

// Start Next.js app
console.log('🌐 Starting Next.js app...');
const nextApp = spawn('pnpm', ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Start API Server
console.log('📡 Starting API Server...');
const apiServer = spawn('pnpm', ['run', 'dev:api'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Start WebSocket Server
console.log('🔌 Starting WebSocket Server...');
const wsServer = spawn('pnpm', ['run', 'dev:websocket'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all services...');
  nextApp.kill('SIGTERM');
  apiServer.kill('SIGTERM');
  wsServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down all services...');
  nextApp.kill('SIGTERM');
  apiServer.kill('SIGTERM');
  wsServer.kill('SIGTERM');
  process.exit(0);
});

// Handle server exits
nextApp.on('exit', (code) => {
  console.log(`🌐 Next.js app exited with code ${code}`);
});

apiServer.on('exit', (code) => {
  console.log(`📡 API Server exited with code ${code}`);
});

wsServer.on('exit', (code) => {
  console.log(`🔌 WebSocket Server exited with code ${code}`);
});

console.log('✅ All services starting...');
console.log('🌐 Next.js App: http://localhost:3000');
console.log('📡 API Server: http://localhost:3001');
console.log('🔌 WebSocket Server: ws://localhost:3002');
console.log('\nPress Ctrl+C to stop all services');
