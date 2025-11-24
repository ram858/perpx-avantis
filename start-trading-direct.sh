#!/bin/bash

# Direct trading session starter
# Uses wallet private key from database

WALLET_ADDRESS="0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5"
TRADING_ENGINE_URL="http://localhost:3001"

echo "🚀 Starting Trading Session Directly"
echo "====================================="
echo ""
echo "Config:"
echo "  Investment: \$10"
echo "  Target Profit: \$5"
echo "  Max Positions: 3"
echo "  Leverage: 1x"
echo "  Loss Threshold: 10%"
echo "  Wallet: $WALLET_ADDRESS"
echo ""

# Note: We need to get the private key from the database
# For now, we'll start via the trading engine API
# The private key will be retrieved by the API from the database

echo "📝 Starting session via trading engine..."
echo ""

# Start trading session directly via trading engine
# Note: This requires the private key to be passed
# The trading engine will get it from the API call

RESPONSE=$(curl -s -X POST "$TRADING_ENGINE_URL/api/trading/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"maxBudget\": 10,
    \"profitGoal\": 5,
    \"maxPerSession\": 3,
    \"lossThreshold\": 10,
    \"walletAddress\": \"$WALLET_ADDRESS\",
    \"webUserId\": 3
  }" 2>&1)

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "sessionId\|session_id"; then
  echo "✅ Trading session started successfully!"
  SESSION_ID=$(echo "$RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || echo "$RESPONSE" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
  echo "Session ID: $SESSION_ID"
  echo ""
  echo "📊 Monitoring position activity..."
  echo "Watch for positions opening in the logs"
else
  echo "⚠️  Note: Trading engine requires private key"
  echo "   The private key should be passed via the frontend API"
  echo "   Or retrieved from the database"
fi

