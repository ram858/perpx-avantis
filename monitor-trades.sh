#!/bin/bash

# Monitor Trading Trades and Positions
# Monitors active trading sessions and positions on AvantisFi

echo "📊 Trading Monitor"
echo "=================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if JWT token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: JWT token required${NC}"
    echo ""
    echo "Usage: $0 <JWT_TOKEN> [SESSION_ID]"
    echo ""
    echo "Options:"
    echo "  - Provide SESSION_ID to monitor specific session"
    echo "  - Omit SESSION_ID to monitor all positions"
    exit 1
fi

JWT_TOKEN=$1
SESSION_ID=$2

# Function to display positions
show_positions() {
    echo -e "${BLUE}Fetching positions...${NC}"
    echo ""
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET http://localhost:3000/api/positions \
      -H "Authorization: Bearer $JWT_TOKEN")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
        
        # Extract position count
        POSITION_COUNT=$(echo "$BODY" | jq -r '.openPositions // .positions | length' 2>/dev/null || echo "0")
        echo ""
        echo -e "${GREEN}Open Positions: $POSITION_COUNT${NC}"
    else
        echo -e "${RED}❌ Failed to fetch positions${NC}"
        echo "  HTTP Code: $HTTP_CODE"
        echo "  Response: $BODY"
    fi
}

# Function to monitor specific session
monitor_session() {
    SESSION=$1
    echo -e "${BLUE}Monitoring Session: $SESSION${NC}"
    echo ""
    
    # Check session status via trading engine
    RESPONSE=$(curl -s http://localhost:3001/api/trading/session/$SESSION 2>/dev/null)
    
    if [ ! -z "$RESPONSE" ]; then
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${YELLOW}⚠️  Session not found or trading engine not accessible${NC}"
    fi
}

# Function to check AvantisFi positions directly
check_avantis_positions() {
    if [ -z "$2" ]; then
        echo -e "${YELLOW}⚠️  Private key required to check AvantisFi positions directly${NC}"
        echo "  Use: $0 <JWT_TOKEN> <SESSION_ID> <PRIVATE_KEY>"
        return
    fi
    
    PRIVATE_KEY=$2
    echo -e "${BLUE}Checking AvantisFi positions directly...${NC}"
    echo ""
    
    RESPONSE=$(curl -s -X POST http://localhost:3002/api/positions \
      -H "Content-Type: application/json" \
      -d "{\"private_key\": \"$PRIVATE_KEY\"}")
    
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

# Main monitoring loop
if [ ! -z "$SESSION_ID" ]; then
    # Monitor specific session
    while true; do
        clear
        echo "📊 Trading Monitor - Session: $SESSION_ID"
        echo "=========================================="
        echo ""
        echo "$(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        
        monitor_session "$SESSION_ID"
        echo ""
        show_positions
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
        sleep 5
    done
else
    # Show current positions
    show_positions
    echo ""
    
    # Check if we should monitor continuously
    read -p "Monitor continuously? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        while true; do
            clear
            echo "📊 Trading Monitor - All Positions"
            echo "==================================="
            echo ""
            echo "$(date '+%Y-%m-%d %H:%M:%S')"
            echo ""
            show_positions
            echo ""
            echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
            sleep 10
        done
    fi
fi

