const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage for demo
let tradingSessions = new Map();
let sessionCounter = 0;

// Simple trading bot simulation
class SimpleTradingBot {
  constructor() {
    this.sessions = new Map();
  }

  startSession(config) {
    const sessionId = `session_${Date.now()}`;
    const session = {
      sessionId,
      config,
      status: 'running',
      pnl: 0,
      openPositions: 0,
      cycle: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    this.sessions.set(sessionId, session);
    
    // Simulate trading activity
    this.startTradingSimulation(sessionId);
    
    return sessionId;
  }

  startTradingSimulation(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const interval = setInterval(() => {
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession || currentSession.status !== 'running') {
        clearInterval(interval);
        return;
      }

      // Simulate trading cycle
      currentSession.cycle++;
      currentSession.lastUpdate = new Date();

      // Simulate PnL changes (random walk with slight upward bias)
      const change = (Math.random() - 0.4) * 2; // Slight positive bias
      currentSession.pnl += change;

      // Simulate position changes
      if (Math.random() > 0.7) {
        currentSession.openPositions = Math.min(
          currentSession.config.maxPerSession,
          currentSession.openPositions + (Math.random() > 0.5 ? 1 : -1)
        );
        currentSession.openPositions = Math.max(0, currentSession.openPositions);
      }

      // Check if profit goal reached
      if (currentSession.pnl >= currentSession.config.profitGoal) {
        currentSession.status = 'completed';
        console.log(`[TRADING_BOT] Session ${sessionId} completed! PnL: $${currentSession.pnl.toFixed(2)}`);
        clearInterval(interval);
      }

      // Check if budget exhausted (simplified)
      if (currentSession.pnl <= -currentSession.config.maxBudget * 0.8) {
        currentSession.status = 'error';
        console.log(`[TRADING_BOT] Session ${sessionId} stopped due to losses`);
        clearInterval(interval);
      }

      console.log(`[TRADING_BOT] Cycle ${currentSession.cycle}: PnL=$${currentSession.pnl.toFixed(2)}, Positions=${currentSession.openPositions}`);
    }, 5000); // Update every 5 seconds
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      console.log(`[TRADING_BOT] Session ${sessionId} stopped`);
      return true;
    }
    return false;
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

const tradingBot = new SimpleTradingBot();

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    sessions: tradingBot.getAllSessions()
  });
});

app.post('/api/start-trading', async (req, res) => {
  try {
    const { maxBudget, profitGoal, maxPerSession } = req.body;
    
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const sessionId = tradingBot.startSession({
      maxBudget,
      profitGoal,
      maxPerSession
    });

    console.log(`[API] Started trading session ${sessionId}`);
    res.json({ sessionId, status: 'started' });
  } catch (error) {
    console.error('[API] Error starting trading session:', error);
    res.status(500).json({ error: 'Failed to start trading session' });
  }
});

app.post('/api/stop-trading', (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const stopped = tradingBot.stopSession(sessionId);
    
    if (stopped) {
      console.log(`[API] Stopped trading session ${sessionId}`);
      res.json({ sessionId, status: 'stopped' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('[API] Error stopping trading session:', error);
    res.status(500).json({ error: 'Failed to stop trading session' });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = tradingBot.getSessionStatus(sessionId);
    
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('[API] Error getting session status:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[API] Server running on http://localhost:${port}`);
});

// WebSocket Server
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WEBSOCKET] Received:', data);
      
      if (data.type === 'subscribe' && data.sessionId) {
        // Subscribe to session updates
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

// Broadcast updates to subscribed clients
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
}, 1000); // Send updates every second

console.log(`[WEBSOCKET] Server running on ws://localhost:3002`);
