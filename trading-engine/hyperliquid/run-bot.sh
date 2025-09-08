#!/bin/bash

# Disable Telegram bot temporarily
export TELEGRAM_BOT_TOKEN=""
export TELEGRAM_CHAT_ID=""

# Run the bot with predefined inputs
echo "Starting Hyperliquid Trading Bot..."
echo "Budget: 1000"
echo "Profit Goal: 200" 
echo "Max Positions: 5"
echo ""

# Provide inputs to the bot
printf "1000\n200\n5\n" | npx ts-node index1.ts
