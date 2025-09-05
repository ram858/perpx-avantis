# PrepX Integrated Trading App Setup

## 🚀 Quick Start (Integrated Approach)

This setup runs everything in one project - perfect for a mini app!

### 1. Environment Setup

Create your environment file:

```bash
cp env.example .env.local
```

Edit `.env.local` with your Hyperliquid configuration:

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
pnpm install
```

### 3. Start the Integrated App

**Option 1: Simple Integrated Start**
```bash
pnpm run dev:integrated
```

**Option 2: Individual Services (for debugging)**
```bash
# Terminal 1: Next.js app
pnpm run dev

# Terminal 2: API server
pnpm run dev:api

# Terminal 3: WebSocket server
pnpm run dev:websocket
```

**Option 3: Concurrent Start**
```bash
pnpm run dev:full
```

### 4. Access Your App

- **Main App**: http://localhost:3000
- **Trading Dashboard**: http://localhost:3000/trading
- **API Health**: http://localhost:3001/api/health

## 🏗️ Integrated Architecture

```
PrepX App (Port 3000)
├── Next.js Frontend
├── Trading Dashboard (/trading)
├── Chat Interface (/chat)
└── Portfolio View (/home)

Trading Engine (Ports 3001, 3002)
├── API Server (Express.js)
├── WebSocket Server
├── Session Manager
└── Hyperliquid Bot Integration
```

## 🎯 Key Features

### Real-time Trading Dashboard
- Live PnL tracking
- Position management
- Session control
- Progress visualization

### WebSocket Integration
- Real-time updates
- Automatic reconnection
- Status notifications

### API Endpoints
- `POST /api/trading/start` - Start trading session
- `GET /api/trading/status/:sessionId` - Get session status
- `POST /api/trading/stop/:sessionId` - Stop trading session
- `GET /api/trading/config` - Get trading configuration

## 🔧 Configuration

### Trading Parameters
- **Max Budget**: Total trading capital (default: $1000)
- **Profit Goal**: Target profit per session (default: $100)
- **Max Positions**: Maximum concurrent positions (default: 5)

### Risk Management
- Leverage limits per token
- Automatic stop-loss
- Position sizing based on budget

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill processes on ports 3000, 3001, 3002
   lsof -ti:3000,3001,3002 | xargs kill -9
   ```

2. **Private Key Error**
   ```
   Error: Missing required environment variable: HYPERLIQUID_PK
   ```
   **Solution**: Ensure your private key is set in `.env.local` and starts with `0x`

3. **WebSocket Connection Issues**
   - Check if WebSocket server is running on port 3002
   - Verify `NEXT_PUBLIC_WEBSOCKET_URL` in environment

4. **API Connection Issues**
   - Check if API server is running on port 3001
   - Verify `NEXT_PUBLIC_API_URL` in environment

### Debug Mode

Enable debug logging:
```env
DEBUG=trading:*
LOG_LEVEL=debug
```

## 📱 Usage

1. **Start Trading**:
   - Go to http://localhost:3000/trading
   - Configure your trading parameters
   - Click "Start Trading"

2. **Monitor Progress**:
   - Watch real-time PnL updates
   - Track open positions
   - Monitor progress toward profit goal

3. **Stop Trading**:
   - Click "Stop Trading" to end session
   - View final results and statistics

## 🚀 Deployment

### Development
```bash
pnpm run dev:integrated
```

### Production
```bash
pnpm run build
pnpm run start:production
```

## 🎉 Success!

Your integrated trading app is now ready! The system provides:

- ✅ Real-time trading dashboard
- ✅ WebSocket-based live updates
- ✅ RESTful API for session management
- ✅ Secure private key handling
- ✅ Modern React-based UI
- ✅ All-in-one integrated solution

Perfect for a mini app - simple to deploy, manage, and scale!
