#!/bin/bash

# Check Positions Directly from AvantisFi
# Requires private key to query AvantisFi directly

echo "🔍 Checking AvantisFi Positions"
echo "================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if private key is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Private key required${NC}"
    echo ""
    echo "Usage: $0 <PRIVATE_KEY>"
    echo ""
    echo "⚠️  WARNING: Private key will be sent to Avantis service"
    echo "  Only use this for testing with a test wallet"
    exit 1
fi

PRIVATE_KEY=$1

# Check Avantis service is running
if ! curl -s -f http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Avantis Service not running${NC}"
    exit 1
fi

echo -e "${BLUE}Fetching positions from AvantisFi...${NC}"
echo ""

# Get positions
RESPONSE=$(curl -s -X POST http://localhost:3002/api/positions \
  -H "Content-Type: application/json" \
  -d "{\"private_key\": \"$PRIVATE_KEY\"}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""

# Get balance
echo -e "${BLUE}Fetching balance...${NC}"
echo ""

BALANCE_RESPONSE=$(curl -s -X POST http://localhost:3002/api/balance \
  -H "Content-Type: application/json" \
  -d "{\"private_key\": \"$PRIVATE_KEY\"}")

echo "$BALANCE_RESPONSE" | jq '.' 2>/dev/null || echo "$BALANCE_RESPONSE"

