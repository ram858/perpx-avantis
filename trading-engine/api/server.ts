import express from 'express';
import cors from 'cors';
import { TradingSessionManager } from '../session-manager';

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://avantis.superapp.gg'] 
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
    const { 
      maxBudget, 
      profitGoal, 
      maxPerSession, 
      hyperliquidApiWallet, 
      userPhoneNumber, 
      walletAddress,
      isBaseAccount = true // Flag for Base Account sessions
    } = req.body;

    // Validate input
    if (!maxBudget || !profitGoal || !maxPerSession) {
      return res.status(400).json({ 
        error: 'Missing required parameters: maxBudget, profitGoal, maxPerSession' 
      });
    }

    // For Base Account sessions, walletAddress is required but no private key
    if (isBaseAccount) {
      if (!walletAddress) {
        return res.status(400).json({ 
          error: 'walletAddress is required for Base Account sessions' 
        });
      }
      console.log(`[API] Starting Base Account session for wallet ${walletAddress}`);
    } else {
      // For traditional wallets, both private key and wallet address are required
      if (!hyperliquidApiWallet || !userPhoneNumber || !walletAddress) {
        return res.status(400).json({ 
          error: 'Missing wallet data: hyperliquidApiWallet, userPhoneNumber, walletAddress are required for traditional wallets' 
        });
      }
      // Set the Hyperliquid private key for this session
      process.env.HYPERLIQUID_PK = hyperliquidApiWallet;
      console.log(`[API] Set HYPERLIQUID_PK for user ${userPhoneNumber} with wallet ${walletAddress}`);
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
      maxPerSession: parseInt(maxPerSession),
      userPhoneNumber: userPhoneNumber || undefined, // Optional for Base Accounts
      walletAddress,
      isBaseAccount: Boolean(isBaseAccount)
    });

    console.log(`[API] Started trading session ${sessionId} for ${isBaseAccount ? 'Base Account' : 'traditional wallet'}`);
    res.json({ 
      sessionId, 
      status: 'started',
      config: { maxBudget, profitGoal, maxPerSession },
      user: { phoneNumber: userPhoneNumber, walletAddress, isBaseAccount }
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

// Close all positions (for traditional wallets with private key)
app.post('/api/close-all-positions', async (req, res) => {
  try {
    const { privateKey, phoneNumber, sessionId } = req.body;
    
    // Check if this is a Base Account session
    if (sessionId) {
      const isBaseAccount = sessionManager.isSessionBaseAccount(sessionId);
      if (isBaseAccount) {
        return res.status(400).json({
          error: 'Base Account sessions cannot use this endpoint. Use /api/trading/prepare-transaction with action="close" for each position.'
        });
      }
    }
    
    if (!privateKey) {
      return res.status(400).json({ 
        error: 'Private key is required for traditional wallets' 
      });
    }

    console.log(`[API] Closing all positions for user ${phoneNumber || 'unknown'}`);
    
    // For Avantis: Call Avantis service
    const avantisApiUrl = process.env.AVANTIS_API_URL || 'http://localhost:8000';
    try {
      const response = await fetch(`${avantisApiUrl}/api/close-all-positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          private_key: privateKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: response.statusText })) as { detail?: string };
        throw new Error(errorData.detail || `Avantis API error: ${response.statusText}`);
      }

      const result = await response.json() as { closed_count?: number; [key: string]: unknown };
      res.json({
        success: true,
        message: `Successfully closed ${result.closed_count || 0} positions`,
        details: result
      });
    } catch (avantisError) {
      console.error('[API] Error calling Avantis service:', avantisError);
      // Fallback to Hyperliquid if Avantis fails (for backward compatibility)
      const { closeAllPositions } = await import('../hyperliquid/hyperliquid');
      const result = await closeAllPositions();
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'All positions closed successfully',
          details: result
        });
      } else {
        res.status(400).json({ 
          success: false,
          error: result.error || 'Failed to close all positions'
        });
      }
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

// Prepare transaction for Base Account signing (without executing)
app.post('/api/trading/prepare-transaction', async (req, res) => {
  try {
    const {
      sessionId,
      action, // 'open' or 'close'
      symbol,
      collateral,
      leverage,
      is_long,
      pair_index, // For close action
      tp, // Take profit (optional)
      sl, // Stop loss (optional)
    } = req.body;

    // Validate input
    if (!sessionId || !action) {
      return res.status(400).json({
        error: 'Missing required parameters: sessionId and action are required'
      });
    }

    // Get session info
    const status = sessionManager.getSessionStatus(sessionId);
    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isBaseAccount = sessionManager.isSessionBaseAccount(sessionId);
    if (!isBaseAccount) {
      return res.status(400).json({
        error: 'This endpoint is only for Base Account sessions. Use regular trading endpoints for traditional wallets.'
      });
    }

    const walletAddress = sessionManager.getSessionWalletAddress(sessionId);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address not found for session' });
    }

    // Get Avantis API URL from environment
    const avantisApiUrl = process.env.AVANTIS_API_URL || 'http://localhost:8000';
    
    // Call Avantis service to prepare transaction
    type AvantisPrepareResponse = {
      transaction: unknown;
      params: unknown;
      address?: string;
      note?: string;
    };

    let avantisResponse: AvantisPrepareResponse | null = null;
    try {
      if (action === 'open') {
        if (!symbol || !collateral || !leverage || is_long === undefined) {
          return res.status(400).json({
            error: 'Missing required parameters for open action: symbol, collateral, leverage, is_long'
          });
        }

        // Call Avantis service prepare endpoint
        const response = await fetch(`${avantisApiUrl}/api/prepare/open-position`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            collateral: parseFloat(collateral),
            leverage: parseInt(leverage),
            is_long: Boolean(is_long),
            address: walletAddress,
            tp: tp ? parseFloat(tp) : undefined,
            sl: sl ? parseFloat(sl) : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ detail: response.statusText })) as { detail?: string };
          throw new Error(errorData.detail || `Avantis API error: ${response.statusText}`);
        }

        avantisResponse = await response.json() as AvantisPrepareResponse;
      } else if (action === 'close') {
        if (!pair_index) {
          return res.status(400).json({
            error: 'Missing required parameter for close action: pair_index'
          });
        }

        // Call Avantis service prepare endpoint
        const response = await fetch(`${avantisApiUrl}/api/prepare/close-position`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pair_index: parseInt(pair_index),
            address: walletAddress,
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ detail: response.statusText })) as { detail?: string };
          throw new Error(errorData.detail || `Avantis API error: ${response.statusText}`);
        }

        avantisResponse = await response.json() as AvantisPrepareResponse;
      } else {
        return res.status(400).json({ error: 'Invalid action. Must be "open" or "close"' });
      }

      // Return transaction data from Avantis service
      if (!avantisResponse) {
        throw new Error('Empty response from Avantis service');
      }

      res.json({
        success: true,
        transaction: avantisResponse.transaction,
        params: avantisResponse.params,
        address: avantisResponse.address,
        note: avantisResponse.note || 'Sign this transaction via Base Account SDK on the frontend',
      });
    } catch (avantisError) {
      console.error('[API] Error calling Avantis service:', avantisError);
      return res.status(502).json({
        error: 'Failed to prepare transaction with Avantis service',
        details: avantisError instanceof Error ? avantisError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('[API] Error preparing transaction:', error);
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
