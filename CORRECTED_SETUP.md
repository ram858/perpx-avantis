# PrepX Trading App - Corrected Implementation

## 🎯 Correct Flow Understanding

Now the app works exactly as you described:

1. **Home Page**: Simple form with Target Profit + Investment Amount inputs
2. **Start Trading**: Redirects to chat bot with parameters
3. **Chat Bot**: Shows live trading activity and progress
4. **Floating Live Card**: Real-time trade status (clickable)
5. **Live Trading Activities**: Detailed view of what's happening

## 🚀 Quick Start

### 1. Environment Setup

```bash
cp env.example .env.local
```

Edit `.env.local`:
```env
# Hyperliquid Trading Configuration
HYPERLIQUID_PK=0x_your_private_key_here
HYPERLIQUID_RPC_URL=https://api.hyperliquid.xyz/info

# API Server Configuration
API_PORT=3001
WEBSOCKET_PORT=3002
NODE_ENV=development

# Next.js Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3002
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start the App

```bash
# Start all services
pnpm run dev:integrated

# Or start individually
pnpm run dev          # Next.js app
pnpm run dev:api      # API server  
pnpm run dev:websocket # WebSocket server
```

### 4. Access Your App

- **Main App**: http://localhost:3000
- **Home Page**: http://localhost:3000/home
- **Chat Interface**: http://localhost:3000/chat

## 🎯 How It Works

### 1. Home Page Flow
- User enters Target Profit (e.g., $30)
- User enters Investment Amount (e.g., $50)
- Clicks "Start Trading"
- Redirects to chat with parameters: `/chat?profit=30&investment=50`

### 2. Chat Bot Integration
- Automatically detects trading parameters from URL
- Starts Hyperliquid trading session
- Shows real-time updates in chat
- Displays floating live card with PnL

### 3. Live Trading Activities
- Click the floating live card to expand
- See detailed trading information:
  - Session ID and status
  - Current PnL vs target
  - Open positions count
  - Trading cycle number
  - Real-time updates

### 4. Real-time Updates
- WebSocket connection for live data
- Floating card shows current PnL
- Chat shows trading progress
- All data comes from Hyperliquid engine

## 🔧 Key Features

### Trading Prompt Recognition
The chat bot automatically recognizes trading prompts like:
- "I want to make $30 profit by investing $50"
- "Make $100 profit with $500 investment"

### Real-time Data Integration
- **Floating Card**: Shows live PnL and session status
- **Chat Messages**: Trading progress and updates
- **Live Activities**: Detailed trading information
- **WebSocket**: Real-time connection to trading engine

### Session Management
- Only one trading session allowed at a time
- Automatic session detection and management
- Real-time status updates
- Error handling and recovery

## 📱 User Experience

1. **Home Page**: Clean form with profit/investment inputs
2. **Start Trading**: Seamless redirect to chat
3. **Chat Interface**: Shows everything happening
4. **Live Card**: Always visible real-time status
5. **Detailed View**: Click card for full trading details

## 🚨 Troubleshooting

### Common Issues

1. **Trading Not Starting**
   - Check HYPERLIQUID_PK in .env.local
   - Verify API server is running (port 3001)
   - Check WebSocket connection (port 3002)

2. **No Live Updates**
   - Ensure WebSocket server is running
   - Check browser console for connection errors
   - Verify NEXT_PUBLIC_WEBSOCKET_URL

3. **Chat Not Responding**
   - Check if trading session is active
   - Verify API endpoints are accessible
   - Check network connectivity

### Debug Mode

Enable debug logging:
```env
DEBUG=trading:*
LOG_LEVEL=debug
```

## 🎉 Success!

Your PrepX trading app now works exactly as intended:

- ✅ Home page with simple profit/investment form
- ✅ Chat bot integration with trading engine
- ✅ Real-time floating live card
- ✅ Live trading activities view
- ✅ All data from Hyperliquid engine
- ✅ Seamless user experience

The app provides a clean, intuitive interface for users to start trading and monitor their progress in real-time through the chat interface!
