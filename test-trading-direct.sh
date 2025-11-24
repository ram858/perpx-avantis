#!/bin/bash

# Direct Trading Engine Test (Bypasses Frontend)
# Tests real position opening with $15 investment and $5 profit

echo "🚀 Direct Trading Engine Test - Real Positions"
echo "=============================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
# Note: Avantis requires $11.5 minimum per position
# With $15 investment:
#   - 1 position = $15 per position ✅ (meets minimum)
#   - 3 positions = $5 per position ❌ (below minimum)
# Using 1 position to meet user's $15 investment requirement
INVESTMENT_AMOUNT=15
PROFIT_GOAL=5
MAX_POSITIONS=1
LOSS_THRESHOLD=10

# Check if private key and wallet address are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}❌ Error: Private key and wallet address required${NC}"
    echo ""
    echo "Usage: $0 <PRIVATE_KEY> <WALLET_ADDRESS>"
    echo ""
    echo "⚠️  WARNING: This will use your private key directly"
    echo "  Only use with a test wallet, never with main wallet!"
    echo ""
    echo "Example:"
    echo "  $0 0x1234...abcd 0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5"
    echo ""
    echo "Alternative: Use frontend API (safer):"
    echo "  1. Get JWT token from frontend"
    echo "  2. Use: ./test-real-trading.sh <JWT_TOKEN>"
    exit 1
fi

PRIVATE_KEY=$1
WALLET_ADDRESS=$2

# Check services
echo -e "${BLUE}Checking services...${NC}"

if ! curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Trading Engine not running${NC}"
    exit 1
fi

if ! curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Avantis Service not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Check balance first
echo -e "${BLUE}Step 1: Checking Balance...${NC}"
BALANCE_RESPONSE=$(curl -s -X POST http://localhost:3002/api/balance \
  -H "Content-Type: application/json" \
  -d "{\"private_key\": \"$PRIVATE_KEY\"}")

BALANCE=$(echo "$BALANCE_RESPONSE" | jq -r '.usdc_balance // .total_balance // 0' 2>/dev/null || echo "0")

if [ ! -z "$BALANCE" ] && [ "$BALANCE" != "null" ]; then
    echo "  Balance: \$$BALANCE"
    
    if (( $(echo "$BALANCE < $INVESTMENT_AMOUNT" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${YELLOW}⚠️  Balance (\$$BALANCE) is less than investment (\$$INVESTMENT_AMOUNT)${NC}"
        echo "  You may need to deposit more funds"
    else
        echo -e "${GREEN}✅ Balance sufficient${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not fetch balance${NC}"
fi

echo ""

# Start trading session directly via trading engine
echo -e "${BLUE}Step 2: Starting Trading Session...${NC}"
echo "  Investment: \$$INVESTMENT_AMOUNT"
echo "  Profit Goal: \$$PROFIT_GOAL"
echo "  Max Positions: $MAX_POSITIONS"
echo "  Wallet: ${WALLET_ADDRESS:0:10}...${WALLET_ADDRESS: -6}"
echo ""

SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/trading/start \
  -H "Content-Type: application/json" \
  -d "{
    \"maxBudget\": $INVESTMENT_AMOUNT,
    \"profitGoal\": $PROFIT_GOAL,
    \"maxPerSession\": $MAX_POSITIONS,
    \"lossThreshold\": $LOSS_THRESHOLD,
    \"avantisApiWallet\": \"$PRIVATE_KEY\",
    \"walletAddress\": \"$WALLET_ADDRESS\"
  }")

HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -n1)
BODY=$(echo "$SESSION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Failed to start trading session${NC}"
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo -e "${GREEN}✅ Trading session started!${NC}"
echo ""

SESSION_ID=$(echo "$BODY" | jq -r '.sessionId // empty' 2>/dev/null)

if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Monitor positions
    echo -e "${BLUE}Step 3: Monitoring Positions (60 seconds)...${NC}"
    echo ""
    
    for i in {1..12}; do
        echo "--- Check $i/12 ($(date '+%H:%M:%S')) ---"
        
        # Check positions via Avantis API
        POS_RESPONSE=$(curl -s -X POST http://localhost:3002/api/positions \
          -H "Content-Type: application/json" \
          -d "{\"private_key\": \"$PRIVATE_KEY\"}")
        
        OPEN_POSITIONS=$(echo "$POS_RESPONSE" | jq -r '.positions | length // 0' 2>/dev/null || echo "0")
        
        echo "  Open Positions: $OPEN_POSITIONS"
        
        if [ "$OPEN_POSITIONS" != "0" ] && [ "$OPEN_POSITIONS" != "null" ]; then
            echo -e "${GREEN}  ✅ Positions detected!${NC}"
            echo ""
            echo "Position Details:"
            echo "$POS_RESPONSE" | jq '.' 2>/dev/null || echo "$POS_RESPONSE"
            echo ""
        fi
        
        # Check session status
        SESSION_STATUS=$(curl -s http://localhost:3001/api/trading/session/$SESSION_ID 2>/dev/null)
        if [ ! -z "$SESSION_STATUS" ]; then
            STATUS=$(echo "$SESSION_STATUS" | jq -r '.status.status // .status // "unknown"' 2>/dev/null || echo "unknown")
            PNL=$(echo "$SESSION_STATUS" | jq -r '.status.pnl // 0' 2>/dev/null || echo "0")
            CYCLE=$(echo "$SESSION_STATUS" | jq -r '.status.cycle // 0' 2>/dev/null || echo "0")
            echo "  Session Status: $STATUS | PnL: \$$PNL | Cycle: $CYCLE"
        fi
        
        echo ""
        sleep 5
    done
    
    echo -e "${BLUE}Step 4: Final Status${NC}"
    echo "===================="
    echo ""
    
    # Final position check
    FINAL_POS=$(curl -s -X POST http://localhost:3002/api/positions \
      -H "Content-Type: application/json" \
      -d "{\"private_key\": \"$PRIVATE_KEY\"}")
    
    echo "Final Positions:"
    echo "$FINAL_POS" | jq '.' 2>/dev/null || echo "$FINAL_POS"
    echo ""
    
    # Final session status
    FINAL_SESSION=$(curl -s http://localhost:3001/api/trading/session/$SESSION_ID 2>/dev/null)
    if [ ! -z "$FINAL_SESSION" ]; then
        echo "Session Status:"
        echo "$FINAL_SESSION" | jq '.' 2>/dev/null || echo "$FINAL_SESSION"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Monitoring complete!${NC}"
    echo ""
    echo "To verify on AvantisFi:"
    echo "  1. Go to https://avantisfi.com"
    echo "  2. Connect wallet: $WALLET_ADDRESS"
    echo "  3. Check 'Current Positions' section"
    echo ""
    echo "To continue monitoring:"
    echo "  watch -n 5 'curl -s -X POST http://localhost:3002/api/positions -H \"Content-Type: application/json\" -d \"{\\\"private_key\\\": \\\"$PRIVATE_KEY\\\"}\" | jq'"
    
else
    echo -e "${YELLOW}⚠️  No session ID returned${NC}"
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

