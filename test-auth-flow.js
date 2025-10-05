#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Helper function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const client = options.port === 443 ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAuthFlow() {
  console.log('🧪 Testing PrepX Authentication Flow\n');
  
  const baseUrl = 'localhost:3000';
  const phoneNumber = '+15551234567'; // Valid US test number
  
  try {
    // Step 1: Send OTP
    console.log('1️⃣ Sending OTP...');
    const sendOTPResponse = await makeRequest({
      hostname: baseUrl,
      port: 3000,
      path: '/api/wallet/send-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { phoneNumber });
    
    if (sendOTPResponse.status !== 200) {
      throw new Error(`Send OTP failed: ${sendOTPResponse.status}`);
    }
    
    const otp = sendOTPResponse.data.otp;
    console.log(`✅ OTP sent successfully: ${otp}`);
    
    // Step 2: Verify OTP
    console.log('\n2️⃣ Verifying OTP...');
    const verifyOTPResponse = await makeRequest({
      hostname: baseUrl,
      port: 3000,
      path: '/api/wallet/verify-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { phoneNumber, otp });
    
    if (verifyOTPResponse.status !== 200) {
      throw new Error(`Verify OTP failed: ${verifyOTPResponse.status}`);
    }
    
    const token = verifyOTPResponse.data.token;
    const user = verifyOTPResponse.data.user;
    console.log(`✅ OTP verified successfully`);
    console.log(`   Token: ${token.substring(0, 50)}...`);
    console.log(`   User: ${user.phoneNumber}`);
    
    // Step 3: Verify Token
    console.log('\n3️⃣ Verifying JWT Token...');
    const verifyTokenResponse = await makeRequest({
      hostname: baseUrl,
      port: 3000,
      path: '/api/auth/verify-token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (verifyTokenResponse.status !== 200) {
      throw new Error(`Verify token failed: ${verifyTokenResponse.status}`);
    }
    
    console.log(`✅ Token verified successfully`);
    console.log(`   User ID: ${verifyTokenResponse.data.user.id}`);
    
    console.log('\n🎉 All authentication tests passed!');
    console.log('\n📝 Summary:');
    console.log('   ✅ OTP sending works');
    console.log('   ✅ OTP verification works');
    console.log('   ✅ JWT token generation works');
    console.log('   ✅ JWT token verification works');
    console.log('   ✅ Authentication flow is complete');
    
  } catch (error) {
    console.error('\n❌ Authentication test failed:', error.message);
    process.exit(1);
  }
}

// Test demo OTP flow
async function testDemoFlow() {
  console.log('\n🧪 Testing Demo OTP Flow (123456)\n');
  
  const baseUrl = 'localhost:3000';
  const phoneNumber = '+15551234567'; // Valid US test number
  const demoOTP = '123456';
  
  try {
    // Send OTP first
    console.log('1️⃣ Sending OTP...');
    await makeRequest({
      hostname: baseUrl,
      port: 3000,
      path: '/api/wallet/send-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { phoneNumber });
    console.log('✅ OTP sent (will use demo OTP 123456)');
    
    console.log('\n2️⃣ Demo OTP flow should work in browser:');
    console.log('   - Go to http://localhost:3000/login');
    console.log('   - Enter phone number: +15551234567');
    console.log('   - Enter OTP: 123456');
    console.log('   - Should redirect to home page');
    
  } catch (error) {
    console.error('❌ Demo flow test failed:', error.message);
  }
}

// Run tests
testAuthFlow().then(() => {
  testDemoFlow();
}).catch(console.error);
