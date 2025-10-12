#!/bin/bash

# Start Trading Engine in the background
echo "🚀 Starting Trading Engine..."
cd /Users/mokshya/Desktop/prep-x/trading-engine && npx ts-node api/server.ts &
TRADING_ENGINE_PID=$!

# Wait a moment for trading engine to start
sleep 3

# Start Next.js Frontend
echo "🚀 Starting Next.js Frontend..."
cd /Users/mokshya/Desktop/prep-x && npm run dev &
NEXTJS_PID=$!

echo ""
echo "✅ Servers started successfully!"
echo "   - Trading Engine: http://localhost:3001"
echo "   - Frontend: http://localhost:3000"
echo ""
echo "To stop servers, press Ctrl+C"

# Wait for both processes
wait $TRADING_ENGINE_PID $NEXTJS_PID

