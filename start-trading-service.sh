#!/bin/bash

# Start Trading Engine Services
# This script starts both the API server and WebSocket server

echo "🚀 Starting PrepX Trading Services..."
echo ""

# Navigate to trading-engine directory
cd "$(dirname "$0")/trading-engine" || exit 1

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    echo "❌ ts-node not found. Installing dependencies..."
    npm install
fi

# Start API Server in background
echo "📡 Starting API Server on port 3001..."
ts-node api/server.ts &
API_PID=$!

# Wait a moment for API server to start
sleep 2

# Start WebSocket Server in background
echo "🔌 Starting WebSocket Server on port 3002..."
ts-node websocket/server.ts &
WS_PID=$!

# Wait a moment for WebSocket server to start
sleep 2

# Check if servers started successfully
if ps -p $API_PID > /dev/null && ps -p $WS_PID > /dev/null; then
    echo ""
    echo "✅ All services started successfully!"
    echo "📡 API Server: http://localhost:3001 (PID: $API_PID)"
    echo "🔌 WebSocket Server: ws://localhost:3002 (PID: $WS_PID)"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""
    
    # Wait for interrupt
    trap "echo ''; echo '🛑 Stopping services...'; kill $API_PID $WS_PID 2>/dev/null; exit 0" INT TERM
    wait
else
    echo "❌ Failed to start services"
    kill $API_PID $WS_PID 2>/dev/null
    exit 1
fi

