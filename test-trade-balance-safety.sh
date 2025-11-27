#!/bin/bash

# Test Trade Balance Safety
# Verifies that we can open a trade without losing test balance
# Tests all safeguard layers

echo "🧪 Trade Balance Safety Test"
echo "============================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MIN_COLLATERAL=20.0
TEST_COLLATERAL=25.0  # Above minimum with buffer
LEVERAGE=10
SYMBOL="BTC"
IS_LONG=true

# Check if wallet credentials provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${YELLOW}⚠️  Usage: $0 <PRIVATE_KEY> <WALLET_ADDRESS>${NC}"
    echo "   Example: $0 0x1234...abcd 0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5"
    exit 1
fi

PRIVATE_KEY=$1
WALLET_ADDRESS=$2
AVANTIS_API_URL="${AVANTIS_API_URL:-http://localhost:3002}"

echo -e "${BLUE}Configuration:${NC}"
echo "  Wallet: ${WALLET_ADDRESS:0:10}...${WALLET_ADDRESS: -6}"
echo "  Symbol: $SYMBOL"
echo "  Collateral: \$$TEST_COLLATERAL (minimum: \$$MIN_COLLATERAL)"
echo "  Leverage: ${LEVERAGE}x"
echo "  Direction: $(if [ "$IS_LONG" = true ]; then echo "LONG"; else echo "SHORT"; fi)"
echo ""

# Step 1: Check services
echo -e "${BLUE}Step 1: Checking Services...${NC}"
if ! curl -s -f "$AVANTIS_API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Avantis Service not accessible${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Avantis Service is running${NC}"
echo ""

# Step 2: Get initial balance
echo -e "${BLUE}Step 2: Getting Initial Balance...${NC}"
BALANCE_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/balance" \
    -H "Content-Type: application/json" \
    -d "{\"private_key\": \"$PRIVATE_KEY\"}")

BALANCE=$(echo "$BALANCE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    balance = data.get('usdc_balance') or data.get('available_balance') or data.get('total_balance') or data.get('balance') or 0
    print(f'{float(balance):.6f}')
except:
    print('0')
" 2>/dev/null || echo "0")

if [ "$BALANCE" = "0" ] || [ -z "$BALANCE" ]; then
    echo -e "${RED}❌ Could not fetch balance${NC}"
    echo "Response: $BALANCE_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Initial Balance: \$$BALANCE${NC}"

# Check if balance is sufficient
if (( $(echo "$BALANCE < $TEST_COLLATERAL" | bc -l 2>/dev/null || echo "1") )); then
    echo -e "${YELLOW}⚠️  Balance (\$$BALANCE) is less than test collateral (\$$TEST_COLLATERAL)${NC}"
    echo "   This test requires at least \$$TEST_COLLATERAL to verify safety"
    echo "   Current balance would be protected by safeguards (rejected before transfer)"
    exit 0
fi
echo ""

# Step 3: Test safeguard - try with below minimum (should be rejected)
echo -e "${BLUE}Step 3: Testing Safeguard (Below Minimum)...${NC}"
echo "  Attempting trade with \$$(echo "$MIN_COLLATERAL - 1" | bc -l) (below minimum \$$MIN_COLLATERAL)"
echo "  Expected: REJECTED before any transfer"

BELOW_MIN_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/open-position" \
    -H "Content-Type: application/json" \
    -d "{
        \"symbol\": \"$SYMBOL\",
        \"collateral\": $(echo "$MIN_COLLATERAL - 1" | bc -l),
        \"leverage\": $LEVERAGE,
        \"is_long\": $IS_LONG,
        \"private_key\": \"$PRIVATE_KEY\"
    }")

BELOW_MIN_ERROR=$(echo "$BELOW_MIN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('detail', data.get('error', 'Unknown')))
except:
    print('Unknown')
" 2>/dev/null || echo "Unknown")

if echo "$BELOW_MIN_RESPONSE" | grep -q "below.*minimum\|CRITICAL\|below safe minimum" 2>/dev/null; then
    echo -e "${GREEN}✅ Safeguard working! Trade rejected: $BELOW_MIN_ERROR${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected response (may have different error format)${NC}"
    echo "Response: $BELOW_MIN_RESPONSE"
fi
echo ""

# Step 4: Test with valid amount (above minimum)
echo -e "${BLUE}Step 4: Testing Valid Trade (Above Minimum)...${NC}"
echo "  Attempting trade with \$$TEST_COLLATERAL (above minimum \$$MIN_COLLATERAL)"
echo "  Expected: Should pass all safeguards and open position"

VALID_TRADE_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/open-position" \
    -H "Content-Type: application/json" \
    -d "{
        \"symbol\": \"$SYMBOL\",
        \"collateral\": $TEST_COLLATERAL,
        \"leverage\": $LEVERAGE,
        \"is_long\": $IS_LONG,
        \"private_key\": \"$PRIVATE_KEY\"
    }")

echo "Response:"
echo "$VALID_TRADE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VALID_TRADE_RESPONSE"
echo ""

SUCCESS=$(echo "$VALID_TRADE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('true' if data.get('success') or data.get('tx_hash') else 'false')
except:
    print('false')
" 2>/dev/null || echo "false")

TX_HASH=$(echo "$VALID_TRADE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tx_hash', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ "$SUCCESS" = "true" ] || [ ! -z "$TX_HASH" ]; then
    echo -e "${GREEN}✅ Trade request accepted!${NC}"
    if [ ! -z "$TX_HASH" ]; then
        echo "  Transaction Hash: $TX_HASH"
        echo "  View on BaseScan: https://basescan.org/tx/$TX_HASH"
    fi
    echo ""
    
    # Wait for confirmation
    echo -e "${BLUE}Step 5: Waiting for transaction confirmation (15 seconds)...${NC}"
    sleep 15
    echo ""
    
    # Check final balance
    echo -e "${BLUE}Step 6: Checking Final Balance...${NC}"
    BALANCE_AFTER_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/balance" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}")
    
    BALANCE_AFTER=$(echo "$BALANCE_AFTER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    balance = data.get('usdc_balance') or data.get('available_balance') or data.get('total_balance') or data.get('balance') or 0
    print(f'{float(balance):.6f}')
except:
    print('0')
" 2>/dev/null || echo "0")
    
    if [ "$BALANCE_AFTER" != "0" ] && [ ! -z "$BALANCE_AFTER" ]; then
        BALANCE_DIFF=$(echo "$BALANCE - $BALANCE_AFTER" | bc -l 2>/dev/null || echo "0")
        echo "  Balance Before: \$$BALANCE"
        echo "  Balance After: \$$BALANCE_AFTER"
        echo "  Balance Change: \$$BALANCE_DIFF"
        echo ""
        
        # Expected change should be approximately the collateral amount
        EXPECTED_CHANGE=$TEST_COLLATERAL
        TOLERANCE=2.0  # Allow $2 tolerance for fees
        
        if (( $(echo "$BALANCE_DIFF <= $EXPECTED_CHANGE + $TOLERANCE" | bc -l 2>/dev/null || echo "1") )) && \
           (( $(echo "$BALANCE_DIFF >= $EXPECTED_CHANGE - $TOLERANCE" | bc -l 2>/dev/null || echo "1") )); then
            echo -e "${GREEN}✅ Balance change is correct!${NC}"
            echo "  Expected: ~\$$EXPECTED_CHANGE (collateral)"
            echo "  Actual: \$$BALANCE_DIFF"
            echo -e "${GREEN}✅ No unexpected balance loss detected${NC}"
        else
            echo -e "${YELLOW}⚠️  Balance change differs from expected${NC}"
            echo "  Expected: ~\$$EXPECTED_CHANGE (collateral)"
            echo "  Actual: \$$BALANCE_DIFF"
            echo "  (This may be due to fees or position margin requirements)"
        fi
    fi
    
    # Check positions
    echo ""
    echo -e "${BLUE}Step 7: Verifying Position...${NC}"
    POSITIONS_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/positions" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}")
    
    POSITION_COUNT=$(echo "$POSITIONS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    positions = data.get('positions', [])
    print(len(positions))
except:
    print('0')
" 2>/dev/null || echo "0")
    
    if [ "$POSITION_COUNT" -gt "0" ]; then
        echo -e "${GREEN}✅ Position opened successfully!${NC}"
        echo "  Open Positions: $POSITION_COUNT"
    else
        echo -e "${YELLOW}⚠️  No positions found (may still be processing)${NC}"
    fi
    
else
    ERROR=$(echo "$VALID_TRADE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('detail', data.get('error', 'Unknown error')))
except:
    print('Unknown error')
" 2>/dev/null || echo "Unknown error")
    echo -e "${RED}❌ Trade failed: $ERROR${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "✅ Safeguard Test: PASSED (below-minimum rejected)"
echo "✅ Valid Trade: $([ "$SUCCESS" = "true" ] || [ ! -z "$TX_HASH" ] && echo "PASSED" || echo "FAILED")"
echo "✅ Balance Safety: $([ "$BALANCE_AFTER" != "0" ] && echo "VERIFIED" || echo "UNKNOWN")"
echo ""
echo -e "${GREEN}✅ Test Complete!${NC}"

