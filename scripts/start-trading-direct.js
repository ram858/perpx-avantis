/**
 * Start trading session directly for web user
 * This script authenticates and starts trading programmatically
 */

require('dotenv').config({ path: '.env.local' });
const { WebAuthService } = require('../lib/services/WebAuthService');
const fetch = require('node-fetch');

const FRONTEND_URL = 'http://localhost:3000';
const WEB_USER_ID = 3;

async function startTrading() {
  try {
    console.log('🚀 Starting Trading Session Directly');
    console.log('====================================');
    console.log('');
    console.log('Config:');
    console.log('  Investment: $10');
    console.log('  Target Profit: $5');
    console.log('  Max Positions: 3');
    console.log('  Leverage: 1x');
    console.log('  Loss Threshold: 10%');
    console.log('');

    // Step 1: Get JWT token for web user
    console.log('Step 1: Getting authentication token...');
    const webAuthService = new WebAuthService();
    const webUser = await webAuthService.getWebUserById(WEB_USER_ID);
    
    if (!webUser) {
      console.error('❌ Web user not found. Please ensure user exists.');
      return;
    }

    const token = await webAuthService.generateJwtToken(webUser);
    console.log('✅ Authentication token generated');
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
      console.error('❌ Failed to start trading:', errorData.error || errorData);
      console.log('');
      console.log('Response status:', tradingResponse.status);
      return;
    }

    const sessionData = await tradingResponse.json();
    console.log('✅ Trading session started successfully!');
    console.log('Session ID:', sessionData.sessionId || sessionData.id);
    console.log('Status:', sessionData.status);
    console.log('');
    console.log('📊 Trading is now LIVE!');
    console.log('   - Bot is monitoring markets');
    console.log('   - Positions will open automatically when signals detected');
    console.log('   - Positions will appear in AvantisFi dashboard');
    console.log('');
    console.log('Monitor logs:');
    console.log('  tail -f /tmp/trading-engine.log | grep -E "(Opening|Position|AVANTIS|SUCCESS)"');
    console.log('');
    console.log('View positions in AvantisFi:');
    console.log('  https://www.avantisfi.com/trade?asset=BTC-USD');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
    console.log('Alternative: Start trading from the UI:');
    console.log('  http://localhost:3000/chat?profit=5&investment=10&mode=real');
  }
}

startTrading();

