# PrepX Trading Integration

This document provides a complete guide for the integrated Hyperliquid trading bot within the PrepX application.

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template and configure your settings:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Hyperliquid Trading Configuration
HYPERLIQUID_PK=0x_your_private_key_here
HYPERLIQUID_RPC_URL=https://api.hyperliquid.xyz/info

# Telegram Integration (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

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
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Application

#### Development Mode (All Services)
```bash
npm run dev:full
```

This will start:
- Next.js development server (port 3000)
- Trading API server (port 3001)
- WebSocket server (port 3002)

#### Individual Services
```bash
# Terminal 1: Next.js app
npm run dev

# Terminal 2: API server
npm run dev:api

# Terminal 3: WebSocket server
npm run dev:websocket
```

### 4. Access the Application

- **Main App**: http://localhost:3000
- **Trading Dashboard**: http://localhost:3000/trading
- **API Health Check**: http://localhost:3001/api/health

## 📁 Project Structure

```
prep-x/
├── app/                          # Next.js app directory
│   ├── trading/                  # Trading dashboard page
│   ├── home/                     # Home page with portfolio
│   ├── chat/                     # AI chat interface
│   └── ...
├── components/
│   ├── trading/                  # Trading-specific components
│   │   └── TradingDashboard.tsx  # Main trading interface
│   └── ui/                       # Shared UI components
├── lib/
│   └── hooks/
│       └── useTrading.ts         # Trading integration hook
├── trading-engine/               # Hyperliquid integration
│   ├── api/
│   │   └── server.ts            # Express.js API server
│   ├── websocket/
│   │   └── server.ts            # WebSocket server
│   ├── hyperliquid/             # Trading bot files
│   │   ├── index1-web.ts        # Web-enabled trading bot
│   │   ├── hyperliquid.ts       # Core trading logic
│   │   ├── strategyEngine.ts    # Trading strategies
│   │   └── ...                  # Other trading modules
│   ├── config/                  # Configuration files
│   │   ├── adaptiveConfig.json  # Trading parameters
│   │   ├── tokens.json          # Supported tokens
│   │   └── symbolRegistry.json  # Symbol mappings
│   ├── session-manager.ts       # Trading session coordinator
│   └── start-servers.ts         # Multi-service startup script
└── package.json                 # Updated with trading dependencies
```

## 🔧 Configuration

### Trading Parameters

The trading bot can be configured through the web interface or environment variables:

- **Max Budget**: Total trading capital (default: $1000)
- **Profit Goal**: Target profit per session (default: $100)
- **Max Positions**: Maximum concurrent positions (default: 5)

### Risk Management

Risk parameters are defined in `trading-engine/config/adaptiveConfig.json`:

- **Leverage Limits**: Token-specific maximum leverage
- **Stop Loss**: Automatic position closure on losses
- **Position Sizing**: Dynamic sizing based on budget and risk

### Supported Tokens

Supported trading pairs are defined in `trading-engine/config/tokens.json` and include:

- BTC, ETH, SOL, DOGE, ADA, AVAX
- ATOM, FIL, NEAR, OP, MKR, IMX
- ARB, ALGO, AAVE, SAND, GALA
- And many more...

## 🎯 Features

### Real-time Trading Dashboard

- **Live PnL Tracking**: Real-time profit/loss monitoring
- **Position Management**: View and manage open positions
- **Session Control**: Start/stop trading sessions
- **Progress Tracking**: Visual progress toward profit goals

### WebSocket Integration

- **Real-time Updates**: Live trading data via WebSocket
- **Automatic Reconnection**: Robust connection handling
- **Status Notifications**: Session status and error alerts

### API Endpoints

- `POST /api/trading/start` - Start new trading session
- `GET /api/trading/status/:sessionId` - Get session status
- `POST /api/trading/stop/:sessionId` - Stop trading session
- `GET /api/trading/sessions` - List all sessions
- `GET /api/trading/config` - Get trading configuration

## 🔒 Security

### Private Key Management

- Store private keys in environment variables only
- Never commit private keys to version control
- Use secure key management in production

### API Security

- CORS configuration for cross-origin requests
- Input validation for all API endpoints
- Rate limiting and error handling

### WebSocket Security

- Connection authentication
- Session ownership validation
- Secure data transmission

## 🚨 Troubleshooting

### Common Issues

#### 1. Private Key Errors
```
Error: Missing required environment variable: HYPERLIQUID_PK
```
**Solution**: Ensure your private key is set in `.env.local` and starts with `0x`

#### 2. API Connection Issues
```
Error: Failed to connect to trading server
```
**Solution**: 
- Check if API server is running on port 3001
- Verify `NEXT_PUBLIC_API_URL` in environment
- Check CORS configuration

#### 3. WebSocket Connection Problems
```
Error: WebSocket connection error
```
**Solution**:
- Check if WebSocket server is running on port 3002
- Verify `NEXT_PUBLIC_WEBSOCKET_URL` in environment
- Check firewall settings

#### 4. Trading Session Failures
```
Error: Failed to start trading session
```
**Solution**:
- Verify Hyperliquid API connectivity
- Check account balance and permissions
- Review trading parameters

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=trading:*
LOG_LEVEL=debug
```

### Logs

Check the following for debugging:

- **API Server**: Console output from `npm run dev:api`
- **WebSocket Server**: Console output from `npm run dev:websocket`
- **Trading Bot**: Console output from trading sessions
- **Browser Console**: Client-side errors and WebSocket messages

## 📊 Monitoring

### Health Checks

- **API Health**: `GET http://localhost:3001/api/health`
- **WebSocket Status**: Check connection indicator in UI
- **Trading Status**: Monitor session status in dashboard

### Performance Metrics

- **Session Duration**: Track trading session length
- **PnL Tracking**: Monitor profit/loss over time
- **Position Count**: Track concurrent positions
- **API Response Times**: Monitor server performance

## 🔄 Updates and Maintenance

### Regular Updates

1. **Dependencies**: Keep all packages updated
2. **Trading Logic**: Update strategy parameters as needed
3. **Security**: Apply security patches promptly
4. **Configuration**: Review and update trading parameters

### Backup and Recovery

- **Configuration**: Backup trading configuration files
- **Logs**: Archive trading session logs
- **Private Keys**: Secure backup of wallet keys

## 🆘 Support

### Getting Help

1. **Documentation**: Check this README and integration guide
2. **Logs**: Review error logs for specific issues
3. **Community**: Check GitHub issues and discussions
4. **Debugging**: Use debug mode for detailed logging

### Reporting Issues

When reporting issues, include:

- **Environment**: OS, Node.js version, browser
- **Configuration**: Relevant environment variables (without private keys)
- **Logs**: Error messages and console output
- **Steps**: Steps to reproduce the issue

## 🎉 Success!

You now have a fully integrated trading bot with a modern web interface! The system provides:

- ✅ Real-time trading dashboard
- ✅ WebSocket-based live updates
- ✅ RESTful API for session management
- ✅ Secure private key handling
- ✅ Comprehensive error handling
- ✅ Modern React-based UI

Start trading by visiting the Trading Dashboard at http://localhost:3000/trading and configure your trading parameters!
