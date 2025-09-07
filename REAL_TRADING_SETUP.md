# 🚀 Real Trading Setup Guide

## ⚠️ Important Notice
Real trading involves actual money and financial risk. Make sure you understand the risks before proceeding.

## 📋 Prerequisites

1. **Hyperliquid Account**: You need a Hyperliquid account with funds
2. **Private Key**: Your Hyperliquid wallet private key
3. **Sufficient Balance**: At least $50+ in your Hyperliquid account for testing

## 🔧 Environment Setup

### Step 1: Create Environment File

Create a `.env.local` file in your project root:

```bash
cp env.example .env.local
```

### Step 2: Configure Your Private Key

Edit `.env.local` and replace the placeholder with your actual Hyperliquid private key:

```env
# Hyperliquid Trading Configuration
HYPERLIQUID_PK=0x_your_actual_private_key_here
HYPERLIQUID_RPC_URL=https://api.hyperliquid.xyz/info

# API Server Configuration
API_PORT=3001
WEBSOCKET_PORT=3002
NODE_ENV=development

# Trading Configuration
DEFAULT_MAX_BUDGET=1000
DEFAULT_PROFIT_GOAL=100
DEFAULT_MAX_POSITIONS=5

# Next.js Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3002

# Real Trading Mode
REAL_TRADING_MODE=true
```

### Step 3: Get Your Hyperliquid Private Key

1. Go to [Hyperliquid](https://app.hyperliquid.xyz)
2. Connect your wallet
3. Go to Settings → Export Private Key
4. Copy your private key (starts with `0x`)
5. Paste it in your `.env.local` file

## 🚀 Starting Real Trading

### Option 1: Using npm/pnpm scripts

```bash
# Start real trading server
pnpm run start:real-trading
```

### Option 2: Direct execution

```bash
# Start real trading server directly
node start-real-trading.js
```

### Option 3: Integrated development

```bash
# Start all services (Next.js + API + WebSocket)
pnpm run dev:integrated
```

## 🎯 How to Use Real Trading

1. **Start the Server**: Use one of the commands above
2. **Open the App**: Go to `http://localhost:3000`
3. **Connect Wallet**: Connect your wallet in the app
4. **Set Parameters**: Enter your target profit and investment amount
5. **Choose Mode**: Click "💰 Start Real Trading" (green button)
6. **Monitor**: Watch your trades in real-time

## 🔍 Verification Steps

### Check Environment Status

1. Go to `http://localhost:3000/trading`
2. Look for "Environment Status" section
3. Should show:
   - ✅ Trading Mode: Real Trading
   - ✅ Wallet Status: Connected
   - ✅ Balance: Your actual balance

### Test Connection

1. Start a small test trade ($10-20)
2. Monitor the logs in your terminal
3. Check Hyperliquid dashboard for actual trades

## 🛡️ Safety Features

- **Budget Limits**: Set maximum investment amounts
- **Profit Goals**: Automatic stop when target reached
- **Loss Protection**: Stops trading if losses exceed 80% of budget
- **Session Management**: One trading session at a time

## 📊 Monitoring Your Trades

### Real-time Updates
- WebSocket connection for live data
- Floating live card shows current PnL
- Detailed trading logs in terminal

### Hyperliquid Dashboard
- Check your actual positions
- Monitor real PnL and balances
- View trade history

## 🚨 Troubleshooting

### Common Issues

1. **"Test Mode" Message**
   - Check your `.env.local` file
   - Ensure `HYPERLIQUID_PK` is set correctly
   - Restart the server

2. **"Wallet Not Connected"**
   - Connect your wallet in the app
   - Ensure you have sufficient balance

3. **"Environment Configuration Error"**
   - Verify `.env.local` exists
   - Check private key format (starts with `0x`)
   - Restart the server

### Getting Help

1. Check the terminal logs for error messages
2. Verify your Hyperliquid account has funds
3. Test with small amounts first
4. Check the simulation mode works first

## 💡 Best Practices

1. **Start Small**: Test with $10-20 first
2. **Monitor Closely**: Watch your first few trades
3. **Set Limits**: Use reasonable profit goals
4. **Keep Logs**: Save terminal output for debugging
5. **Backup Keys**: Keep your private key secure

## 🔒 Security Notes

- Never share your private key
- Use a dedicated trading wallet
- Keep your `.env.local` file secure
- Consider using a hardware wallet for large amounts

---

**Ready to start real trading?** 🚀

1. Set up your `.env.local` file
2. Start the real trading server
3. Connect your wallet
4. Start with a small test trade