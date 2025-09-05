# 🚀 Hyperliquid Trading Bot Setup Guide

## Quick Start

### 1. Run the Setup Script
```bash
./setup-env.sh
```

### 2. Edit the .env File
Replace the placeholder private key with your actual Hyperliquid private key:
```bash
nano .env
```

**Required:**
- `HYPERLIQUID_PK=0x1234567890abcdef...` (your actual private key)

**Optional:**
- `HYPERLIQUID_TESTNET=true` (keep true for testing)
- `DRY_RUN=false` (set to true if you want no real trades)

### 3. Start the Bot
```bash
npx ts-node index1.ts
```

## What I Fixed

✅ **Telegram Bot Errors**: Made Telegram bot optional - bot will run without it
✅ **Interactive Input**: Bot now prompts for budget, profit goal, and max positions
✅ **Better Error Messages**: Clear instructions when environment variables are missing
✅ **Graceful Fallbacks**: Bot continues running even if optional services fail

## Environment Variables Explained

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `HYPERLIQUID_PK` | ✅ | Your wallet private key | None |
| `HYPERLIQUID_TESTNET` | ❌ | Use testnet (true) or mainnet (false) | true |
| `DRY_RUN` | ❌ | Run without real trades | false |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token | None |
| `TELEGRAM_CHAT_ID` | ❌ | Telegram chat ID | None |

## Troubleshooting

### ❌ "Missing HYPERLIQUID_PK"
- Create a `.env` file with your private key
- Run `./setup-env.sh` to create the file template

### ❌ "Private key must start with 0x"
- Ensure your private key starts with `0x`
- Copy the full key from your wallet

### ❌ Telegram connection errors
- These are now optional and won't crash the bot
- Bot will run without Telegram notifications

### ❌ Network connectivity issues
- Check your internet connection
- Ensure you can access Hyperliquid APIs
- Try using a VPN if you're behind a firewall

## Security Notes

⚠️ **NEVER share your private key with anyone!**
⚠️ **Keep your .env file secure!**
⚠️ **Never commit .env to version control!**
✅ **Use testnet for testing!**
✅ **Start with small amounts!**

## Getting Your Private Key

1. **MetaMask**: Account → Three dots → Account details → Export private key
2. **WalletConnect**: Export private key (varies by wallet)
3. **Hardware Wallet**: Use the wallet's export function

## Need Help?

- Check the logs for specific error messages
- Ensure your private key is correct
- Verify you have sufficient funds in your wallet
- Make sure you're using the right network (testnet/mainnet)

Happy trading! 🎯
