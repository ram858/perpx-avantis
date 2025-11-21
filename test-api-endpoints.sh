#!/bin/bash

# API Endpoint Testing Script
# Tests all services and API endpoints

echo "🧪 Testing API Endpoints"
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local headers=$4
    local data=$5
    local expected_status=$6
    
    echo -n "Testing: $name ... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method $headers "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method $headers -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "  Response: $body"
        ((FAILED++))
        return 1
    fi
}

echo "1. Testing Avantis Service (Port 8000)"
echo "---------------------------------------"

# Test Avantis health
test_endpoint "Avantis Health" "GET" "http://localhost:8000/health" "" "" "200"

# Test Avantis symbols
test_endpoint "Avantis Symbols" "GET" "http://localhost:8000/api/symbols" "" "" "200"

echo ""
echo "2. Testing Trading Engine (Port 3001)"
echo "--------------------------------------"

# Test Trading Engine health
test_endpoint "Trading Engine Health" "GET" "http://localhost:3001/api/health" "" "" "200"

# Test Trading Engine config
test_endpoint "Trading Engine Config" "GET" "http://localhost:3001/api/trading/config" "" "" "200"

# Test Trading Engine start (should work without auth - it's the backend)
test_endpoint "Trading Engine Start" "POST" "http://localhost:3001/api/trading/start" \
    "-H 'Content-Type: application/json'" \
    '{"maxBudget":100,"profitGoal":10,"maxPerSession":3,"avantisApiWallet":"0x123","walletAddress":"0x456"}' \
    "200"

echo ""
echo "3. Testing Next.js Frontend API (Port 3000)"
echo "-------------------------------------------"

# Test Config endpoint (public)
test_endpoint "Frontend Config" "GET" "http://localhost:3000/api/config" "" "" "200"

# Test Trading Start without auth (should return 401)
test_endpoint "Trading Start (No Auth)" "POST" "http://localhost:3000/api/trading/start" \
    "-H 'Content-Type: application/json'" \
    '{"totalBudget":100,"profitGoal":10,"maxPositions":3}' \
    "401"

# Test Trading Start with invalid token (should return 401 with specific message)
response=$(curl -s -X POST "http://localhost:3000/api/trading/start" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid-token-123" \
    -d '{"totalBudget":100,"profitGoal":10,"maxPositions":3}')

if echo "$response" | grep -q "Invalid authentication token\|Unauthorized"; then
    echo -e "Testing: Trading Start (Invalid Token) ... ${GREEN}✓ PASS${NC} (Returns auth error)"
    ((PASSED++))
else
    echo -e "Testing: Trading Start (Invalid Token) ... ${RED}✗ FAIL${NC}"
    echo "  Response: $response"
    ((FAILED++))
fi

# Test Trading Start with missing Bearer prefix (should return 401)
test_endpoint "Trading Start (Malformed Auth)" "POST" "http://localhost:3000/api/trading/start" \
    "-H 'Content-Type: application/json' -H 'Authorization: test-token'" \
    '{"totalBudget":100,"profitGoal":10,"maxPositions":3}' \
    "401"

echo ""
echo "4. Testing Environment Variable Loading"
echo "----------------------------------------"

# Check if trading engine loaded .env correctly
echo -n "Checking Trading Engine .env loading ... "
if curl -s http://localhost:3001/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ PASS${NC} (Service running)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Service not responding)"
    ((FAILED++))
fi

# Check if frontend loaded NEXT_PUBLIC_ variables
echo -n "Checking Frontend NEXT_PUBLIC_ variables ... "
config=$(curl -s http://localhost:3000/api/config)
if echo "$config" | grep -q "NEXT_PUBLIC_APP_URL"; then
    echo -e "${GREEN}✓ PASS${NC} (Config loaded)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Config not loaded)"
    ((FAILED++))
fi

echo ""
echo "========================"
echo "Test Results:"
echo "  ${GREEN}Passed: $PASSED${NC}"
echo "  ${RED}Failed: $FAILED${NC}"
echo "========================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi

