#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🔧 PrepX Twilio Setup Helper\n')

console.log('To set up Twilio SMS functionality:')
console.log('1. Go to https://console.twilio.com/')
console.log('2. Create a new account or sign in')
console.log('3. Get your Account SID and Auth Token from the dashboard')
console.log('4. Buy a phone number from Twilio (or use trial number)')
console.log('5. Set the following environment variables:\n')

console.log('export TWILIO_ACCOUNT_SID="your_account_sid_here"')
console.log('export TWILIO_AUTH_TOKEN="your_auth_token_here"')
console.log('export TWILIO_PHONE_NUMBER="+1234567890"')
console.log('\nOr add them to your .env.local file:\n')

console.log('# Twilio Configuration')
console.log('TWILIO_ACCOUNT_SID=your_account_sid_here')
console.log('TWILIO_AUTH_TOKEN=your_auth_token_here')
console.log('TWILIO_PHONE_NUMBER=+1234567890')
console.log('\n')

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  console.log('📄 Found .env.local file')
  const envContent = fs.readFileSync(envPath, 'utf8')
  
  if (envContent.includes('TWILIO_ACCOUNT_SID')) {
    console.log('✅ Twilio configuration found in .env.local')
  } else {
    console.log('⚠️  Twilio configuration not found in .env.local')
    console.log('Add the Twilio variables to your .env.local file')
  }
} else {
  console.log('📄 .env.local file not found')
  console.log('Create a .env.local file with your Twilio credentials')
}

console.log('\n🚀 After setting up Twilio, restart your development server:')
console.log('pnpm run dev')
console.log('\n💡 For development/testing, you can still use the demo OTP: 123456')
