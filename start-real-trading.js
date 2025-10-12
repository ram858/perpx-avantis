#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

// Function to kill process on a specific port
function killPort(port) {
  return new Promise((resolve) => {
    // Kill process on Mac/Linux
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, (error) => {
      if (error) {
        // No process found on port, that's fine
        resolve();
      } else {
        console.log(`🔧 Killed existing process on port ${port}`);
        resolve();
      }
    });
  });
}

// Function to start PostgreSQL if not running
function startPostgreSQL() {
  return new Promise((resolve) => {
    exec('pgrep -f "postgres.*postgresql@14" > /dev/null', (error) => {
      if (error) {
        console.log('🗄️  Starting PostgreSQL database...');
        exec('/usr/local/opt/postgresql@14/bin/postgres -D /usr/local/var/postgresql@14 > /tmp/postgres.log 2>&1 &', (err) => {
          if (err) {
            console.log('⚠️  Could not start PostgreSQL automatically');
            console.log('   Please run: ./setup-database.sh');
          } else {
            console.log('✅ PostgreSQL started');
          }
          // Wait a bit for PostgreSQL to be ready
          setTimeout(resolve, 3000);
        });
      } else {
        console.log('✅ PostgreSQL already running');
        resolve();
      }
    });
  });
}

async function startServers() {
  console.log('🚀 Starting Real Trading Mode...\n');
  
  // Start PostgreSQL if needed
  await startPostgreSQL();
  
  // Kill any existing processes on ports 3000 and 3001
  console.log('🔍 Checking for existing processes...');
  await killPort(3000);
  await killPort(3001);
  console.log('✅ Ports cleared\n');

  // Start Trading Engine
  console.log('📊 Starting Trading Engine on port 3001...');
  const tradingEngine = spawn('npx', ['ts-node', 'api/server.ts'], {
    cwd: path.join(__dirname, 'trading-engine'),
    stdio: 'inherit',
    shell: true
  });

  // Wait a bit for trading engine to start
  setTimeout(() => {
    console.log('\n🌐 Starting Next.js Frontend on port 3000...');
    
    // Start Next.js
    const nextjs = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down servers...');
      tradingEngine.kill();
      nextjs.kill();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Shutting down servers...');
      tradingEngine.kill();
      nextjs.kill();
      process.exit(0);
    });

    nextjs.on('error', (error) => {
      console.error('❌ Error starting Next.js:', error);
    });

    nextjs.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Next.js exited with code ${code}`);
        tradingEngine.kill();
        process.exit(code);
      }
    });
  }, 3000);

  tradingEngine.on('error', (error) => {
    console.error('❌ Error starting Trading Engine:', error);
  });

  tradingEngine.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Trading Engine exited with code ${code}`);
      process.exit(code);
    }
  });

  console.log('\n✅ Servers will be ready in a few seconds...');
  console.log('   - Trading Engine: http://localhost:3001');
  console.log('   - Frontend: http://localhost:3000\n');
  console.log('Press Ctrl+C to stop all servers\n');
}

// Start the servers
startServers();

