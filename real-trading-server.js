const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// Import the web trading bot
const { webTradingBot } = require('./trading-engine/hyperliquid/web-trading-bot.ts');

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for trading sessions
let tradingSessions = new Map();
let sessionCounter = 0;

// Real trading bot integration
class RealTradingBot {
  constructor() {
    this.sessions = new Map();
    this.activeProcesses = new Map();
  }

  async startSession(config) {
    const sessionId = `session_${Date.now()}`;
    const session = {
      sessionId,
      config,
      status: 'starting',
      pnl: 0,
      openPositions: 0,
      cycle: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      process: null
    };

    this.sessions.set(sessionId, session);
    
    try {
      // Start the real Hyperliquid trading bot
      await this.startRealTradingBot(sessionId, config);
      session.status = 'running';
      return sessionId;
    } catch (error) {
      console.error(`[REAL_TRADING] Failed to start session ${sessionId}:`, error);
      session.status = 'error';
      session.error = error.message;
      throw error;
    }
  }

  async startRealTradingBot(sessionId, config) {
    return new Promise((resolve, reject) => {
      const botPath = path.join(__dirname, 'trading-engine', 'hyperliquid');
      const env = {
        ...process.env,
        MAX_BUDGET: config.maxBudget.toString(),
        PROFIT_GOAL: config.profitGoal.toString(),
        MAX_PER_SESSION: config.maxPerSession.toString(),
        SESSION_ID: sessionId
      };

      console.log(`[REAL_TRADING] Starting Hyperliquid bot for session ${sessionId}`);
      console.log(`[REAL_TRADING] Config: Budget=$${config.maxBudget}, Goal=$${config.profitGoal}, MaxPos=${config.maxPerSession}`);

      const botProcess = spawn('npx', ['ts-node', 'index.ts'], {
        cwd: botPath,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeProcesses.set(sessionId, botProcess);

      let hasResolved = false;

      // Handle bot output
      botProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[HYPERLIQUID_BOT] ${output.trim()}`);
        
        // Parse trading updates from bot output
        this.parseBotOutput(sessionId, output);
      });

      botProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(`[HYPERLIQUID_BOT_ERROR] ${error.trim()}`);
      });

      botProcess.on('close', (code) => {
        console.log(`[REAL_TRADING] Bot process for session ${sessionId} exited with code ${code}`);
        this.activeProcesses.delete(sessionId);
        
        const session = this.sessions.get(sessionId);
        if (session) {
          if (code === 0) {
            session.status = 'completed';
          } else {
            session.status = 'error';
            session.error = `Bot exited with code ${code}`;
          }
        }
      });

      botProcess.on('error', (error) => {
        console.error(`[REAL_TRADING] Bot process error for session ${sessionId}:`, error);
        this.activeProcesses.delete(sessionId);
        
        const session = this.sessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
        }
        
        if (!hasResolved) {
          hasResolved = true;
          reject(error);
        }
      });

      // Give the bot a moment to start
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      }, 2000);
    });
  }

  parseBotOutput(sessionId, output) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Parse PnL updates
    const pnlMatch = output.match(/Total PnL: \$([\d.-]+)/);
    if (pnlMatch) {
      session.pnl = parseFloat(pnlMatch[1]);
      session.lastUpdate = new Date();
    }

    // Parse position updates
    const positionMatch = output.match(/Open positions: (\d+)/);
    if (positionMatch) {
      session.openPositions = parseInt(positionMatch[1]);
    }

    // Parse cycle updates
    const cycleMatch = output.match(/Cycle (\d+)/);
    if (cycleMatch) {
      session.cycle = parseInt(cycleMatch[1]);
    }

    // Check for completion
    if (output.includes('Session completed') || output.includes('Profit goal reached')) {
      session.status = 'completed';
    }

    // Check for errors
    if (output.includes('FATAL') || output.includes('Error:')) {
      session.status = 'error';
    }
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
    }

    const process = this.activeProcesses.get(sessionId);
    if (process) {
      console.log(`[REAL_TRADING] Stopping bot process for session ${sessionId}`);
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
    }
  }

  getSessionStatus(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

const tradingBot = new RealTradingBot();

// API Routes
app.post('/api/start-trading', async (req, res) => {
  try {
    const { maxBudget, profitGoal, maxPerSession } = req.body;
    
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const sessionId = await tradingBot.startSession({
      maxBudget,
      profitGoal,
      maxPerSession
    });

    console.log(`[API] Started real trading session ${sessionId}`);
    res.json({ sessionId, status: 'started' });
  } catch (error) {
    console.error('[API] Error starting trading session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop-trading/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    tradingBot.stopSession(sessionId);
    console.log(`[API] Stopped trading session ${sessionId}`);
    res.json({ sessionId, status: 'stopped' });
  } catch (error) {
    console.error('[API] Error stopping trading session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = tradingBot.getSessionStatus(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session);
});

app.get('/api/sessions', (req, res) => {
  const sessions = tradingBot.getAllSessions();
  res.json(sessions);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    activeSessions: tradingBot.getAllSessions().length,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`[API] Real trading server running on http://localhost:${port}`);
});

// WebSocket Server for real-time updates
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WEBSOCKET] Received:', data);
      
      if (data.type === 'subscribe' && data.sessionId) {
        ws.sessionId = data.sessionId;
        console.log(`[WEBSOCKET] Client subscribed to session ${data.sessionId}`);
      }
    } catch (error) {
      console.error('[WEBSOCKET] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WEBSOCKET] Client disconnected');
  });
});

// Broadcast real-time updates to subscribed clients
setInterval(() => {
  const sessions = tradingBot.getAllSessions();
  
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN && ws.sessionId) {
      const session = tradingBot.getSessionStatus(ws.sessionId);
      if (session) {
        ws.send(JSON.stringify({
          type: 'session_update',
          sessionId: ws.sessionId,
          data: session
        }));
      }
    }
  });
}, 2000); // Send updates every 2 seconds

console.log(`[WEBSOCKET] Server running on ws://localhost:3002`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Gracefully shutting down...');
  
  // Stop all active trading sessions
  tradingBot.getAllSessions().forEach(session => {
    if (session.status === 'running') {
      tradingBot.stopSession(session.sessionId);
    }
  });
  
  process.exit(0);
});
