#!/bin/bash

# Start Trading Session Test Script
# Tests real position opening on AvantisFi with $15 investment and $5 profit

echo "🚀 Starting Trading Session Test"
echo "================================="
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

# Check if JWT token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: JWT token required${NC}"
    echo ""
    echo "Usage: $0 <JWT_TOKEN>"
    echo ""
    echo "To get a JWT token:"
    echo "  1. Log in via the frontend"
    echo "  2. Get token from browser localStorage or API response"
    echo "  3. Or use: curl -X POST http://localhost:3000/api/auth/web -H 'Content-Type: application/json' -d '{}'"
    exit 1
fi

JWT_TOKEN=$1

# Check services are running
echo -e "${BLUE}Checking services...${NC}"

if ! curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Trading Engine not running${NC}"
    echo "  Fix: cd trading-engine && npm start"
    exit 1
fi

if ! curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Avantis Service not running${NC}"
    echo "  Fix: cd avantis-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 3002"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Start trading session
echo -e "${BLUE}Starting trading session...${NC}"
echo "  Investment: \$$INVESTMENT_AMOUNT"
echo "  Profit Goal: \$$PROFIT_GOAL"
echo "  Max Positions: $MAX_POSITIONS"
echo "  Loss Threshold: $LOSS_THRESHOLD%"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/trading/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"totalBudget\": $INVESTMENT_AMOUNT,
    \"investmentAmount\": $INVESTMENT_AMOUNT,
    \"profitGoal\": $PROFIT_GOAL,
    \"targetProfit\": $PROFIT_GOAL,
    \"maxPositions\": $MAX_POSITIONS,
    \"maxPerSession\": $MAX_POSITIONS,
    \"lossThreshold\": $LOSS_THRESHOLD
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Trading session started successfully!${NC}"
    echo ""
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Extract session ID
    SESSION_ID=$(echo "$BODY" | jq -r '.sessionId // .session_id // empty' 2>/dev/null)
    if [ ! -z "$SESSION_ID" ]; then
        echo ""
        echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
        echo ""
        echo "Monitor trades with:"
        echo "  ./monitor-trades.sh $SESSION_ID"
        echo ""
        echo "Or check positions:"
        echo "  curl -H 'Authorization: Bearer $JWT_TOKEN' http://localhost:3000/api/positions"
    fi
else
    echo -e "${RED}❌ Failed to start trading session${NC}"
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

