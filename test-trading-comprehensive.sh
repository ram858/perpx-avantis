#!/bin/bash

# Comprehensive Trading Start Test
# Tests both the Next.js API route and validates the request/response flow

echo "=========================================="
echo "Comprehensive Trading Start Test"
echo "=========================================="
echo ""

# Configuration
WALLET_ADDRESS="0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4"
PRIVATE_KEY="0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e"
TRADING_ENGINE_URL="${TRADING_ENGINE_URL:-http://localhost:3001}"
API_URL="${API_URL:-http://localhost:3000}"

echo "Configuration:"
echo "  Wallet: $WALLET_ADDRESS"
echo "  Private Key: ${PRIVATE_KEY:0:10}...${PRIVATE_KEY: -4}"
echo "  Trading Engine: $TRADING_ENGINE_URL"
echo "  Next.js API: $API_URL"
echo ""

# Test 1: Check Trading Engine Health
echo "=========================================="
echo "Test 1: Trading Engine Health Check"
echo "=========================================="
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$TRADING_ENGINE_URL/api/health" 2>&1)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✅ Trading engine is running"
  echo "$HEALTH_BODY" | jq '.' 2>/dev/null || echo "$HEALTH_BODY"
else
  echo "❌ Trading engine is NOT running (Status: $HEALTH_STATUS)"
  echo "   Make sure to start the trading engine first:"
  echo "   cd trading-engine && npm start"
fi
echo ""

# Test 2: Validate Private Key Format
echo "=========================================="
echo "Test 2: Private Key Validation"
echo "=========================================="
if [[ ${PRIVATE_KEY} =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "✅ Private key format is valid (66 characters, starts with 0x)"
else
  echo "❌ Private key format is invalid"
  echo "   Expected: 0x followed by 64 hex characters (66 total)"
  echo "   Got: ${#PRIVATE_KEY} characters"
fi
echo ""

# Test 3: Validate Wallet Address Format
echo "=========================================="
echo "Test 3: Wallet Address Validation"
echo "=========================================="
if [[ ${WALLET_ADDRESS} =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "✅ Wallet address format is valid (42 characters, starts with 0x)"
else
  echo "❌ Wallet address format is invalid"
  echo "   Expected: 0x followed by 40 hex characters (42 total)"
  echo "   Got: ${#WALLET_ADDRESS} characters"
fi
echo ""

# Test 4: Test Trading Engine Directly (if running)
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "=========================================="
  echo "Test 4: Trading Engine Direct Test"
  echo "=========================================="
  
  PAYLOAD=$(cat <<EOF
{
  "maxBudget": 10,
  "profitGoal": 5,
  "maxPerSession": 3,
  "lossThreshold": 10,
  "avantisApiWallet": "$PRIVATE_KEY",
  "userFid": 1464243,
  "walletAddress": "$WALLET_ADDRESS"
}
EOF
)

  echo "Sending request to: $TRADING_ENGINE_URL/api/trading/start"
  echo "Payload:"
  echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"
  echo ""

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$TRADING_ENGINE_URL/api/trading/start" 2>&1)

  HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

  echo "Response:"
  echo "  HTTP Status: $HTTP_STATUS"
  echo "  Body:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ SUCCESS: Trading session started!"
    SESSION_ID=$(echo "$BODY" | jq -r '.sessionId' 2>/dev/null)
    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
      echo "  Session ID: $SESSION_ID"
    fi
  else
    echo "❌ ERROR: Failed to start trading"
    ERROR=$(echo "$BODY" | jq -r '.error' 2>/dev/null)
    if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
      echo "  Error: $ERROR"
    fi
  fi
  echo ""
fi

# Test 5: Check Next.js API (if running)
echo "=========================================="
echo "Test 5: Next.js API Check"
echo "=========================================="
API_HEALTH=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_URL/api/health" 2>&1 || echo "HTTP_STATUS:000")
API_STATUS=$(echo "$API_HEALTH" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ]; then
  echo "✅ Next.js API is running"
  echo "   Note: You'll need a valid auth token to test the /api/trading/start endpoint"
  echo "   The endpoint requires: Authorization: Bearer <token>"
else
  echo "❌ Next.js API is NOT running (Status: $API_STATUS)"
  echo "   Make sure to start Next.js: npm run dev"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✅ All validation checks completed"
echo ""
echo "To test the full flow:"
echo "1. Start trading engine: cd trading-engine && npm start"
echo "2. Start Next.js: npm run dev"
echo "3. Use the app UI to start trading (requires auth token)"
echo ""

