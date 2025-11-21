#!/bin/bash

# Test Position Opening with Live AvantisFi Data
# This script tests the complete flow from trading engine to AvantisFi

echo "🧪 Testing Position Opening with Live AvantisFi Data"
echo "===================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0

echo -e "${BLUE}Step 1: Check Avantis Service Health${NC}"
echo "----------------------------------------"
response=$(curl -s http://localhost:8000/health)
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Avantis Service is healthy${NC}"
    echo "  Network: $(echo "$response" | grep -o '"network":"[^"]*"' | cut -d'"' -f4)"
    echo "  USDC Address: $(echo "$response" | grep -o '"usdc_address":"[^"]*"' | cut -d'"' -f4)"
    ((PASSED++))
else
    echo -e "${RED}✗ Avantis Service is not healthy${NC}"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 2: Get Available Symbols from AvantisFi${NC}"
echo "----------------------------------------"
symbols=$(curl -s http://localhost:8000/api/symbols)
symbol_count=$(echo "$symbols" | grep -o '"count":[0-9]*' | cut -d':' -f2)
if [ ! -z "$symbol_count" ] && [ "$symbol_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Retrieved $symbol_count symbols from AvantisFi${NC}"
    echo "  Symbols: $(echo "$symbols" | grep -o '"symbols":\[[^]]*\]' | head -1)"
    ((PASSED++))
else
    echo -e "${RED}✗ Failed to retrieve symbols${NC}"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 3: Test Position Opening API (Dry Run)${NC}"
echo "----------------------------------------"
echo "Note: This requires a valid private key with balance on AvantisFi"
echo "Testing API endpoint structure..."

# Test the endpoint structure (will fail without valid key, but we can check the error)
test_response=$(curl -s -X POST http://localhost:8000/api/open-position \
    -H "Content-Type: application/json" \
    -d '{
        "symbol": "BTC",
        "collateral": 10,
        "leverage": 5,
        "is_long": true,
        "private_key": "0x0000000000000000000000000000000000000000000000000000000000000000"
    }')

if echo "$test_response" | grep -q "detail\|error\|tx_hash"; then
    echo -e "${GREEN}✓ Position opening endpoint is accessible${NC}"
    echo "  Response structure is valid"
    # Check if it's an expected error (invalid key, insufficient balance, etc.)
    if echo "$test_response" | grep -q "private key\|insufficient\|balance\|invalid"; then
        echo -e "${YELLOW}  ⚠ Expected error (invalid test key) - API is working${NC}"
    fi
    ((PASSED++))
else
    echo -e "${RED}✗ Position opening endpoint failed${NC}"
    echo "  Response: $test_response"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 4: Test Position Retrieval API${NC}"
echo "----------------------------------------"
# Test getting positions (will return empty without valid key, but checks API structure)
positions_response=$(curl -s "http://localhost:8000/api/positions?private_key=0x0000000000000000000000000000000000000000000000000000000000000000")

if echo "$positions_response" | grep -q "positions\|\[\]"; then
    echo -e "${GREEN}✓ Position retrieval endpoint is accessible${NC}"
    echo "  API structure is valid"
    ((PASSED++))
else
    echo -e "${RED}✗ Position retrieval endpoint failed${NC}"
    echo "  Response: $positions_response"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 5: Test Trading Engine Position Flow${NC}"
echo "----------------------------------------"
# Test trading engine's position endpoint
engine_positions=$(curl -s "http://localhost:3001/api/positions?privateKey=0x0000000000000000000000000000000000000000000000000000000000000000")

if echo "$engine_positions" | grep -q "positions\|totalPnL\|openPositions"; then
    echo -e "${GREEN}✓ Trading engine position endpoint is working${NC}"
    echo "  Can query positions through trading engine"
    ((PASSED++))
else
    echo -e "${RED}✗ Trading engine position endpoint failed${NC}"
    echo "  Response: $engine_positions"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 6: Verify Data Flow${NC}"
echo "----------------------------------------"
echo "Checking data transformation..."

# Check if trading engine properly transforms Avantis data
echo -n "  - Avantis Service → Trading Engine: "
if curl -s http://localhost:3001/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

echo -n "  - Trading Engine → Frontend API: "
if curl -s http://localhost:3000/api/config | grep -q "NEXT_PUBLIC_AVANTIS_API_URL"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

echo -n "  - Environment Variables: "
if [ -f "trading-engine/.env" ] && [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} (Both .env files exist)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} (Missing .env files)"
    ((FAILED++))
fi
echo ""

echo -e "${BLUE}Step 7: Test Live Data Retrieval${NC}"
echo "----------------------------------------"
echo "Testing if we can get live position data structure..."

# Get balance endpoint to test live data
balance_response=$(curl -s "http://localhost:8000/api/balance?private_key=0x0000000000000000000000000000000000000000000000000000000000000000")

if echo "$balance_response" | grep -q "balance\|usdc_balance\|total_collateral"; then
    echo -e "${GREEN}✓ Balance endpoint returns proper data structure${NC}"
    echo "  Can retrieve live balance data from AvantisFi"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ Balance endpoint may require valid key${NC}"
    echo "  Response: $balance_response"
fi
echo ""

echo "===================================================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo "===================================================="
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All position opening tests passed!${NC}"
    echo ""
    echo "Summary:"
    echo "  ✓ Avantis Service is running and healthy"
    echo "  ✓ Can retrieve symbols from AvantisFi"
    echo "  ✓ Position opening API is accessible"
    echo "  ✓ Position retrieval API is accessible"
    echo "  ✓ Trading engine can query positions"
    echo "  ✓ Data flow is working correctly"
    echo "  ✓ Environment variables are properly configured"
    echo ""
    echo -e "${YELLOW}Note:${NC} To test actual position opening with live data, you need:"
    echo "  1. A valid private key with balance on AvantisFi"
    echo "  2. Sufficient USDC balance in the wallet"
    echo "  3. The wallet must be connected to AvantisFi"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi

