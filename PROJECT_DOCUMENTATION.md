# PrepX - Project Documentation

## 📋 Overview

PrepX is an advanced AI-powered cryptocurrency trading platform featuring automated trading, portfolio management, and real-time analytics. The platform supports multiple blockchain networks and provides comprehensive trading tools with intelligent risk management.

---

## ✨ Core Features

### Trading Features
- **Automated AI Trading**: Intelligent trading algorithms with real-time market analysis
- **Trading Sessions**: Configurable trading sessions with profit goals and budget limits
- **Position Management**: Open, close, and monitor trading positions in real-time
- **Multi-Position Trading**: Support for multiple concurrent positions
- **Risk Management**: Configurable leverage, stop-loss, and take-profit levels
- **Real-time PnL Tracking**: Live profit/loss calculations and monitoring
- **Trading Terminal**: Live trading activity dashboard with analytics

### Wallet & Portfolio Features
- **Multi-Chain Wallet Support**: Ethereum, Bitcoin, Solana, and Aptos
- **Wallet Creation**: Automated wallet generation with encrypted private keys
- **Portfolio Management**: Comprehensive portfolio tracking and balance visualization
- **Real-time Balance Updates**: Live balance synchronization across chains
- **Wallet Encryption**: Secure private key storage with AES encryption
- **MetaMask Integration**: Browser wallet connection support

### Authentication & Security
- **Phone-based Authentication**: OTP verification via SMS (Twilio)
- **JWT Token Authentication**: Secure session management
- **Encrypted Private Keys**: AES encryption for wallet private keys
- **User Session Management**: Secure session tracking and validation
- **Protected Routes**: Authentication guards for secure access

### User Experience
- **Interactive Chat Interface**: AI-powered trading assistant
- **Responsive Design**: Mobile-first design optimized for all devices
- **Dark Theme**: Modern dark UI with purple accent colors
- **Real-time Updates**: WebSocket-based live data updates
- **Loading States**: Progressive loading indicators
- **Error Handling**: Comprehensive error boundaries and user feedback

### Analytics & Monitoring
- **Performance Monitoring**: Real-time performance metrics
- **Trading Analytics**: Position history and trading statistics
- **Portfolio Analytics**: Holdings analysis and visualization
- **Session Tracking**: Trading session history and status

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI (shadcn/ui)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation
- **State Management**: React Context API
- **Theming**: next-themes

### Backend & API
- **Runtime**: Node.js 18+
- **API Framework**: Next.js API Routes + Express.js
- **WebSocket**: Native WebSocket API (ws package)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod schemas

### Database & Storage
- **Primary Database**: PostgreSQL
- **ORM**: TypeORM
- **Connection Pooling**: PgBouncer
- **Database Features**:
  - Replication (master-replica setup)
  - Sharding support
  - Multi-region deployment
  - Failover management
  - Read-only replicas
- **Caching**: Redis (Sentinel configuration)

### Blockchain & Web3
- **Ethereum**: ethers.js v6, viem
- **Bitcoin**: bitcoinjs-lib, bip32, bip39
- **Solana**: @solana/web3.js
- **Aptos**: @aptos-labs/ts-sdk
- **Trading Protocol**: Hyperliquid (@nktkas/hyperliquid)
- **Wallet Management**: HD wallet generation (BIP32/BIP39)

### Trading Engine
- **Trading SDK**: Hyperliquid SDK
- **Technical Indicators**: technicalindicators library
- **Price Data**: Binance historical data
- **Strategy Engine**: Custom trading strategies with RSI, MACD, EMA
- **Session Management**: Independent trading session runner

### External Services
- **SMS Provider**: Twilio (for OTP verification)
- **Analytics**: Vercel Analytics
- **Deployment**: Vercel Platform

### Infrastructure & DevOps
- **Load Balancing**: Nginx, HAProxy
- **Containerization**: Docker, Docker Compose
- **Microservices**:
  - API Gateway
  - Trading Service
  - User Service
- **Monitoring**: Prometheus, Alertmanager
- **Database Management**: Keepalived for high availability

### Development Tools
- **Package Manager**: pnpm
- **Build Tool**: Next.js built-in
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Code Quality**: ESLint config for Next.js

---

## 📁 Project Structure

```
prep-x/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── trading/      # Trading operations
│   │   ├── wallet/       # Wallet management
│   │   └── positions/    # Position management
│   ├── home/             # Dashboard page
│   ├── chat/             # AI chat interface
│   ├── trading/          # Trading page
│   ├── wallet/           # Wallet management page
│   └── simulation/       # Trading simulation
│
├── components/           # React components
│   ├── ui/               # Reusable UI components
│   ├── TradingDashboard.tsx
│   ├── Portfolio.tsx
│   └── WalletConnection.tsx
│
├── lib/                  # Core libraries
│   ├── services/         # Business logic services
│   │   ├── AuthService.ts
│   │   ├── WalletService.ts
│   │   ├── HyperliquidTradingService.ts
│   │   └── OTPService.ts
│   ├── database/         # Database configuration
│   ├── hooks/            # React hooks
│   └── utils/            # Utility functions
│
├── trading-engine/       # Independent trading engine
│   ├── hyperliquid/      # Hyperliquid integration
│   ├── api/              # Trading engine API
│   └── websocket/        # WebSocket server
│
├── database/             # Database setup scripts
│   ├── init.sql          # Database schema
│   ├── setup-replication.sql
│   └── pgbouncer.ini     # Connection pooling config
│
└── microservices/        # Microservices architecture
    ├── api-gateway/
    ├── trading-service/
    └── user-service/
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP via SMS
- `POST /api/auth/verify-otp` - Verify OTP and get JWT token
- `GET /api/auth/verify-token` - Verify JWT token

### Wallet Management
- `POST /api/wallet/create` - Create new wallet
- `GET /api/wallet/user-wallets` - Get user wallets
- `GET /api/wallet/primary` - Get primary trading wallet
- `POST /api/wallet/send-otp` - Send wallet OTP
- `POST /api/wallet/verify-otp` - Verify wallet OTP

### Trading Operations
- `POST /api/trading/start` - Start trading session
- `POST /api/trading/stop` - Stop trading session
- `GET /api/trading/sessions` - Get all sessions
- `GET /api/trading/session/[sessionId]` - Get session details
- `GET /api/positions` - Get all open positions
- `POST /api/close-position` - Close specific position
- `POST /api/close-all-positions` - Close all positions
- `GET /api/status` - Get system status

---

## 🔐 Security Features

- **Encrypted Private Keys**: AES encryption for wallet private keys
- **JWT Authentication**: Secure token-based authentication
- **OTP Verification**: Two-factor authentication via SMS
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: TypeORM parameterized queries
- **XSS Protection**: React's built-in XSS protection
- **CSP Headers**: Content Security Policy headers
- **Secure Cookies**: HTTP-only, secure cookie settings

---

## 📊 Database Schema

### Entities
- **User**: User accounts with phone-based authentication
- **Wallet**: Multi-chain wallet storage with encrypted keys
- **Otp**: OTP verification records

### Database Features
- **Partitioning**: Hash-based table partitioning
- **Replication**: Master-replica setup for high availability
- **Sharding**: Horizontal scaling support
- **Connection Pooling**: PgBouncer for optimized connections

---

## 🚀 Deployment Architecture

### Production Setup
- **Frontend**: Vercel (Next.js)
- **API**: Next.js API Routes + Express.js
- **Database**: PostgreSQL with replication
- **Caching**: Redis Sentinel cluster
- **Load Balancing**: Nginx/HAProxy
- **Monitoring**: Prometheus + Alertmanager

### High Availability
- **Database Failover**: Automated failover with Keepalived
- **Read Replicas**: Multiple read-only replicas
- **Connection Pooling**: PgBouncer for connection management
- **Multi-Region**: Support for multi-region deployment

---

## 📦 Key Dependencies

### Core
- `next`: 15.2.4
- `react`: 18.3.1
- `typescript`: ^5
- `tailwindcss`: ^4.1.9

### Blockchain
- `ethers`: ^6.15.0
- `viem`: ^1.19.9
- `@solana/web3.js`: ^1.98.4
- `@aptos-labs/ts-sdk`: ^1.39.0
- `@nktkas/hyperliquid`: ^0.19.1

### Database
- `pg`: ^8.16.3
- `typeorm`: ^0.3.27

### Services
- `twilio`: ^4.23.0
- `jsonwebtoken`: ^9.0.2
- `axios`: ^1.9.0

### UI
- `@radix-ui/*`: Multiple Radix UI components
- `lucide-react`: ^0.454.0
- `recharts`: 2.15.4

---

## 🔧 Environment Variables

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=prepx

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION_TIME=7d

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_VERIFY_SERVICE_SID=your-verify-service-sid

# Trading Engine
TRADING_ENGINE_URL=http://localhost:3001
HYPERLIQUID_PK=your-private-key
HYPERLIQUID_RPC_URL=your-rpc-url
HYPERLIQUID_TESTNET=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 🎯 Key Features Summary

1. **Multi-Chain Wallet Support**: Ethereum, Bitcoin, Solana, Aptos
2. **Automated Trading**: AI-powered trading with custom strategies
3. **Real-time Updates**: WebSocket-based live data
4. **Secure Authentication**: Phone-based OTP + JWT
5. **Portfolio Management**: Comprehensive tracking and analytics
6. **Risk Management**: Configurable trading limits and stops
7. **High Availability**: Database replication and failover
8. **Scalable Architecture**: Microservices and load balancing
9. **Modern UI/UX**: Responsive design with dark theme
10. **Production Ready**: Monitoring, logging, and error handling

---

## 📝 Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis (optional, for caching)

### Setup
```bash
# Install dependencies
pnpm install

# Setup database
pnpm run db:init

# Start development server
pnpm run dev

# Start trading engine
pnpm run dev:integrated
```

### Build
```bash
pnpm run build
pnpm start
```

---

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ by PrepX Team**

