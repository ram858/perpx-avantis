# Hyperliquid Trading Bot Integration Guide for PrepX

## Overview

This guide provides comprehensive documentation for integrating the Hyperliquid trading bot (`index1.ts`) into the PrepX Next.js application. The integration will create a seamless bridge between the sophisticated trading engine and the modern web interface.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PrepX Frontend (Next.js)                │
├─────────────────────────────────────────────────────────────┤
│  • React Components (Home, Chat, Trading Interface)        │
│  • Real-time UI Updates                                    │
│  • User Input & Configuration                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket/API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Integration Layer (Node.js)                 │
├─────────────────────────────────────────────────────────────┤
│  • Express.js API Server                                   │
│  • WebSocket Server for Real-time Updates                  │
│  • Trading Session Manager                                 │
│  • Configuration Bridge                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Direct Integration
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Hyperliquid Trading Engine                    │
├─────────────────────────────────────────────────────────────┤
│  • index1.ts (Main Trading Logic)                         │
│  • Strategy Engine & Signal Processing                     │
│  • Risk Management & Position Tracking                     │
│  • Telegram Bot Integration                                │
│  • Enhanced Logging & Analytics                            │
└─────────────────────────────────────────────────────────────┘
```

## Integration Components

### 1. Core Trading Engine (Hyperliquid)
- **File**: `hyperliquid/index1.ts`
- **Purpose**: Main trading logic with session management
- **Key Features**:
  - Interactive user input collection
  - Automated trading cycles
  - Profit goal tracking
  - Position management
  - Telegram notifications
  - Enhanced logging

### 2. Frontend Interface (PrepX)
- **Framework**: Next.js 15 with React 19
- **UI Components**: Modern, responsive design
- **Key Pages**:
  - Home: Portfolio overview and trading goals
  - Chat: AI-powered trading interface
  - Detail: Individual coin analysis

### 3. Integration Layer
- **API Server**: Express.js for HTTP endpoints
- **WebSocket**: Real-time communication
- **Session Manager**: Trading session coordination

## Integration Steps

### Step 1: Project Structure Setup

```
prep-x/
├── app/                          # Next.js app directory
├── components/                   # React components
├── lib/                         # Utility functions
├── trading-engine/              # Hyperliquid integration
│   ├── hyperliquid/            # Original trading bot files
│   ├── api/                    # Express.js API server
│   ├── websocket/              # WebSocket server
│   └── session-manager.ts      # Trading session coordinator
├── types/                      # TypeScript definitions
└── package.json               # Updated dependencies
```

### Step 2: Dependencies Integration

Add Hyperliquid dependencies to PrepX:

```json
{
  "dependencies": {
    "@nktkas/hyperliquid": "^0.19.1",
    "decimal.js": "^10.4.3",
    "dotenv": "^16.3.1",
    "node-telegram-bot-api": "^0.66.0",
    "technicalindicators": "^3.1.0",
    "viem": "^1.19.9",
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "cors": "^2.8.5"
  }
}
```

### Step 3: Environment Configuration

Create `.env.local` in prep-x root:

```env
# Hyperliquid Configuration
HYPERLIQUID_PK=0x_your_private_key_here
HYPERLIQUID_RPC_URL=https://api.hyperliquid.xyz/info

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# API Configuration
API_PORT=3001
WEBSOCKET_PORT=3002
```

### Step 4: API Server Implementation

Create `trading-engine/api/server.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import { TradingSessionManager } from '../session-manager';

const app = express();
const port = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

const sessionManager = new TradingSessionManager();

// Start trading session
app.post('/api/trading/start', async (req, res) => {
  try {
    const { maxBudget, profitGoal, maxPerSession } = req.body;
    const sessionId = await sessionManager.startSession({
      maxBudget,
      profitGoal,
      maxPerSession
    });
    res.json({ sessionId, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session status
app.get('/api/trading/status/:sessionId', (req, res) => {
  const status = sessionManager.getSessionStatus(req.params.sessionId);
  res.json(status);
});

// Stop trading session
app.post('/api/trading/stop/:sessionId', (req, res) => {
  sessionManager.stopSession(req.params.sessionId);
  res.json({ status: 'stopped' });
});

app.listen(port, () => {
  console.log(`Trading API server running on port ${port}`);
});
```

### Step 5: WebSocket Server for Real-time Updates

Create `trading-engine/websocket/server.ts`:

```typescript
import WebSocket from 'ws';
import { TradingSessionManager } from '../session-manager';

export class TradingWebSocketServer {
  private wss: WebSocket.Server;
  private sessionManager: TradingSessionManager;

  constructor(port: number, sessionManager: TradingSessionManager) {
    this.sessionManager = sessionManager;
    this.wss = new WebSocket.Server({ port });
    
    this.wss.on('connection', (ws) => {
      console.log('Client connected to trading WebSocket');
      
      // Subscribe to session updates
      ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'subscribe') {
          this.sessionManager.subscribeToUpdates(data.sessionId, ws);
        }
      });
      
      ws.on('close', () => {
        console.log('Client disconnected from trading WebSocket');
      });
    });
  }
}
```

### Step 6: Session Manager Implementation

Create `trading-engine/session-manager.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
}

export interface SessionStatus {
  sessionId: string;
  status: 'running' | 'stopped' | 'completed';
  pnl: number;
  openPositions: number;
  cycle: number;
  lastUpdate: Date;
}

export class TradingSessionManager {
  private sessions: Map<string, {
    process: ChildProcess;
    config: TradingConfig;
    status: SessionStatus;
    subscribers: Set<WebSocket>;
  }> = new Map();

  async startSession(config: TradingConfig): Promise<string> {
    const sessionId = `session_${Date.now()}`;
    
    // Spawn the trading bot process
    const process = spawn('npx', ['ts-node', 'trading-engine/hyperliquid/index1.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TRADING_CONFIG: JSON.stringify(config),
        SESSION_ID: sessionId
      }
    });

    const session = {
      process,
      config,
      status: {
        sessionId,
        status: 'running' as const,
        pnl: 0,
        openPositions: 0,
        cycle: 0,
        lastUpdate: new Date()
      },
      subscribers: new Set<WebSocket>()
    };

    this.sessions.set(sessionId, session);

    // Handle process output
    process.stdout?.on('data', (data) => {
      this.parseTradingOutput(sessionId, data.toString());
    });

    process.on('exit', () => {
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  private parseTradingOutput(sessionId: string, output: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Parse trading output for real-time updates
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('Total PnL:')) {
        const pnlMatch = line.match(/Total PnL: \$([\d.-]+)/);
        if (pnlMatch) {
          session.status.pnl = parseFloat(pnlMatch[1]);
          session.status.lastUpdate = new Date();
          this.broadcastUpdate(sessionId);
        }
      }
      
      if (line.includes('Cycle')) {
        const cycleMatch = line.match(/Cycle (\d+)/);
        if (cycleMatch) {
          session.status.cycle = parseInt(cycleMatch[1]);
          this.broadcastUpdate(sessionId);
        }
      }
    }
  }

  private broadcastUpdate(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const update = {
      type: 'trading_update',
      data: session.status
    };

    session.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(update));
      }
    });
  }

  subscribeToUpdates(sessionId: string, ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.add(ws);
    }
  }

  getSessionStatus(sessionId: string): SessionStatus | null {
    const session = this.sessions.get(sessionId);
    return session ? session.status : null;
  }

  stopSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.kill();
      session.status.status = 'stopped';
      this.broadcastUpdate(sessionId);
    }
  }
}
```

### Step 7: Frontend Integration

Update `app/chat/page.tsx` to integrate with trading engine:

```typescript
"use client"
import { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const [tradingSession, setTradingSession] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3002');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to trading WebSocket');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'trading_update') {
        setTradingSession(data.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const startTrading = async (config: { maxBudget: number; profitGoal: number; maxPerSession: number }) => {
    try {
      const response = await fetch('/api/trading/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      
      if (result.sessionId) {
        // Subscribe to updates
        wsRef.current?.send(JSON.stringify({
          type: 'subscribe',
          sessionId: result.sessionId
        }));
      }
    } catch (error) {
      console.error('Failed to start trading:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Trading Status Display */}
      {tradingSession && (
        <Card className="bg-[#1a1a1a] border-[#262626] p-4 m-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Trading Session</h3>
              <p className="text-[#b4b4b4] text-sm">
                PnL: ${tradingSession.pnl.toFixed(2)} | 
                Cycle: {tradingSession.cycle} | 
                Positions: {tradingSession.openPositions}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </Card>
      )}
      
      {/* Rest of your existing chat interface */}
    </div>
  );
}
```

### Step 8: Modified Trading Bot Entry Point

Create `trading-engine/hyperliquid/index1-web.ts` (modified version of index1.ts):

```typescript
import dotenv from 'dotenv';
dotenv.config();

// Import all the same modules as original index1.ts
import { getUserInputs, delay } from './index1';

// Check if running in web mode
const isWebMode = process.env.SESSION_ID && process.env.TRADING_CONFIG;

async function runWebSession() {
  if (!isWebMode) {
    console.error('Web mode requires SESSION_ID and TRADING_CONFIG environment variables');
    process.exit(1);
  }

  const config = JSON.parse(process.env.TRADING_CONFIG!);
  const sessionId = process.env.SESSION_ID!;

  console.log(`[WEB_SESSION] Starting session ${sessionId} with config:`, config);

  // Use the same trading logic but with web-provided config
  const { maxBudget, profitGoal, maxPerSession } = config;
  
  // Rest of the trading logic from original index1.ts...
  // (Copy the runSession function and modify to use provided config)
}

if (isWebMode) {
  runWebSession().catch(console.error);
} else {
  // Original CLI behavior
  import('./index1').then(module => {
    // Original entry point logic
  });
}
```

## Configuration Management

### Environment Variables

Create a comprehensive environment setup:

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
```

### Configuration Files

Copy and adapt Hyperliquid configuration files:

```bash
# Copy configuration files to prep-x
cp hyperliquid/adaptiveConfig.json prep-x/trading-engine/config/
cp hyperliquid/tokens.json prep-x/trading-engine/config/
cp hyperliquid/symbols/symbolRegistry.json prep-x/trading-engine/config/
```

## Security Considerations

### 1. Private Key Management
- Store private keys in environment variables only
- Never commit private keys to version control
- Use secure key management in production

### 2. API Security
- Implement authentication for trading endpoints
- Use HTTPS in production
- Validate all input parameters
- Rate limiting for API endpoints

### 3. WebSocket Security
- Implement authentication for WebSocket connections
- Validate session ownership
- Sanitize all data sent to clients

## Deployment Strategy

### Development Environment
```bash
# Terminal 1: Start Next.js development server
cd prep-x
npm run dev

# Terminal 2: Start trading API server
cd prep-x/trading-engine
npm run dev:api

# Terminal 3: Start WebSocket server
npm run dev:websocket
```

### Production Deployment
```bash
# Build Next.js application
npm run build

# Start production servers
npm run start:production
```

## Testing Strategy

### 1. Unit Tests
- Test individual trading functions
- Mock external API calls
- Validate configuration parsing

### 2. Integration Tests
- Test API endpoints
- WebSocket communication
- Session management

### 3. End-to-End Tests
- Full trading session simulation
- UI interaction testing
- Real-time update verification

## Monitoring and Logging

### 1. Application Logs
- Trading session logs
- API request/response logs
- WebSocket connection logs
- Error tracking

### 2. Performance Monitoring
- Trading performance metrics
- API response times
- WebSocket connection stability
- Memory usage tracking

### 3. Alerting
- Trading session failures
- API server downtime
- WebSocket disconnections
- Critical errors

## Troubleshooting

### Common Issues

1. **Private Key Errors**
   - Verify HYPERLIQUID_PK format (must start with 0x)
   - Check environment variable loading
   - Ensure key has sufficient permissions

2. **API Connection Issues**
   - Verify API server is running
   - Check CORS configuration
   - Validate endpoint URLs

3. **WebSocket Connection Problems**
   - Check WebSocket server status
   - Verify port availability
   - Review connection authentication

4. **Trading Session Failures**
   - Check Hyperliquid API connectivity
   - Verify account balance
   - Review trading parameters

### Debug Mode

Enable debug logging:

```env
DEBUG=trading:*
LOG_LEVEL=debug
```

## Performance Optimization

### 1. Caching
- Cache OHLCV data
- Store session state
- Optimize API responses

### 2. Connection Pooling
- Reuse HTTP connections
- Optimize WebSocket connections
- Implement connection limits

### 3. Data Processing
- Stream large datasets
- Implement pagination
- Optimize real-time updates

## Future Enhancements

### 1. Advanced Features
- Multiple trading strategies
- Portfolio management
- Risk analytics dashboard
- Mobile app integration

### 2. Scalability
- Horizontal scaling
- Load balancing
- Database integration
- Microservices architecture

### 3. User Experience
- Advanced charting
- Custom indicators
- Social trading features
- Educational content

## Support and Maintenance

### 1. Documentation
- Keep integration guide updated
- Document API changes
- Maintain troubleshooting guide

### 2. Updates
- Regular dependency updates
- Security patches
- Feature enhancements

### 3. Community
- GitHub issues tracking
- User feedback collection
- Feature request management

---

This integration guide provides a comprehensive roadmap for successfully integrating the Hyperliquid trading bot with the PrepX application. Follow the steps sequentially and ensure proper testing at each stage.
