/**
 * Start trading session directly
 * Uses web user credentials to authenticate and start trading
 */

const fetch = require('node-fetch');

const FRONTEND_URL = 'http://localhost:3000';
const WEB_USER_ID = 3;
const WALLET_ADDRESS = '0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5';

async function startTrading() {
  try {
    console.log('🚀 Starting Trading Session');
    console.log('===========================');
    console.log('');
    console.log('Config:');
    console.log('  Investment: $10');
    console.log('  Target Profit: $5');
    console.log('  Max Positions: 3');
    console.log('  Wallet:', WALLET_ADDRESS);
    console.log('');

    // Step 1: Get JWT token by verifying OTP (or use existing session)
    // For testing, we'll try to get token from verify-otp endpoint
    console.log('Step 1: Getting authentication token...');
    
    // Use the phone number that was used for web user 3
    // We'll verify OTP to get a fresh token
    const phoneNumber = '+1234567890'; // Default test number
    
    const verifyResponse = await fetch(`${FRONTEND_URL}/api/auth/web/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        otp: '123456' // Default OTP
      })
    });

    if (!verifyResponse.ok) {
      console.error('❌ Failed to get token. Please ensure you are logged in via the UI.');
      console.log('');
      console.log('Alternative: Start trading from the UI:');
      console.log('  1. Open http://localhost:3000/chat?profit=5&investment=10&mode=real');
      console.log('  2. Or click "Start Trading" button');
      return;
    }

    const authData = await verifyResponse.json();
    const token = authData.token;

    if (!token) {
      console.error('❌ No token received. Please login via UI first.');
      return;
    }

    console.log('✅ Authentication successful');
    console.log('');

    // Step 2: Start trading session
    console.log('Step 2: Starting trading session...');
    
    const tradingResponse = await fetch(`${FRONTEND_URL}/api/trading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        totalBudget: 10,
        profitGoal: 5,
        maxPositions: 3,
        leverage: 1,
        lossThreshold: 10
      })
    });

    if (!tradingResponse.ok) {
      const errorData = await tradingResponse.json();
      console.error('❌ Failed to start trading:', errorData.error);
      return;
    }

    const sessionData = await tradingResponse.json();
    console.log('✅ Trading session started successfully!');
    console.log('Session ID:', sessionData.sessionId || sessionData.id);
    console.log('');
    console.log('📊 Trading is now active!');
    console.log('   - Bot is monitoring markets');
    console.log('   - Positions will open automatically when signals detected');
    console.log('   - Positions will appear in AvantisFi dashboard');
    console.log('');
    console.log('Monitor logs:');
    console.log('  tail -f /tmp/trading-engine.log | grep -E "(Opening|Position|AVANTIS)"');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Please start trading from the UI instead:');
    console.log('  http://localhost:3000/chat?profit=5&investment=10&mode=real');
  }
}

startTrading();

