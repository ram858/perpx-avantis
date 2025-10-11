const { AuthService } = require('./lib/services/AuthService');
const { UserWalletService } = require('./lib/services/UserWalletService');

async function testUserTrading() {
  try {
    console.log('🧪 Testing User Trading Integration...\n');
    
    // Test 1: Check if user exists
    const authService = new AuthService();
    const userWalletService = new UserWalletService();
    
    console.log('1️⃣ Testing user authentication...');
    const testPhoneNumber = '9808110921';
    
    // Check if user exists in database
    const user = await authService.getUserByPhoneNumber(testPhoneNumber);
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    console.log('✅ User found:', user.phoneNumber);
    
    // Test 2: Check if user has wallet
    console.log('\n2️⃣ Testing wallet retrieval...');
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(testPhoneNumber);
    if (!wallet) {
      console.log('❌ No wallet found for user');
      return;
    }
    console.log('✅ Wallet found:');
    console.log('   Address:', wallet.address);
    console.log('   Has Private Key:', !!wallet.privateKey);
    
    // Test 3: Test trading engine with real data
    console.log('\n3️⃣ Testing trading engine with real user data...');
    const tradingEngineUrl = 'http://localhost:3001';
    
    const response = await fetch(`${tradingEngineUrl}/api/trading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxBudget: 50,
        profitGoal: 10,
        maxPerSession: 5,
        hyperliquidApiWallet: wallet.privateKey,
        userPhoneNumber: user.phoneNumber,
        walletAddress: wallet.address
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Trading engine response:', result);
    } else {
      const error = await response.text();
      console.log('❌ Trading engine error:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUserTrading();
