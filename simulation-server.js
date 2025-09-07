const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Pure simulation trading bot (no wallet required)
class SimulationTradingBot {
  constructor() {
    this.sessions = new Map();
  }

  startSession(config) {
    const sessionId = `sim_${Date.now()}`;
    const session = {
      sessionId,
      config,
      status: 'running',
      pnl: 0,
      openPositions: 0,
      cycle: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      isSimulation: true
    };

    this.sessions.set(sessionId, session);
    
    console.log(`[SIMULATION] Starting simulation session ${sessionId}`);
    console.log(`[SIMULATION] Config: Budget=$${config.maxBudget}, Goal=$${config.profitGoal}, MaxPos=${config.maxPerSession}`);
    
    // Start simulation immediately
    this.startSimulation(sessionId);
    
    return sessionId;
  }

  startSimulation(sessionId) {
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

      // More realistic PnL simulation with market-like behavior
      const marketVolatility = 0.8; // Higher volatility for more interesting simulation
      const trendBias = 0.1; // Slight positive bias
      const change = (Math.random() - 0.5 + trendBias) * marketVolatility * 2;
      currentSession.pnl += change;

      // Simulate position changes based on market conditions
      if (Math.random() > 0.6) {
        const positionChange = Math.random() > 0.5 ? 1 : -1;
        currentSession.openPositions = Math.min(
          currentSession.config.maxPerSession,
          Math.max(0, currentSession.openPositions + positionChange)
        );
      }

      // Check if profit goal reached
      if (currentSession.pnl >= currentSession.config.profitGoal) {
        currentSession.status = 'completed';
        console.log(`[SIMULATION] ✅ Session ${sessionId} completed! PnL: $${currentSession.pnl.toFixed(2)}`);
        clearInterval(interval);
      }

      // Check if budget exhausted
      if (currentSession.pnl <= -currentSession.config.maxBudget * 0.8) {
        currentSession.status = 'error';
        console.log(`[SIMULATION] ❌ Session ${sessionId} stopped due to losses`);
        clearInterval(interval);
      }

      console.log(`[SIMULATION] Cycle ${currentSession.cycle}: PnL=$${currentSession.pnl.toFixed(2)}, Positions=${currentSession.openPositions}`);
    }, 3000); // Update every 3 seconds for faster simulation
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      console.log(`[SIMULATION] Session ${sessionId} stopped`);
    }
    return true;
  }

  getSessionStatus(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

const tradingBot = new SimulationTradingBot();

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    mode: 'simulation',
    timestamp: new Date().toISOString(),
    sessions: tradingBot.getAllSessions()
  });
});

app.post('/api/start-trading', (req, res) => {
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

    console.log(`[API] Started simulation session ${sessionId}`);
    res.json({ sessionId, status: 'started', mode: 'simulation' });
  } catch (error) {
    console.error('[API] Error starting simulation session:', error);
    res.status(500).json({ error: 'Failed to start simulation session' });
  }
});

app.post('/api/stop-trading/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const stopped = tradingBot.stopSession(sessionId);
    if (stopped) {
      console.log(`[API] Stopped simulation session ${sessionId}`);
      res.json({ sessionId, status: 'stopped' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('[API] Error stopping simulation session:', error);
    res.status(500).json({ error: 'Failed to stop simulation session' });
  }
});

// Alternative stop-trading endpoint (without sessionId in URL)
app.post('/api/stop-trading', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    const stopped = tradingBot.stopSession(sessionId);
    if (stopped) {
      console.log(`[API] Stopped simulation session ${sessionId}`);
      res.json({ sessionId, status: 'stopped' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('[API] Error stopping simulation session:', error);
    res.status(500).json({ error: 'Failed to stop simulation session' });
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
    mode: 'simulation',
    activeSessions: tradingBot.getAllSessions().length,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`[SIMULATION] 🎮 Simulation server running on http://localhost:${port}`);
  console.log(`[SIMULATION] 💡 This is a pure simulation - no real money involved!`);
});

// WebSocket Server for real-time updates
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] Client connected to simulation');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WEBSOCKET] Received:', data);
      
      if (data.type === 'subscribe' && data.sessionId) {
        ws.sessionId = data.sessionId;
        console.log(`[WEBSOCKET] Client subscribed to simulation session ${data.sessionId}`);
      }
    } catch (error) {
      console.error('[WEBSOCKET] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WEBSOCKET] Client disconnected from simulation');
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

console.log(`[WEBSOCKET] Simulation WebSocket server running on ws://localhost:3002`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SIMULATION] 🛑 Gracefully shutting down simulation server...');
  process.exit(0);
});
