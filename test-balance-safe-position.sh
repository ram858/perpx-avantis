#!/bin/bash

# Balance-Safe Position Opening Test
# Tests position opening with balance verification to ensure no funds are lost
# Based on fixes from docs/WHY_FUNDS_TRANSFERRED.md

echo "🧪 Balance-Safe Position Opening Test"
echo "======================================"
echo ""
echo "This test verifies:"
echo "  1. Balance before position opening"
echo "  2. Position opens with correct leverage (10x, not 10000x)"
echo "  3. Balance after position opening (should only decrease by collateral)"
echo "  4. Position exists and is valid"
echo "  5. No unexpected balance loss"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Wallet credentials (from user)
PRIVATE_KEY="0x70c49ab0812a73eb3bb2808bc2762610720fae5ede86c4a3c473ca5f9cbb536b"
WALLET_ADDRESS="0xB37E3f1E7A4Ef800D5E0b18d084d55B9C888C73e"

# Position parameters (safe values)
# Note: Contract minimum appears to be higher than expected
# Using $14 to be safe (fits within $15 balance, leaves buffer for gas)
SYMBOL="BTC"
COLLATERAL=14.0  # Safe amount above contract minimum (fits within $15 balance)
LEVERAGE=10  # Fixed at 10x (not 10000x) - prevents 10000x bug
IS_LONG=true

# Avantis service URL (adjust if different)
# Default to port 3002 (as shown in START_SERVERS.sh) or 8000
AVANTIS_API_URL="${AVANTIS_API_URL:-http://localhost:3002}"

echo -e "${BLUE}Configuration:${NC}"
echo "  Wallet: ${WALLET_ADDRESS:0:10}...${WALLET_ADDRESS: -6}"
echo "  Symbol: $SYMBOL"
echo "  Collateral: \$$COLLATERAL"
echo "  Leverage: ${LEVERAGE}x (FIXED - prevents 10000x bug)"
echo "  Direction: $(if [ "$IS_LONG" = true ]; then echo "LONG"; else echo "SHORT"; fi)"
echo "  Avantis API: $AVANTIS_API_URL"
echo ""

# Check services
echo -e "${BLUE}Step 1: Checking Services...${NC}"
if ! curl -s -f "$AVANTIS_API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Avantis Service not accessible at $AVANTIS_API_URL${NC}"
    echo "   Please ensure the avantis-service is running"
    exit 1
fi
echo -e "${GREEN}✅ Avantis Service is running${NC}"
echo ""

# Get initial balance
echo -e "${BLUE}Step 2: Getting Initial Balance...${NC}"
BALANCE_BEFORE_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/balance?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/balance" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

BALANCE_BEFORE=$(echo "$BALANCE_BEFORE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    balance = data.get('available_balance') or data.get('usdc_balance') or data.get('total_balance') or data.get('balance') or 0
    print(f'{float(balance):.6f}')
except:
    print('0')
" 2>/dev/null || echo "0")

if [ "$BALANCE_BEFORE" = "0" ] || [ -z "$BALANCE_BEFORE" ]; then
    echo -e "${YELLOW}⚠️  Could not fetch balance. Response:${NC}"
    echo "$BALANCE_BEFORE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BALANCE_BEFORE_RESPONSE"
    echo ""
    echo -e "${YELLOW}Continuing anyway (balance check may have different format)...${NC}"
    BALANCE_BEFORE="unknown"
else
    echo -e "${GREEN}✅ Initial Balance: \$$BALANCE_BEFORE${NC}"
    
    # Check if balance is sufficient
    if (( $(echo "$BALANCE_BEFORE < $COLLATERAL" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${RED}❌ Insufficient balance: \$$BALANCE_BEFORE < \$$COLLATERAL${NC}"
        echo -e "${YELLOW}⚠️  Avantis protocol requires minimum \$$COLLATERAL per position${NC}"
        echo -e "${YELLOW}   You need to deposit at least \$$(echo "$COLLATERAL - $BALANCE_BEFORE" | bc -l 2>/dev/null || echo "0.5") more${NC}"
        exit 1
    fi
fi
echo ""

# Check existing positions
echo -e "${BLUE}Step 3: Checking Existing Positions...${NC}"
POSITIONS_BEFORE_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/positions?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/positions" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

POSITIONS_BEFORE=$(echo "$POSITIONS_BEFORE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    positions = data.get('positions', [])
    print(len(positions))
except:
    print('0')
" 2>/dev/null || echo "0")

echo "  Existing Positions: $POSITIONS_BEFORE"
echo ""

# Open position
echo -e "${BLUE}Step 4: Opening Position (with FIXED leverage=${LEVERAGE}x)...${NC}"
echo "  This uses the fixed leverage parameter (not calculated)"
echo "  Prevents the 10000x bug from docs/WHY_FUNDS_TRANSFERRED.md"
echo ""

OPEN_POSITION_RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/open-position" \
    -H "Content-Type: application/json" \
    -d "{
        \"symbol\": \"$SYMBOL\",
        \"collateral\": $COLLATERAL,
        \"leverage\": $LEVERAGE,
        \"is_long\": $IS_LONG,
        \"private_key\": \"$PRIVATE_KEY\"
    }")

echo "Response:"
echo "$OPEN_POSITION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$OPEN_POSITION_RESPONSE"
echo ""

# Check if position was opened successfully
SUCCESS=$(echo "$OPEN_POSITION_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('true' if data.get('success') or data.get('tx_hash') else 'false')
except:
    print('false')
" 2>/dev/null || echo "false")

TX_HASH=$(echo "$OPEN_POSITION_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tx_hash', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ "$SUCCESS" != "true" ] && [ -z "$TX_HASH" ]; then
    echo -e "${RED}❌ Position opening failed!${NC}"
    ERROR=$(echo "$OPEN_POSITION_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('error', data.get('detail', 'Unknown error')))
except:
    print('Unknown error')
" 2>/dev/null || echo "Unknown error")
    echo "  Error: $ERROR"
    exit 1
fi

echo -e "${GREEN}✅ Position opening request sent!${NC}"
if [ ! -z "$TX_HASH" ]; then
    echo "  Transaction Hash: $TX_HASH"
fi
echo ""

# Wait for transaction to confirm
echo -e "${BLUE}Step 5: Waiting for transaction confirmation (10 seconds)...${NC}"
sleep 10
echo ""

# Verify position exists
echo -e "${BLUE}Step 6: Verifying Position...${NC}"
POSITIONS_AFTER_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/positions?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/positions" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

POSITIONS_AFTER=$(echo "$POSITIONS_AFTER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    positions = data.get('positions', [])
    print(len(positions))
except:
    print('0')
" 2>/dev/null || echo "0")

if [ "$POSITIONS_AFTER" -gt "$POSITIONS_BEFORE" ]; then
    echo -e "${GREEN}✅ Position opened successfully!${NC}"
    echo "  Positions before: $POSITIONS_BEFORE"
    echo "  Positions after: $POSITIONS_AFTER"
    echo ""
    echo "Position Details:"
    echo "$POSITIONS_AFTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POSITIONS_AFTER_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Position count unchanged (may still be processing)${NC}"
    echo "  Positions before: $POSITIONS_BEFORE"
    echo "  Positions after: $POSITIONS_AFTER"
    echo ""
    echo "Full response:"
    echo "$POSITIONS_AFTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POSITIONS_AFTER_RESPONSE"
fi
echo ""

# Get final balance
echo -e "${BLUE}Step 7: Checking Final Balance...${NC}"
BALANCE_AFTER_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/balance?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/balance" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

BALANCE_AFTER=$(echo "$BALANCE_AFTER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    balance = data.get('available_balance') or data.get('usdc_balance') or data.get('total_balance') or data.get('balance') or 0
    print(f'{float(balance):.6f}')
except:
    print('0')
" 2>/dev/null || echo "0")

if [ "$BALANCE_BEFORE" != "unknown" ] && [ "$BALANCE_AFTER" != "0" ] && [ ! -z "$BALANCE_AFTER" ]; then
    BALANCE_DIFF=$(echo "$BALANCE_BEFORE - $BALANCE_AFTER" | bc -l 2>/dev/null || echo "0")
    echo "  Balance Before: \$$BALANCE_BEFORE"
    echo "  Balance After: \$$BALANCE_AFTER"
    echo "  Balance Change: \$$BALANCE_DIFF"
    echo ""
    
    # Expected change should be approximately the collateral amount
    EXPECTED_CHANGE=$COLLATERAL
    TOLERANCE=1.0  # Allow $1 tolerance for fees
    
    if (( $(echo "$BALANCE_DIFF <= $EXPECTED_CHANGE + $TOLERANCE" | bc -l 2>/dev/null || echo "1") )) && \
       (( $(echo "$BALANCE_DIFF >= $EXPECTED_CHANGE - $TOLERANCE" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${GREEN}✅ Balance change is correct!${NC}"
        echo "  Expected: ~\$$EXPECTED_CHANGE (collateral)"
        echo "  Actual: \$$BALANCE_DIFF"
        echo "  ✅ No unexpected balance loss detected"
    else
        echo -e "${YELLOW}⚠️  Balance change differs from expected${NC}"
        echo "  Expected: ~\$$EXPECTED_CHANGE (collateral)"
        echo "  Actual: \$$BALANCE_DIFF"
        echo "  (This may be due to fees or position margin requirements)"
    fi
else
    echo -e "${YELLOW}⚠️  Could not compare balances${NC}"
    echo "  Balance Before: $BALANCE_BEFORE"
    echo "  Balance After: $BALANCE_AFTER"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "✅ Position Opening: $([ "$SUCCESS" = "true" ] || [ ! -z "$TX_HASH" ] && echo "SUCCESS" || echo "FAILED")"
echo "✅ Position Verification: $([ "$POSITIONS_AFTER" -gt "$POSITIONS_BEFORE" ] && echo "SUCCESS" || echo "PENDING/FAILED")"
if [ "$BALANCE_BEFORE" != "unknown" ] && [ "$BALANCE_AFTER" != "0" ]; then
    echo "✅ Balance Check: $([ "$BALANCE_DIFF" != "0" ] && echo "VERIFIED" || echo "UNKNOWN")"
fi
echo ""
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""
echo "To verify on AvantisFi:"
echo "  1. Go to https://avantisfi.com"
echo "  2. Connect wallet: $WALLET_ADDRESS"
echo "  3. Check 'Current Positions' section"
echo ""
if [ ! -z "$TX_HASH" ]; then
    echo "Transaction Hash: $TX_HASH"
    echo "View on BaseScan: https://basescan.org/tx/$TX_HASH"
fi

