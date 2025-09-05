#!/bin/bash

echo "🚀 Hyperliquid Trading Bot Environment Setup"
echo "============================================="
echo ""

# Check if .env file already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled. Using existing .env file."
        exit 0
    fi
fi

echo "📝 Creating .env file..."
echo ""

# Create .env file
cat > .env << 'EOF'
# Hyperliquid Trading Bot Configuration
# Fill in your actual values below

# REQUIRED: Your Hyperliquid private key (must start with 0x)
# Get this from your wallet (MetaMask, etc.)
HYPERLIQUID_PK=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# OPTIONAL: Set to 'false' to use mainnet instead of testnet (default: testnet)
# For testing, keep this as 'true'
HYPERLIQUID_TESTNET=true

# OPTIONAL: Set to 'true' to run in dry-run mode (no actual trades)
# For testing, keep this as 'false' to see real behavior
DRY_RUN=false

# OPTIONAL: Telegram bot configuration (bot will work without these)
# TELEGRAM_BOT_TOKEN=your_bot_token_here
# TELEGRAM_CHAT_ID=your_chat_id_here

# OPTIONAL: Proxy configuration
# SOCKS_PROXY=socks5://127.0.0.1:1080

# OPTIONAL: Environment
NODE_ENV=development
EOF

echo "✅ .env file created successfully!"
echo ""
echo "🔑 IMPORTANT: You need to edit the .env file and replace the placeholder private key with your actual Hyperliquid private key."
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file: nano .env (or use your preferred editor)"
echo "2. Replace HYPERLIQUID_PK with your actual private key"
echo "3. Save the file"
echo "4. Run the bot: npx ts-node index1.ts"
echo ""
echo "⚠️  WARNING: Never share your private key with anyone!"
echo "⚠️  Keep your .env file secure and never commit it to version control!"
echo ""
echo "🚀 Happy trading!"
