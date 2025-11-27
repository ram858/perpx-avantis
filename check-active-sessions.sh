#!/bin/bash

# Script to check for active trading sessions
# This helps diagnose if an active session automatically used deposited funds

echo "🔍 Checking for Active Trading Sessions"
echo "========================================"
echo ""

# Get token from environment or prompt
if [ -z "$AUTH_TOKEN" ]; then
    echo "⚠️  AUTH_TOKEN not set. Please set it:"
    echo "   export AUTH_TOKEN='your-jwt-token-here'"
    echo ""
    echo "Or run:"
    echo "   AUTH_TOKEN='your-token' ./check-active-sessions.sh"
    exit 1
fi

API_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

echo "📡 Checking sessions at: $API_URL/api/trading/sessions"
echo ""

response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/trading/sessions" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" != "200" ]; then
    echo "❌ Error: HTTP $http_code"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    exit 1
fi

echo "$body" | jq '.' 2>/dev/null || echo "$body"

# Check for active sessions
active_count=$(echo "$body" | jq '[.sessions[]? | select(.status == "running")] | length' 2>/dev/null || echo "0")

if [ "$active_count" -gt 0 ]; then
    echo ""
    echo "⚠️  WARNING: Found $active_count active trading session(s)!"
    echo "   Active sessions will automatically use available funds to open positions."
    echo "   This is likely why your deposit was used immediately."
    echo ""
    echo "To stop active sessions, use the stop trading button in the UI."
else
    echo ""
    echo "✅ No active trading sessions found."
    echo "   If funds were still used, check the transaction details on BaseScan."
fi

