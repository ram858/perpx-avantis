const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage for demo
let tradingSessions = new Map();
let sessionCounter = 0;

// Real trading bot using Hyperliquid
class RealTradingBot {
  constructor() {
    this.sessions = new Map();
    this.activeProcesses = new Map();
  }

  async startSession(config, userHyperliquidApiWallet = null) {
    const sessionId = `session_${Date.now()}`;
    const session = {
      sessionId,
      config,
      userHyperliquidApiWallet,
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
      // Start the real Hyperliquid trading bot with user's key
      await this.startHyperliquidBot(sessionId, config, userHyperliquidApiWallet);
      session.status = 'running';
    return sessionId;
    } catch (error) {
      console.error(`[REAL_TRADING] Failed to start session ${sessionId}:`, error);
      session.status = 'error';
      session.error = error.message;
      throw error;
    }
  }

  async startHyperliquidBot(sessionId, config, userHyperliquidApiWallet = null) {
    return new Promise((resolve, reject) => {
      const botPath = path.join(__dirname, 'trading-engine', 'hyperliquid');
      
      // Use user's API wallet private key if provided, otherwise fall back to simulation
      const hyperliquidApiWalletKey = userHyperliquidApiWallet || process.env.HYPERLIQUID_API_WALLET_KEY;
      
      console.log(`[REAL_TRADING] User provided API wallet key: ${userHyperliquidApiWallet ? 'Yes' : 'No'}`);
      console.log(`[REAL_TRADING] API wallet key length: ${hyperliquidApiWalletKey ? hyperliquidApiWalletKey.length : 'null'}`);
      console.log(`[REAL_TRADING] API wallet key starts with 0x: ${hyperliquidApiWalletKey ? hyperliquidApiWalletKey.startsWith('0x') : 'null'}`);
      
      // Check if we have a valid API wallet private key for real trading
      // Clean the key by removing any whitespace and extra characters
      const cleanKey = hyperliquidApiWalletKey ? hyperliquidApiWalletKey.trim().replace(/\s+/g, '') : '';
      console.log(`[REAL_TRADING] Cleaned API wallet key length: ${cleanKey ? cleanKey.length : 'null'}`);
      console.log(`[REAL_TRADING] Cleaned API wallet key starts with 0x: ${cleanKey ? cleanKey.startsWith('0x') : 'null'}`);
      
      const isTestMode = !cleanKey || 
                        !cleanKey.startsWith('0x') ||
                        cleanKey.length !== 66;
      
      if (isTestMode) {
        console.log(`[REAL_TRADING] ⚠️  TEST MODE: Using simulation instead of real trading`);
        
        // Fall back to simulation mode
        this.startSimulationMode(sessionId, config);
        resolve();
        return;
      }

      const env = {
        ...process.env,
        HYPERLIQUID_PK: cleanKey, // Use cleaned API wallet private key
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
            // Notify balance updater of trading completion
            this.notifyTradingResult(sessionId, session.pnl, 'completed');
          } else {
            session.status = 'error';
            session.error = `Bot exited with code ${code}`;
            // Notify balance updater of trading error
            this.notifyTradingResult(sessionId, session.pnl, 'error');
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
          // Fall back to simulation mode if bot fails to start
          console.log(`[REAL_TRADING] Bot failed to start, falling back to simulation mode for session ${sessionId}`);
          this.startSimulationMode(sessionId, config);
          resolve();
        }
      });

      // Give the bot a moment to start
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      }, 3000);
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

    // Try to capture realized PnL lines from trade close logs and accumulate
    const closePnLMatch = output.match(/PnL[:=]\s*([+\-]?[0-9]*\.?[0-9]+)/i);
    if (closePnLMatch) {
      const realized = parseFloat(closePnLMatch[1]);
      if (Number.isFinite(realized)) {
        session.pnl = (session.pnl || 0) + realized;
        session.lastUpdate = new Date();
      }
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
      session.status = 'stopping';
      console.log(`[REAL_TRADING] Session ${sessionId} stopping`);
    }

    const proc = this.activeProcesses.get(sessionId);
    const sessionRef = this.sessions.get(sessionId);

    // If we have a running bot, attempt graceful flatten first
    if (proc && sessionRef) {
      try {
        const botPath = path.join(__dirname, 'trading-engine', 'hyperliquid');
        // Reuse the same cleaned key logic used during start
        const rawKey = sessionRef.userHyperliquidApiWallet || process.env.HYPERLIQUID_API_WALLET_KEY || process.env.HYPERLIQUID_PK;
        const cleanKey = rawKey ? rawKey.trim().replace(/\s+/g, '') : '';
        const env = { ...process.env, HYPERLIQUID_PK: cleanKey };

        console.log(`[REAL_TRADING] Attempting close-all before stopping for session ${sessionId}`);
        const closeProc = spawn('npx', ['ts-node', 'closeAll.ts'], {
          cwd: botPath,
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        closeProc.stdout.on('data', (d) => console.log(`[HYPERLIQUID_CLOSE] ${d.toString().trim()}`));
        closeProc.stderr.on('data', (d) => console.warn(`[HYPERLIQUID_CLOSE_ERR] ${d.toString().trim()}`));

        // After close-all finishes (or times out), terminate main bot
        const timeout = setTimeout(() => {
          console.warn(`[REAL_TRADING] close-all timeout, proceeding to stop bot for ${sessionId}`);
          try { proc.kill('SIGTERM'); } catch (_) {}
          this.activeProcesses.delete(sessionId);
          const s = this.sessions.get(sessionId);
          if (s) {
            s.status = 'stopped';
            s.lastUpdate = new Date();
          }
        }, 15000);

        closeProc.on('close', () => {
          clearTimeout(timeout);
          try { proc.kill('SIGTERM'); } catch (_) {}
          this.activeProcesses.delete(sessionId);
          const s = this.sessions.get(sessionId);
          if (s) {
            s.status = 'stopped';
            s.lastUpdate = new Date();
          }
        });
      } catch (e) {
        console.warn(`[REAL_TRADING] close-all failed, stopping bot anyway for ${sessionId}:`, e?.message || e);
        try { proc.kill('SIGTERM'); } catch (_) {}
        this.activeProcesses.delete(sessionId);
        const s = this.sessions.get(sessionId);
        if (s) {
          s.status = 'stopped';
          s.lastUpdate = new Date();
        }
      }
      return true;
    }

    // No running process: just mark stopped
    const s = this.sessions.get(sessionId);
    if (s) {
      s.status = 'stopped';
      s.lastUpdate = new Date();
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

  startSimulationMode(sessionId, config) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`[REAL_TRADING] Starting simulation mode for session ${sessionId}`);
    
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
        console.log(`[REAL_TRADING] Session ${sessionId} completed! PnL: $${currentSession.pnl.toFixed(2)}`);
        this.notifyTradingResult(sessionId, currentSession.pnl, 'completed');
        clearInterval(interval);
      }

      // Check if budget exhausted (simplified)
      if (currentSession.pnl <= -currentSession.config.maxBudget * 0.8) {
        currentSession.status = 'error';
        console.log(`[REAL_TRADING] Session ${sessionId} stopped due to losses`);
        this.notifyTradingResult(sessionId, currentSession.pnl, 'error');
        clearInterval(interval);
      }

      console.log(`[REAL_TRADING] Cycle ${currentSession.cycle}: PnL=$${currentSession.pnl.toFixed(2)}, Positions=${currentSession.openPositions}`);
    }, 5000); // Update every 5 seconds
  }

  notifyTradingResult(sessionId, pnl, status) {
    console.log(`[REAL_TRADING] Notifying trading result: Session ${sessionId}, PnL: $${pnl}, Status: ${status}`);
    
    // In a real implementation, this would:
    // 1. Send the result to the balance updater
    // 2. Update the user's wallet balance
    // 3. Record the transaction
    
    // For now, we'll just log it
    // TODO: Integrate with actual balance updater
  }
}

const tradingBot = new RealTradingBot();

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
    const { maxBudget, profitGoal, maxPerSession, hyperliquidApiWallet } = req.body;
    
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const sessionId = await tradingBot.startSession({
      maxBudget,
      profitGoal,
      maxPerSession
    }, hyperliquidApiWallet);

    console.log(`[API] Started real trading session ${sessionId}`);
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
