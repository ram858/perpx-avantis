#!/bin/bash

# Force Open Position Test - Bypasses signal evaluation
# This tests if the position opening mechanism works end-to-end

echo "🧪 Force Position Open Test"
echo "============================"
echo ""

PRIVATE_KEY="0x506123a108b7abd21a6130a7bf27904039fe2c9f9dcb83a4c40daa22c032564f"
WALLET_ADDRESS="0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4"

echo "Testing with:"
echo "  Symbol: BTC"
echo "  Collateral: \$15"
echo "  Leverage: 10x"
echo "  Direction: LONG"
echo ""

echo "Step 1: Checking balance..."
BALANCE=$(curl -s "http://localhost:3002/api/balance?private_key=$PRIVATE_KEY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('usdc_balance', 0))" 2>/dev/null)
echo "  Balance: \$$BALANCE"
echo ""

echo "Step 2: Attempting to open position..."
RESPONSE=$(curl -s -X POST http://localhost:3002/api/open-position \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"BTC\",
    \"collateral\": 12,
    \"leverage\": 10,
    \"is_long\": true,
    \"private_key\": \"$PRIVATE_KEY\"
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "Step 3: Checking positions..."
sleep 3
POSITIONS=$(curl -s "http://localhost:3002/api/positions?private_key=$PRIVATE_KEY" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('positions', [])))" 2>/dev/null)
echo "  Open Positions: $POSITIONS"
echo ""

if [ "$POSITIONS" != "0" ] && [ "$POSITIONS" != "" ]; then
    echo "✅ SUCCESS! Position opened!"
    curl -s "http://localhost:3002/api/positions?private_key=$PRIVATE_KEY" | python3 -m json.tool 2>/dev/null
else
    echo "❌ No positions opened. Check error above."
fi

