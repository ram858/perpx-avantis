# SuperApp Integration Guide for Perp-x

This guide explains how Perp-x has been integrated as a mini-app within the SuperApp ecosystem, allowing users to trade using their existing SuperApp wallet without manual wallet connection.

## 🏗️ Architecture Overview

```
SuperApp (wallet.wapal.io)
├── User Authentication & Wallet Management
├── Mini-App Launch System
└── Perp-x Mini-App
    ├── SuperApp SDK Integration
    ├── Automatic Wallet Connection
    ├── Hyperliquid Trading Engine
    └── Real-time Trading Interface
```

## 🔧 Integration Components

### 1. SuperApp SDK (`lib/superapp/`)

- **`sdk.ts`**: Core SDK implementation for SuperApp communication
- **`context.tsx`**: React context for SuperApp state management
- **`types.ts`**: TypeScript definitions for SuperApp integration
- **`hyperliquid.ts`**: SuperApp-aware Hyperliquid client

### 2. Wallet Integration (`lib/wallet/WalletContext.tsx`)

Modified to support both:
- **SuperApp Mode**: Uses existing SuperApp wallet automatically
- **Standalone Mode**: Falls back to MetaMask connection

### 3. UI Components

- **`SuperAppWrapper.tsx`**: Main wrapper component for SuperApp integration
- **`WalletConnection.tsx`**: Updated to show SuperApp-specific UI

## 🚀 How It Works

### SuperApp Launch Flow

1. **User logs into SuperApp** → Wallet is automatically created/managed
2. **User launches Perp-x mini-app** → SuperApp provides launch parameters:
   - `superapp_token`: JWT token for authentication
   - `app_id`: Mini-app identifier
   - `session_id`: Trading session identifier

3. **Perp-x detects SuperApp environment** → Automatically initializes with SuperApp wallet
4. **Trading begins** → Uses SuperApp's Ethereum wallet for Hyperliquid trading

### Wallet Integration

```typescript
// SuperApp provides user's wallet data
const user = {
  wallet_addresses: {
    ethereum: "0xDAc82B922A43F4AfB53D4D69c6510265113Fa4c0",
    bitcoin: "1Jm5J9CmnvsuRtqUAWnAXeiMjydiEA1LbP",
    solana: "7KkLc8ax1KSAdJ1MGhpmjCabzbJvNQqr34JjrGcoAhCZ"
  },
  privateKeys: {
    ethereum: "0xe3603df3372bb45cb289ebf80b145b29d635ce147ee4ff31d50aee4831f796e9"
  }
}

// Perp-x uses this for Hyperliquid trading
const hyperliquidClient = createSuperAppHyperliquidClient({ user });
```

## 📱 User Experience

### SuperApp Mode
- **Automatic wallet connection** - No manual wallet input required
- **Seamless trading** - Uses existing SuperApp wallet
- **SuperApp branding** - Shows "SuperApp Connected" status
- **Integrated UI** - SuperApp banner and styling

### Standalone Mode (Fallback)
- **MetaMask connection** - Traditional wallet connection
- **Manual setup** - User provides wallet details
- **Independent operation** - Works without SuperApp

## 🔐 Security Features

1. **JWT Authentication**: SuperApp provides secure tokens
2. **Private Key Management**: SuperApp handles key storage
3. **Session Management**: Secure session tracking
4. **Testnet Default**: Uses testnet for safety in development

## 🛠️ Setup Instructions

### 1. Environment Configuration

Copy the example environment file:
```bash
cp env.superapp.example .env.local
```

Configure your SuperApp settings:
```env
NEXT_PUBLIC_SUPERAPP_DEPLOYMENT_TOKEN=your-deployment-token
NEXT_PUBLIC_SUPERAPP_BASE_URL=https://wallet.wapal.io
HYPERLIQUID_TESTNET=true
```

### 2. SuperApp Deployment

Register your mini-app with the SuperApp:
```bash
curl -X POST https://wallet.wapal.io/mini-apps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Perp-x Trading Bot",
    "slug": "perp-x-trading",
    "description": "AI-powered perpetual trading bot",
    "deployment_url": "https://your-perp-x-domain.com",
    "icon_url": "https://your-perp-x-domain.com/icon.png",
    "category": "finance",
    "visibility": "public"
  }'
```

### 3. Launch URL Format

SuperApp will launch your mini-app with parameters:
```
https://your-perp-x-domain.com?superapp_token=eyJ...&app_id=0209785d-b2d2-4f65-bfab-5d7c4bc3fc8a&session_id=session-123
```

## 🔄 Development Workflow

### Testing SuperApp Integration

1. **Local Development**:
   ```bash
   # Start the app
   pnpm run dev
   
   # Simulate SuperApp launch
   # Add URL parameters: ?superapp_token=test&app_id=test&session_id=test
   ```

2. **SuperApp Environment**:
   ```bash
   # Deploy to your domain
   # SuperApp will launch with real parameters
   ```

### Debugging

Enable debug logging:
```typescript
// In SuperApp SDK
console.log('SuperApp environment detected:', environment);
console.log('User data loaded:', userData);
console.log('Hyperliquid client initialized:', client);
```

## 📊 Trading Features

### Supported Operations

- **Long/Short Positions**: Using SuperApp wallet
- **Real-time PnL**: Integrated with SuperApp balance
- **Risk Management**: Automated stop-loss and take-profit
- **Portfolio Tracking**: Shows SuperApp wallet balance

### Hyperliquid Integration

```typescript
// Place a trade using SuperApp wallet
const result = await hyperliquidClient.placeMarketOrder({
  symbol: 'BTC',
  side: 'long',
  size: '0.1',
  price: 45000
});

// Close positions
await hyperliquidClient.closeAllPositions();
```

## 🎯 Benefits

### For Users
- **No wallet setup** - Uses existing SuperApp wallet
- **Seamless experience** - No manual private key input
- **Integrated portfolio** - All assets in one place
- **Secure trading** - SuperApp handles security

### For Developers
- **Simplified onboarding** - No wallet connection flow
- **Reduced friction** - Users can start trading immediately
- **Integrated ecosystem** - Works within SuperApp
- **Automatic updates** - Wallet data synced automatically

## 🔮 Future Enhancements

1. **Multi-chain Support**: Bitcoin and Solana trading
2. **Advanced Analytics**: SuperApp-wide portfolio tracking
3. **Social Features**: Share trades within SuperApp
4. **Mobile Optimization**: Native mobile app integration

## 🆘 Troubleshooting

### Common Issues

1. **Wallet not connecting**:
   - Check SuperApp launch parameters
   - Verify deployment token
   - Ensure SuperApp user has Ethereum wallet

2. **Trading errors**:
   - Verify Hyperliquid testnet connectivity
   - Check wallet has sufficient balance
   - Ensure proper private key format

3. **UI not updating**:
   - Check SuperApp context initialization
   - Verify wallet connection status
   - Check browser console for errors

### Support

For technical support:
- Check browser console for error messages
- Verify SuperApp integration status
- Test with SuperApp test environment

## 📝 API Reference

### SuperApp SDK Methods

```typescript
// Initialize SDK
await SuperApp.init({ deploymentToken: 'token' });

// Get user data
const user = await SuperApp.getUser();

// Get wallet balances
const balances = await SuperApp.getWalletBalances();

// Sign messages
const signature = await SuperApp.signMessage('Hello');
```

### Hyperliquid Client Methods

```typescript
// Create client
const client = createSuperAppHyperliquidClient({ user });

// Trading operations
await client.placeMarketOrder({ symbol, side, size });
await client.closePosition(symbol, position, reason);
await client.getPositions();
await client.getTotalPnL();
```

---

*This integration allows Perp-x to seamlessly work within the SuperApp ecosystem while maintaining all its powerful trading capabilities.*
