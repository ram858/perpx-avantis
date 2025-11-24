#!/bin/bash

# Trading Opening Debug Script
# Follows the TRADING_DEBUG_GUIDE.md to diagnose issues

echo "🔍 Trading Opening Debug Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check Service Health
echo -e "${BLUE}Step 1: Checking Service Health${NC}"
echo "-----------------------------------"

# Check Avantis Service
echo -n "Avantis Service (port 3002): "
if curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    AVANTIS_STATUS=$(curl -s http://localhost:3002/health | jq -r '.status // "unknown"' 2>/dev/null || echo "healthy")
    echo "  Status: $AVANTIS_STATUS"
else
    echo -e "${RED}❌ Not accessible${NC}"
    echo "  Error: Service not running or not accessible"
    echo "  Fix: Start Avantis service: cd avantis-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 3002"
fi

# Check Trading Engine
echo -n "Trading Engine (port 3001): "
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    TRADING_STATUS=$(curl -s http://localhost:3001/api/health | jq -r '.status // "unknown"' 2>/dev/null || echo "healthy")
    echo "  Status: $TRADING_STATUS"
else
    echo -e "${RED}❌ Not accessible${NC}"
    echo "  Error: Service not running or not accessible"
    echo "  Fix: Start Trading Engine: cd trading-engine && npm start"
fi

echo ""

# Step 2: Check Environment Variables
echo -e "${BLUE}Step 2: Checking Environment Variables${NC}"
echo "----------------------------------------"

# Check Trading Engine .env
if [ -f "trading-engine/.env" ]; then
    echo -e "${GREEN}✅ trading-engine/.env exists${NC}"
    
    # Check AVANTIS_API_URL
    AVANTIS_URL=$(grep "^AVANTIS_API_URL=" trading-engine/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$AVANTIS_URL" ]; then
        echo -e "${YELLOW}⚠️  AVANTIS_API_URL not set in trading-engine/.env${NC}"
        echo "  Default will be used: http://localhost:8000 (WRONG - should be 3002)"
    else
        echo "  AVANTIS_API_URL: $AVANTIS_URL"
        if [[ "$AVANTIS_URL" != *"3002"* ]]; then
            echo -e "${YELLOW}⚠️  AVANTIS_API_URL doesn't point to port 3002${NC}"
        fi
    fi
    
    # Check BASE_RPC_URL
    BASE_RPC=$(grep "^BASE_RPC_URL=" trading-engine/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$BASE_RPC" ]; then
        echo -e "${YELLOW}⚠️  BASE_RPC_URL not set in trading-engine/.env${NC}"
    else
        echo "  BASE_RPC_URL: $BASE_RPC"
    fi
else
    echo -e "${RED}❌ trading-engine/.env not found${NC}"
    echo "  Fix: Create trading-engine/.env with required variables"
fi

# Check Avantis Service .env
if [ -f "avantis-service/.env" ]; then
    echo -e "${GREEN}✅ avantis-service/.env exists${NC}"
    
    # Check AVANTIS_RPC_URL
    AVANTIS_RPC=$(grep "^AVANTIS_RPC_URL=" avantis-service/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$AVANTIS_RPC" ]; then
        echo -e "${YELLOW}⚠️  AVANTIS_RPC_URL not set in avantis-service/.env${NC}"
    else
        echo "  AVANTIS_RPC_URL: $AVANTIS_RPC"
    fi
    
    # Check AVANTIS_NETWORK
    AVANTIS_NETWORK=$(grep "^AVANTIS_NETWORK=" avantis-service/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$AVANTIS_NETWORK" ]; then
        echo -e "${YELLOW}⚠️  AVANTIS_NETWORK not set in avantis-service/.env${NC}"
    else
        echo "  AVANTIS_NETWORK: $AVANTIS_NETWORK"
    fi
else
    echo -e "${YELLOW}⚠️  avantis-service/.env not found (may use defaults)${NC}"
fi

echo ""

# Step 3: Test Base RPC Connectivity
echo -e "${BLUE}Step 3: Testing Base RPC Connectivity${NC}"
echo "-------------------------------------"

# Get RPC URL from env or use default
RPC_URL=${BASE_RPC:-"https://mainnet.base.org"}
echo "Testing RPC: $RPC_URL"

RPC_RESPONSE=$(curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  --max-time 5 2>&1)

if echo "$RPC_RESPONSE" | grep -q "result"; then
    echo -e "${GREEN}✅ Base RPC is accessible${NC}"
    BLOCK_NUM=$(echo "$RPC_RESPONSE" | jq -r '.result' 2>/dev/null | xargs printf "%d\n" 2>/dev/null)
    if [ ! -z "$BLOCK_NUM" ]; then
        echo "  Latest block: $BLOCK_NUM"
    fi
else
    echo -e "${RED}❌ Base RPC is not accessible${NC}"
    echo "  Response: ${RPC_RESPONSE:0:100}"
    echo "  Fix: Check RPC URL or use a different provider (Alchemy, Infura)"
fi

echo ""

# Step 4: Check Port Availability
echo -e "${BLUE}Step 4: Checking Port Availability${NC}"
echo "----------------------------------"

check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $1 is in use${NC}"
        PID=$(lsof -Pi :$1 -sTCP:LISTEN -t | head -n1)
        PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        echo "  Process: $PROCESS (PID: $PID)"
        return 0
    else
        echo -e "${RED}❌ Port $1 is not in use${NC}"
        return 1
    fi
}

check_port 3002  # Avantis Service
check_port 3001  # Trading Engine
check_port 3000  # Frontend

echo ""

# Step 5: Check Symbol Registry
echo -e "${BLUE}Step 5: Checking Available Symbols${NC}"
echo "----------------------------------"

if curl -s -f http://localhost:3002/api/symbols > /dev/null 2>&1; then
    SYMBOLS=$(curl -s http://localhost:3002/api/symbols | jq -r '.[] | .symbol' 2>/dev/null | head -5)
    if [ ! -z "$SYMBOLS" ]; then
        echo -e "${GREEN}✅ Symbols available:${NC}"
        echo "$SYMBOLS" | while read symbol; do
            echo "  - $symbol"
        done
    else
        echo -e "${YELLOW}⚠️  No symbols returned${NC}"
    fi
else
    echo -e "${RED}❌ Cannot fetch symbols (Avantis service not accessible)${NC}"
fi

echo ""

# Step 6: Summary and Recommendations
echo -e "${BLUE}Step 6: Summary and Recommendations${NC}"
echo "--------------------------------------"

ISSUES=0

# Check if services are running
if ! curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Issue: Avantis Service not running${NC}"
    echo "  Fix: cd avantis-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 3002"
    ((ISSUES++))
fi

if ! curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Issue: Trading Engine not running${NC}"
    echo "  Fix: cd trading-engine && npm start"
    ((ISSUES++))
fi

# Check AVANTIS_API_URL configuration
if [ -f "trading-engine/.env" ]; then
    AVANTIS_URL=$(grep "^AVANTIS_API_URL=" trading-engine/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [[ "$AVANTIS_URL" != *"3002"* ]] && [ ! -z "$AVANTIS_URL" ]; then
        echo -e "${YELLOW}⚠️  Issue: AVANTIS_API_URL may be incorrect${NC}"
        echo "  Current: $AVANTIS_URL"
        echo "  Should be: http://localhost:3002"
        echo "  Fix: Update trading-engine/.env with: AVANTIS_API_URL=http://localhost:3002"
        ((ISSUES++))
    elif [ -z "$AVANTIS_URL" ]; then
        echo -e "${YELLOW}⚠️  Issue: AVANTIS_API_URL not set${NC}"
        echo "  Fix: Add to trading-engine/.env: AVANTIS_API_URL=http://localhost:3002"
        ((ISSUES++))
    fi
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ No critical issues found!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test balance check: curl -X POST http://localhost:3002/api/balance -H 'Content-Type: application/json' -d '{\"private_key\":\"YOUR_KEY\"}'"
    echo "  2. Test position opening: curl -X POST http://localhost:3002/api/open-position -H 'Content-Type: application/json' -d '{\"symbol\":\"BTC/USD\",\"collateral\":11.0,\"leverage\":5,\"is_long\":true,\"private_key\":\"YOUR_KEY\"}'"
else
    echo -e "${YELLOW}⚠️  Found $ISSUES issue(s) that need to be fixed${NC}"
fi

echo ""
echo "For detailed debugging, see: TRADING_DEBUG_GUIDE.md"

