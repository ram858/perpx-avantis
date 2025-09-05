# Hyperliquid Trading Bot

A sophisticated automated trading bot for the Hyperliquid decentralized exchange, featuring advanced order tracking, PnL monitoring, and multi-source data integration.

## 🚀 Features

### Core Trading Features
- **Advanced Order Tracking**: Real-time monitoring of order fills with detailed status reporting
- **PnL Calculation**: Accurate profit/loss calculation matching Hyperliquid's UI
- **Multi-Source Data**: Integrated data fetching from Hyperliquid, CoinGecko, and Binance
- **Regime-Based Trading**: Market regime detection and adaptive trading strategies
- **Risk Management**: Configurable position sizing and leverage limits
- **Profit Goal Tracking**: Session-based profit targets with automatic position closure

### Technical Features
- **TypeScript**: Full TypeScript implementation with type safety
- **Rate Limiting**: Intelligent rate limiting for all API endpoints
- **Error Handling**: Robust error handling with retry mechanisms
- **Caching**: In-memory caching for OHLCV data with TTL
- **Order Execution**: Limit and market order support with fallback strategies

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Hyperliquid account with API access
- Private key for wallet authentication

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd hyperliquid-trading-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your environment**
   - Set up your private key for wallet authentication
   - Configure trading parameters in `adaptiveConfig.json`

## ⚙️ Configuration

### Trading Parameters
The bot accepts user input for:
- **Total Budget**: Total trading capital in USD
- **Profit Goal**: Target profit for the session
- **Max Positions**: Maximum number of concurrent positions

### Leverage Configuration
- Supports up to 20x leverage (varies by token)
- Tiered leverage based on position size
- Automatic leverage optimization

### Data Sources
- **Primary**: Hyperliquid API
- **Secondary**: CoinGecko API
- **Tertiary**: Binance API
- Automatic fallback and rate limiting

## 🚀 Usage

### Start the Trading Bot
```bash
npx ts-node index1.ts
```

### Interactive Setup
The bot will prompt you for:
1. Total budget allocation
2. Profit goal target
3. Maximum number of positions

### Example Session
```
🔑 Initialized with Wallet: 0x...

🚀 Hyperliquid Trading Bot Configuration

Please enter your trading parameters:

💰 Total Budget (USD): 1000
🎯 Profit Goal (USD): 50
📊 Max Positions per Session (1-20): 5

✅ Configuration Summary:
   Budget: $1000
   Profit Goal: $50
   Max Positions: 5

Starting trading session...
```

## 🤖 Telegram Bot Integration

The bot includes a comprehensive Telegram bot for real-time monitoring and notifications.

### Setup Telegram Bot

1. **Create a Telegram Bot**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use `/newbot` command and follow instructions
   - Save the bot token

2. **Get Your Chat ID**
   - Message your bot or add it to a group
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your `chat_id` in the response

3. **Configure Environment Variables**
   ```bash
   # Add to your .env file
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

### Telegram Commands

- `/start` - Welcome message and command list
- `/help` - Detailed command help
- `/status` - Bot status and health check
- `/positions` - Show active positions
- `/health` - Run system health check
- `/stats` - Show performance statistics
- `/hourly` - Send hourly update
- `/logs` - Show recent logs
- `/goals` - Show current goals
- `/closeall` - Close all positions

### Automatic Notifications

The bot automatically sends notifications for:
- 🚀 Session start/restart
- ✅ New position openings
- 🎯 Profit goal achievement
- 💀 Position liquidations
- 💥 Fatal errors
- 📊 Hourly updates (in production)

### Test Telegram Integration
```bash
npm run test:telegram
```

## 📊 Order Tracking

The bot provides detailed order tracking information:

```
📈 Attempting limit order @ 24.65 (adjusted from 24.62)
📊 Limit order status: {"filled": {...}}
✅ Limit order fully filled: 100.00% @ $24.65
```

### Order Status Types
- **Filled**: Order completely executed
- **Resting**: Order placed but not yet filled
- **Error**: Order failed with specific error message

## 🔧 Key Components

### Core Files
- `index1.ts` - Main entry point and session management
- `hyperliquid.ts` - Hyperliquid API integration and order execution
- `tpsl.ts` - Take profit/stop loss logic
- `BudgetAndLeverage.ts` - Position sizing and leverage management
- `binanceHistorical.ts` - Multi-source data fetching
- `strategyEngine.ts` - Trading signal generation
- `regime.ts` - Market regime detection

### Configuration Files
- `adaptiveConfig.json` - Trading parameters and leverage limits
- `tokens.json` - Supported token configurations
- `symbolRegistry.json` - Symbol mapping and metadata

## 📈 Trading Strategy

### Signal Generation
- **Technical Indicators**: RSI, MACD, EMA, ADX, ATR
- **Divergence Detection**: RSI vs Price divergence analysis
- **Market Regime**: Bullish, Bearish, Neutral regime detection
- **Volume Analysis**: Volume-based signal confirmation

### Risk Management
- **Position Sizing**: Dynamic position sizing based on budget and leverage
- **Leverage Limits**: Token-specific maximum leverage enforcement
- **Profit Goals**: Session-based profit targets
- **Stop Loss**: Automatic liquidation protection

## 🔒 Security

### Private Key Management
- Store private keys securely
- Never commit private keys to version control
- Use environment variables for sensitive data

### API Security
- Rate limiting to prevent API abuse
- Error handling for network issues
- Secure API key management

## 📝 Logging

The bot provides comprehensive logging:
- **Trade Execution**: Order placement and fill status
- **PnL Tracking**: Real-time profit/loss monitoring
- **Error Handling**: Detailed error messages and recovery
- **Performance Metrics**: Trading performance analytics

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Manual Testing
- Test with small amounts first
- Monitor order execution carefully
- Verify PnL calculations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes only. Trading cryptocurrencies involves substantial risk of loss. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.

## 🆘 Support

For issues and questions:
1. Check the existing issues
2. Create a new issue with detailed information
3. Include logs and error messages

## 🔄 Updates

Stay updated with the latest features:
- Watch the repository for updates
- Check the releases page for new versions
- Follow the changelog for detailed updates
