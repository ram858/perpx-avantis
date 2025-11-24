#!/bin/bash

# Quick script to get JWT token for testing

echo "🔑 Getting JWT Token"
echo "==================="
echo ""

# Try web auth
echo "Trying web auth..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/web \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.token // empty' 2>/dev/null)

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "✅ Token obtained via web auth"
    echo ""
    echo "Token: $TOKEN"
    echo ""
    echo "Use this token with:"
    echo "  ./test-real-trading.sh $TOKEN"
    exit 0
fi

# Try OTP method
echo "Trying OTP method..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/web/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "otp": "123456"
  }' | jq -r '.token // empty' 2>/dev/null)

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "✅ Token obtained via OTP"
    echo ""
    echo "Token: $TOKEN"
    echo ""
    echo "Use this token with:"
    echo "  ./test-real-trading.sh $TOKEN"
    exit 0
fi

echo "❌ Could not get token automatically"
echo ""
echo "Please get token manually:"
echo "  1. Open http://localhost:3000"
echo "  2. Log in via UI"
echo "  3. Get token from browser console or network tab"
echo ""
echo "Or use direct trading engine test:"
echo "  ./test-trading-direct.sh <PRIVATE_KEY> <WALLET_ADDRESS>"

