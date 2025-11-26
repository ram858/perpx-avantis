#!/bin/bash

# Fix Trading Opening Issues Script
# Automatically fixes common issues found by debug-trading.sh

echo "🔧 Fixing Trading Opening Issues"
echo "================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Ensure Trading Engine .env has correct AVANTIS_API_URL
echo -e "${BLUE}Step 1: Fixing Trading Engine Configuration${NC}"

if [ -f "trading-engine/.env" ]; then
    # Check if AVANTIS_API_URL is set correctly
    if ! grep -q "^AVANTIS_API_URL=http://localhost:3002" trading-engine/.env; then
        # Remove old AVANTIS_API_URL if exists
        sed -i.bak '/^AVANTIS_API_URL=/d' trading-engine/.env
        
        # Add correct AVANTIS_API_URL
        echo "AVANTIS_API_URL=http://localhost:3002" >> trading-engine/.env
        echo -e "${GREEN}✅ Fixed AVANTIS_API_URL in trading-engine/.env${NC}"
    else
        echo -e "${GREEN}✅ AVANTIS_API_URL is already correct${NC}"
    fi
    
    # Ensure BASE_RPC_URL is set
    if ! grep -q "^BASE_RPC_URL=" trading-engine/.env; then
        echo "BASE_RPC_URL=https://mainnet.base.org" >> trading-engine/.env
        echo -e "${GREEN}✅ Added BASE_RPC_URL to trading-engine/.env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  trading-engine/.env not found, creating it...${NC}"
    cat > trading-engine/.env << EOF
AVANTIS_API_URL=http://localhost:3002
BASE_RPC_URL=https://mainnet.base.org
AVANTIS_NETWORK=base-mainnet
API_PORT=3001
NODE_ENV=production
EOF
    echo -e "${GREEN}✅ Created trading-engine/.env${NC}"
fi

echo ""

# Step 2: Ensure Avantis Service .env has correct configuration
echo -e "${BLUE}Step 2: Fixing Avantis Service Configuration${NC}"

if [ -f "avantis-service/.env" ]; then
    # Ensure AVANTIS_NETWORK is set
    if ! grep -q "^AVANTIS_NETWORK=" avantis-service/.env; then
        echo "AVANTIS_NETWORK=base-mainnet" >> avantis-service/.env
        echo -e "${GREEN}✅ Added AVANTIS_NETWORK to avantis-service/.env${NC}"
    fi
    
    # Ensure PORT is set
    if ! grep -q "^PORT=" avantis-service/.env; then
        echo "PORT=3002" >> avantis-service/.env
        echo -e "${GREEN}✅ Added PORT to avantis-service/.env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  avantis-service/.env not found, creating basic config...${NC}"
    cat > avantis-service/.env << EOF
HOST=0.0.0.0
PORT=3002
DEBUG=false
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
EOF
    echo -e "${GREEN}✅ Created avantis-service/.env${NC}"
fi

echo ""

# Step 3: Start services if not running
echo -e "${BLUE}Step 3: Starting Services${NC}"

# Check and start Avantis Service
if ! curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Avantis Service...${NC}"
    cd avantis-service
    python3 -m uvicorn main:app --host 0.0.0.0 --port 3002 > /tmp/avantis-service.log 2>&1 &
    AVANTIS_PID=$!
    echo -e "${GREEN}✅ Avantis Service started (PID: $AVANTIS_PID)${NC}"
    sleep 3
    cd ..
else
    echo -e "${GREEN}✅ Avantis Service is already running${NC}"
fi

# Check and start Trading Engine
if ! curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Trading Engine...${NC}"
    cd trading-engine
    npm start > /tmp/trading-engine.log 2>&1 &
    TRADING_PID=$!
    echo -e "${GREEN}✅ Trading Engine started (PID: $TRADING_PID)${NC}"
    sleep 5
    cd ..
else
    echo -e "${GREEN}✅ Trading Engine is already running${NC}"
fi

echo ""

# Step 4: Verify services are accessible
echo -e "${BLUE}Step 4: Verifying Services${NC}"

# Wait a bit for services to fully start
sleep 2

# Check Avantis Service
if curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Avantis Service is accessible${NC}"
else
    echo -e "${RED}❌ Avantis Service is not accessible${NC}"
    echo "  Check logs: tail -f /tmp/avantis-service.log"
fi

# Check Trading Engine
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Trading Engine is accessible${NC}"
else
    echo -e "${RED}❌ Trading Engine is not accessible${NC}"
    echo "  Check logs: tail -f /tmp/trading-engine.log"
fi

echo ""

# Step 5: Test API endpoints
echo -e "${BLUE}Step 5: Testing API Endpoints${NC}"

# Test symbols endpoint
SYMBOLS=$(curl -s http://localhost:3002/api/symbols 2>/dev/null)
if [ ! -z "$SYMBOLS" ]; then
    SYMBOL_COUNT=$(echo "$SYMBOLS" | jq -r '.count // . | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Symbols endpoint working (${SYMBOL_COUNT} symbols)${NC}"
else
    echo -e "${YELLOW}⚠️  Symbols endpoint returned empty${NC}"
fi

echo ""
echo -e "${GREEN}✅ Fix script completed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify services: ./debug-trading.sh"
echo "  2. Test balance: curl -X POST http://localhost:3002/api/balance -H 'Content-Type: application/json' -d '{\"private_key\":\"YOUR_KEY\"}'"
echo "  3. Test position opening: See docs/TRADING_DEBUG_GUIDE.md"
echo ""
echo "Service URLs:"
echo "  - Avantis Service: http://localhost:3002/health"
echo "  - Trading Engine:  http://localhost:3001/api/health"
echo ""
echo "Logs:"
echo "  - Avantis: tail -f /tmp/avantis-service.log"
echo "  - Trading: tail -f /tmp/trading-engine.log"

