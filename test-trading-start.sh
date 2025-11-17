#!/bin/bash

# Test Trading Start Endpoint
# This script tests the trading start API before pushing to production

echo "=========================================="
echo "Testing Trading Start Endpoint"
echo "=========================================="
echo ""

# Configuration
WALLET_ADDRESS="0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4"
PRIVATE_KEY="0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e"
TRADING_ENGINE_URL="${TRADING_ENGINE_URL:-http://localhost:3001}"
API_URL="${API_URL:-http://localhost:3000}"

# You'll need to get a valid token - for now we'll test the trading engine directly
echo "Testing Trading Engine directly..."
echo "Wallet: $WALLET_ADDRESS"
echo "Private Key: ${PRIVATE_KEY:0:10}...${PRIVATE_KEY: -4}"
echo ""

# Test payload
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

# Make the request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$TRADING_ENGINE_URL/api/trading/start")

# Extract HTTP status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "=========================================="
echo "Response:"
echo "HTTP Status: $HTTP_STATUS"
echo "Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo "=========================================="

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ SUCCESS: Trading session started!"
  SESSION_ID=$(echo "$BODY" | jq -r '.sessionId' 2>/dev/null)
  if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    echo "Session ID: $SESSION_ID"
  fi
else
  echo "❌ ERROR: Failed to start trading"
  ERROR=$(echo "$BODY" | jq -r '.error' 2>/dev/null)
  if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
    echo "Error: $ERROR"
  fi
fi

