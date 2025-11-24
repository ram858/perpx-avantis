#!/bin/bash

# Complete Real Trading Test Script
# Tests real position opening on AvantisFi with $15 investment and $5 profit

echo "🚀 Real Trading Test - AvantisFi"
echo "=================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INVESTMENT_AMOUNT=15
PROFIT_GOAL=5
MAX_POSITIONS=3
LOSS_THRESHOLD=10
FRONTEND_URL="http://localhost:3000"

# Step 1: Get JWT Token
echo -e "${BLUE}Step 1: Getting Authentication Token...${NC}"

# Try to get token via web auth (creates user if doesn't exist)
AUTH_RESPONSE=$(curl -s -X POST "$FRONTEND_URL/api/auth/web" \
  -H "Content-Type: application/json" \
  -d '{}')

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${YELLOW}⚠️  Could not get token via web auth, trying OTP method...${NC}"
    
    # Try OTP method
    OTP_RESPONSE=$(curl -s -X POST "$FRONTEND_URL/api/auth/web/verify-otp" \
      -H "Content-Type: application/json" \
      -d '{
        "phoneNumber": "+1234567890",
        "otp": "123456"
      }')
    
    TOKEN=$(echo "$OTP_RESPONSE" | jq -r '.token // empty' 2>/dev/null)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}❌ Failed to get authentication token${NC}"
    echo ""
    echo "Please provide JWT token manually:"
    echo "  Usage: $0 <JWT_TOKEN>"
    echo ""
    echo "Or get token from:"
    echo "  1. Open http://localhost:3000"
    echo "  2. Log in via the UI"
    echo "  3. Get token from browser console or API response"
    exit 1
fi

echo -e "${GREEN}✅ Authentication token obtained${NC}"
echo ""

# Step 2: Check Balance
echo -e "${BLUE}Step 2: Checking Wallet Balance...${NC}"

POSITIONS_RESPONSE=$(curl -s -X GET "$FRONTEND_URL/api/positions" \
  -H "Authorization: Bearer $TOKEN")

BALANCE=$(echo "$POSITIONS_RESPONSE" | jq -r '.avantisBalance // .balance // 0' 2>/dev/null)

if [ ! -z "$BALANCE" ] && [ "$BALANCE" != "null" ]; then
    echo "  Avantis Balance: \$$BALANCE"
    
    if (( $(echo "$BALANCE < $INVESTMENT_AMOUNT" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${YELLOW}⚠️  Balance (\$$BALANCE) is less than investment amount (\$$INVESTMENT_AMOUNT)${NC}"
        echo "  You may need to deposit more funds to Avantis vault"
    else
        echo -e "${GREEN}✅ Balance sufficient for trading${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not fetch balance${NC}"
fi

echo ""

# Step 3: Start Trading Session
echo -e "${BLUE}Step 3: Starting Trading Session...${NC}"
echo "  Investment: \$$INVESTMENT_AMOUNT"
echo "  Profit Goal: \$$PROFIT_GOAL"
echo "  Max Positions: $MAX_POSITIONS"
echo "  Loss Threshold: $LOSS_THRESHOLD%"
echo ""

TRADING_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/trading/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"totalBudget\": $INVESTMENT_AMOUNT,
    \"investmentAmount\": $INVESTMENT_AMOUNT,
    \"profitGoal\": $PROFIT_GOAL,
    \"targetProfit\": $PROFIT_GOAL,
    \"maxPositions\": $MAX_POSITIONS,
    \"maxPerSession\": $MAX_POSITIONS,
    \"lossThreshold\": $LOSS_THRESHOLD
  }")

HTTP_CODE=$(echo "$TRADING_RESPONSE" | tail -n1)
BODY=$(echo "$TRADING_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Failed to start trading session${NC}"
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo -e "${GREEN}✅ Trading session started successfully!${NC}"
echo ""

# Extract session ID
SESSION_ID=$(echo "$BODY" | jq -r '.sessionId // .session_id // empty' 2>/dev/null)

if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Step 4: Monitor Positions
    echo -e "${BLUE}Step 4: Monitoring Positions (30 seconds)...${NC}"
    echo ""
    
    for i in {1..6}; do
        echo "--- Check $i/6 ($(date '+%H:%M:%S')) ---"
        
        # Check positions
        POS_RESPONSE=$(curl -s -X GET "$FRONTEND_URL/api/positions" \
          -H "Authorization: Bearer $TOKEN")
        
        OPEN_POSITIONS=$(echo "$POS_RESPONSE" | jq -r '.openPositions // .positions | length' 2>/dev/null || echo "0")
        AVANTIS_BALANCE=$(echo "$POS_RESPONSE" | jq -r '.avantisBalance // .balance // 0' 2>/dev/null || echo "0")
        
        echo "  Open Positions: $OPEN_POSITIONS"
        echo "  Avantis Balance: \$$AVANTIS_BALANCE"
        
        if [ "$OPEN_POSITIONS" != "0" ] && [ "$OPEN_POSITIONS" != "null" ]; then
            echo -e "${GREEN}  ✅ Positions detected!${NC}"
            echo ""
            echo "Position Details:"
            echo "$POS_RESPONSE" | jq '.positions // .' 2>/dev/null || echo "$POS_RESPONSE"
        fi
        
        echo ""
        sleep 5
    done
    
    echo -e "${BLUE}Step 5: Final Status Check${NC}"
    echo "================================"
    echo ""
    
    # Final check
    FINAL_POS_RESPONSE=$(curl -s -X GET "$FRONTEND_URL/api/positions" \
      -H "Authorization: Bearer $TOKEN")
    
    echo "$FINAL_POS_RESPONSE" | jq '.' 2>/dev/null || echo "$FINAL_POS_RESPONSE"
    echo ""
    
    echo -e "${GREEN}✅ Monitoring complete!${NC}"
    echo ""
    echo "To continue monitoring:"
    echo "  ./monitor-trades.sh $TOKEN $SESSION_ID"
    echo ""
    echo "To check AvantisFi positions directly (requires private key):"
    echo "  ./check-avantis-positions.sh <PRIVATE_KEY>"
    
else
    echo -e "${YELLOW}⚠️  No session ID returned${NC}"
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

