#!/bin/bash

# Force Open Position Test - Bypasses signal evaluation
# This tests if the position opening mechanism works end-to-end

echo "🧪 Force Position Open Test"
echo "============================"
echo ""

PRIVATE_KEY="0x70c49ab0812a73eb3bb2808bc2762610720fae5ede86c4a3c473ca5f9cbb536b"
WALLET_ADDRESS="0xB37E3f1E7A4Ef800D5E0b18d084d55B9C888C73e"

echo "Testing with:"
echo "  Symbol: BTC"
echo "  Collateral: \$15"
echo "  Leverage: 10x"
echo "  Direction: LONG"
echo ""

# Avantis API URL (adjust if different)
AVANTIS_API_URL="${AVANTIS_API_URL:-http://localhost:8000}"

echo "Step 1: Checking balance..."
BALANCE_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/balance?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/balance" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

BALANCE=$(echo "$BALANCE_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('available_balance') or d.get('usdc_balance') or d.get('total_balance') or 0)" 2>/dev/null || echo "0")
echo "  Balance: \$$BALANCE"
echo ""

echo "Step 2: Attempting to open position..."
echo "  Using FIXED leverage=10x (prevents 10000x bug from docs/WHY_FUNDS_TRANSFERRED.md)"
RESPONSE=$(curl -s -X POST "$AVANTIS_API_URL/api/open-position" \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"BTC\",
    \"collateral\": 15,
    \"leverage\": 10,
    \"is_long\": true,
    \"private_key\": \"$PRIVATE_KEY\"
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "Step 3: Checking positions..."
sleep 5
POSITIONS_RESPONSE=$(curl -s "$AVANTIS_API_URL/api/positions?private_key=$(echo "$PRIVATE_KEY" | sed 's/0x//')" 2>/dev/null || \
    curl -s -X POST "$AVANTIS_API_URL/api/positions" \
        -H "Content-Type: application/json" \
        -d "{\"private_key\": \"$PRIVATE_KEY\"}" 2>/dev/null)

POSITIONS=$(echo "$POSITIONS_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('positions', [])))" 2>/dev/null || echo "0")
echo "  Open Positions: $POSITIONS"
echo ""

if [ "$POSITIONS" != "0" ] && [ "$POSITIONS" != "" ]; then
    echo "✅ SUCCESS! Position opened!"
    echo "$POSITIONS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POSITIONS_RESPONSE"
else
    echo "❌ No positions opened. Check error above."
    echo "Full positions response:"
    echo "$POSITIONS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POSITIONS_RESPONSE"
fi

