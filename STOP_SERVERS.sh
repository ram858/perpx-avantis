#!/bin/bash

# PrepX AI - Server Stop Script
# This script stops all three services

echo "🛑 Stopping PrepX AI Services"
echo "============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop Avantis Service
echo -e "${YELLOW}Stopping Avantis Service...${NC}"
pkill -9 -f "uvicorn.*main:app" 2>/dev/null
sleep 1

# Stop Trading Engine
echo -e "${YELLOW}Stopping Trading Engine...${NC}"
pkill -9 -f "trading-engine" 2>/dev/null
pkill -9 -f "ts-node.*server" 2>/dev/null
pkill -9 -f "npm start" 2>/dev/null
sleep 1

# Stop Frontend
echo -e "${YELLOW}Stopping Frontend...${NC}"
pkill -9 -f "next.*dev" 2>/dev/null
pkill -9 -f "pnpm dev" 2>/dev/null
sleep 1

# Verify all stopped
sleep 2
if pgrep -f "uvicorn|next|trading-engine|ts-node" > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Some processes may still be running${NC}"
    echo "Run: pkill -9 -f 'uvicorn|next|trading-engine|ts-node'"
else
    echo -e "${GREEN}✅ All servers stopped successfully${NC}"
fi

echo ""

