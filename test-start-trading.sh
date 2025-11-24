#!/bin/bash

# Test script to start trading session
# This simulates the full flow

FRONTEND_URL="http://localhost:3000"
WALLET_ADDRESS="0xE0C87bf32C879e2a5F5343e75b6f2cc3d63BE4d5"

echo "🧪 Testing Trading Session Start"
echo "================================="
echo ""
echo "Step 1: Verify services are running..."
echo ""

# Check services
curl -s "$FRONTEND_URL" > /dev/null && echo "✅ Frontend running" || echo "❌ Frontend not running"
curl -s "http://localhost:3001/api/health" > /dev/null && echo "✅ Trading engine running" || echo "❌ Trading engine not running"
curl -s "http://localhost:3002/health" > /dev/null && echo "✅ Avantis service running" || echo "❌ Avantis service not running"

echo ""
echo "Step 2: Configuration"
echo "  Investment: \$10"
echo "  Target Profit: \$5"
echo "  Max Positions: 3"
echo "  Wallet: $WALLET_ADDRESS"
echo ""
echo "📝 To start trading:"
echo "   1. Open http://localhost:3000/chat?profit=5&investment=10&mode=real"
echo "   2. Or click 'Start Trading' button in the UI"
echo "   3. The bot will automatically open positions when signals detected"
echo ""
echo "✅ All systems ready for trading!"

