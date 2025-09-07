#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('🚀 PrepX Real Trading Setup\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupRealTrading() {
  try {
    // Check if .env.local already exists
    const envPath = path.join(__dirname, '.env.local');
    const envExamplePath = path.join(__dirname, 'env.example');
    
    if (fs.existsSync(envPath)) {
      console.log('⚠️  .env.local already exists!');
      const overwrite = await askQuestion('Do you want to overwrite it? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    console.log('📝 Setting up real trading environment...\n');

    // Read the example file
    if (!fs.existsSync(envExamplePath)) {
      console.error('❌ env.example file not found!');
      rl.close();
      return;
    }

    let envContent = fs.readFileSync(envExamplePath, 'utf8');

    // Ask for Hyperliquid private key
    console.log('🔑 Hyperliquid Private Key Setup');
    console.log('   Go to https://app.hyperliquid.xyz → Settings → Export Private Key');
    console.log('   Your private key should start with "0x" and be 66 characters long\n');
    
    const privateKey = await askQuestion('Enter your Hyperliquid private key: ');
    
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      console.log('⚠️  Warning: Private key format seems incorrect. Make sure it starts with "0x" and is 66 characters long.');
      const proceed = await askQuestion('Do you want to proceed anyway? (y/N): ');
      if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    // Replace the placeholder private key
    envContent = envContent.replace(
      'HYPERLIQUID_PK=0x_your_private_key_here',
      `HYPERLIQUID_PK=${privateKey}`
    );

    // Add real trading mode
    envContent += '\n# Real Trading Mode\nREAL_TRADING_MODE=true\n';

    // Write the .env.local file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ .env.local file created successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Make sure you have funds in your Hyperliquid account');
    console.log('2. Start the real trading server:');
    console.log('   pnpm run start:real-trading');
    console.log('3. Open http://localhost:3000 and connect your wallet');
    console.log('4. Start with a small test trade ($10-20)');
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('- Real trading uses actual money');
    console.log('- Start with small amounts for testing');
    console.log('- Monitor your trades closely');
    console.log('- Keep your private key secure');

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
  } finally {
    rl.close();
  }
}

setupRealTrading();
