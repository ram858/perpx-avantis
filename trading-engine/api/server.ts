import express from 'express';
import cors from 'cors';
import { TradingSessionManager } from '../session-manager';

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
    const { maxBudget, profitGoal, maxPerSession, hyperliquidApiWallet, userPhoneNumber, walletAddress } = req.body;

    // Validate input
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ 
        error: 'Missing required parameters: maxBudget, profitGoal, maxPerSession' 
      });
    }

    // Validate wallet data
    if (!hyperliquidApiWallet || !userPhoneNumber || !walletAddress) {
      return res.status(400).json({ 
        error: 'Missing wallet data: hyperliquidApiWallet, userPhoneNumber, walletAddress are required' 
      });
    }

    // Set the Hyperliquid private key for this session
    process.env.HYPERLIQUID_PK = hyperliquidApiWallet;
    console.log(`[API] Set HYPERLIQUID_PK for user ${userPhoneNumber} with wallet ${walletAddress}`);

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
      maxPerSession: parseInt(maxPerSession),
      userPhoneNumber,
      walletAddress
    });

    console.log(`[API] Started trading session ${sessionId} for user ${userPhoneNumber}`);
    res.json({ 
      sessionId, 
      status: 'started',
      config: { maxBudget, profitGoal, maxPerSession },
      user: { phoneNumber: userPhoneNumber, walletAddress }
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

// Get session details (alternative endpoint for frontend)
app.get('/api/trading/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = sessionManager.getSessionStatus(sessionId);
    
    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('[API] Error getting session details:', error);
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

// Close all positions
app.post('/api/close-all-positions', async (req, res) => {
  try {
    console.log('[API] Close all positions endpoint called');
    
    // Import the closeAllPositions function
    const { closeAllPositions } = await import('../hyperliquid/hyperliquid');
    
    console.log('[API] Calling closeAllPositions...');
    const result = await closeAllPositions();
    
    if (result.success) {
      console.log(`[API] Successfully closed ${result.closedCount} positions`);
      res.json({
        success: true,
        message: result.message || `Successfully closed ${result.closedCount} positions`,
        closedCount: result.closedCount,
        errorCount: result.errorCount,
        totalPositions: result.totalPositions
      });
    } else {
      console.error(`[API] Failed to close positions: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to close all positions',
        closedCount: result.closedCount || 0,
        errorCount: result.errorCount || 0,
        totalPositions: result.totalPositions || 0
      });
    }
  } catch (error) {
    console.error('[API] Error closing all positions:', error);
    res.status(500).json({
      success: false,
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

// Close all positions
app.post('/api/close-all-positions', async (req, res) => {
  try {
    const { privateKey, phoneNumber } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ 
        error: 'Private key is required' 
      });
    }

    console.log(`[API] Closing all positions for user ${phoneNumber || 'unknown'}`);
    
    // Import the closeAllPositions function from the hyperliquid module
    const { closeAllPositions } = await import('../hyperliquid/hyperliquid');
    
    // Call the closeAllPositions function
    const result = await closeAllPositions();
    
    if (result.success) {
      console.log(`[API] Successfully closed all positions`);
      res.json({ 
        success: true, 
        message: 'All positions closed successfully',
        details: result
      });
    } else {
      console.error(`[API] Failed to close all positions: ${result.error}`);
      res.status(400).json({ 
        success: false,
        error: result.error || 'Failed to close all positions'
      });
    }
  } catch (error) {
    console.error('[API] Error closing all positions:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get positions
app.get('/api/positions', async (req, res) => {
  try {
    // Import the hyperliquid module to get real positions
    const { getPositions } = await import('../hyperliquid/hyperliquid');
    
    const positions = await getPositions();
    
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    const openPositions = positions.length;
    
    res.json({
      positions,
      totalPnL,
      openPositions
    });
  } catch (error) {
    console.error('[API] Error getting positions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      positions: [],
      totalPnL: 0,
      openPositions: 0
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
