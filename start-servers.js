const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting PrepX Trading Servers...\n');

// Start API Server
console.log('📡 Starting API Server...');
const apiServer = spawn('node', ['-r', 'ts-node/register', 'trading-engine/api/server.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'development' }
});

// Start WebSocket Server
console.log('🔌 Starting WebSocket Server...');
const wsServer = spawn('node', ['-r', 'ts-node/register', 'trading-engine/websocket/server.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'development' }
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
});

wsServer.on('exit', (code) => {
  console.log(`🔌 WebSocket Server exited with code ${code}`);
});

console.log('✅ Servers starting...');
console.log('📡 API Server: http://localhost:3001');
console.log('🔌 WebSocket Server: ws://localhost:3002');
console.log('\nPress Ctrl+C to stop all servers');
