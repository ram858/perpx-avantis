import express from 'express';
import cors from 'cors';
import { TradingSessionManager } from '../session-manager.js';

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Initialize session manager
const sessionManager = new TradingSessionManager();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeSessions: sessionManager.getAllSessions().length
  });
});

// Start trading session
app.post('/api/trading/start', async (req, res) => {
  try {
    const { maxBudget, profitGoal, maxPerSession } = req.body;

    // Validate input
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ 
        error: 'Missing required parameters: maxBudget, profitGoal, maxPerSession' 
      });
    }

    if (maxBudget < 10 || maxBudget > 10000000) {
      return res.status(400).json({ 
        error: 'maxBudget must be between $10 and $10,000,000' 
      });
    }

    if (profitGoal <= 0) {
      return res.status(400).json({ 
        error: 'profitGoal must be greater than 0' 
      });
    }

    if (maxPerSession < 1 || maxPerSession > 20) {
      return res.status(400).json({ 
        error: 'maxPerSession must be between 1 and 20' 
      });
    }

    const sessionId = await sessionManager.startSession({
      maxBudget: parseFloat(maxBudget),
      profitGoal: parseFloat(profitGoal),
      maxPerSession: parseInt(maxPerSession)
    });

    console.log(`[API] Started trading session ${sessionId}`);
    res.json({ 
      sessionId, 
      status: 'started',
      config: { maxBudget, profitGoal, maxPerSession }
    });
  } catch (error) {
    console.error('[API] Error starting trading session:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get session status
app.get('/api/trading/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = sessionManager.getSessionStatus(sessionId);
    
    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('[API] Error getting session status:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get all sessions
app.get('/api/trading/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    console.error('[API] Error getting all sessions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Stop trading session
app.post('/api/trading/stop/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { force } = req.body;
    
    const stopped = force 
      ? sessionManager.forceStopSession(sessionId)
      : sessionManager.stopSession(sessionId);
    
    if (!stopped) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    console.log(`[API] Stopped trading session ${sessionId}`);
    res.json({ sessionId, status: 'stopped' });
  } catch (error) {
    console.error('[API] Error stopping trading session:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get trading configuration
app.get('/api/trading/config', (req, res) => {
  try {
    const config = {
      defaultMaxBudget: process.env.DEFAULT_MAX_BUDGET || 1000,
      defaultProfitGoal: process.env.DEFAULT_PROFIT_GOAL || 100,
      defaultMaxPositions: process.env.DEFAULT_MAX_POSITIONS || 5,
      minBudget: 10,
      maxBudget: 10000000,
      minPositions: 1,
      maxPositions: 20
    };
    
    res.json(config);
  } catch (error) {
    console.error('[API] Error getting trading config:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API] Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API] Received SIGTERM, shutting down gracefully');
  sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[API] Received SIGINT, shutting down gracefully');
  sessionManager.cleanup();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`[API] Trading API server running on port ${port}`);
  console.log(`[API] Health check: http://localhost:${port}/api/health`);
});

export { sessionManager };
