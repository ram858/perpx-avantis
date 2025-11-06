import WebSocket from 'ws';
// Dynamic import to avoid build errors during Avantis migration
let WebTradingBot: any;
try {
  const hyperliquidModule = require('./hyperliquid/web-trading-bot');
  WebTradingBot = hyperliquidModule.WebTradingBot;
} catch (error) {
  console.warn('[SESSION_MANAGER] Hyperliquid module not available, using placeholder');
  // Placeholder class for when Hyperliquid is not available
  WebTradingBot = class PlaceholderTradingBot {
    async startTrading() { console.log('[PLACEHOLDER] Trading bot placeholder'); }
    async stop() { console.log('[PLACEHOLDER] Stop placeholder'); }
    getStatus() { return { pnl: 0, positions: [] }; }
  };
}

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
  userPhoneNumber?: string;
  walletAddress?: string;
  userFid?: number; // Base Account FID
  isBaseAccount?: boolean; // Flag indicating Base Account (no private key)
}

export interface SessionStatus {
  sessionId: string;
  status: 'running' | 'stopped' | 'completed' | 'error';
  pnl: number;
  openPositions: number;
  cycle: number;
  lastUpdate: Date;
  config: TradingConfig;
  error?: string;
}

export class TradingSessionManager {
  private tradingBot: InstanceType<typeof WebTradingBot>;
  private sessions: Map<string, {
    config: TradingConfig;
    status: SessionStatus;
    subscribers: Set<WebSocket>;
    walletAddress?: string; // Store wallet address for Base Account queries
    isBaseAccount?: boolean; // Flag for Base Account sessions
  }> = new Map();

  constructor() {
    this.tradingBot = new WebTradingBot();
  }

  async startSession(config: TradingConfig): Promise<string> {
    const sessionId = `session_${Date.now()}`;
    
    // Create config with sessionId
    const botConfig = {
      ...config,
      sessionId
    };
    
    // Start the real trading bot
    await this.tradingBot.startTrading(botConfig);
    
    console.log(`[SESSION_MANAGER] Starting session ${sessionId} with config:`, config);

    const session = {
      config,
      status: {
        sessionId,
        status: 'running' as const,
        pnl: 0,
        openPositions: 0,
        cycle: 0,
        lastUpdate: new Date(),
        config
      },
      subscribers: new Set<WebSocket>(),
      walletAddress: config.walletAddress, // Store for Base Account queries
      isBaseAccount: config.isBaseAccount || false // Store Base Account flag
    };

    this.sessions.set(sessionId, session);
    
    // Log Base Account session info
    if (config.isBaseAccount) {
      console.log(`[SESSION_MANAGER] Base Account session ${sessionId} with address ${config.walletAddress}`);
      console.log(`[SESSION_MANAGER] Note: Automated trading disabled - transactions must be signed via Base Account SDK`);
    }

    // Start monitoring the session
    this.startSessionMonitoring(sessionId);

    return sessionId;
  }

  private startSessionMonitoring(sessionId: string) {
    const monitorInterval = setInterval(() => {
      const botStatus = this.tradingBot.getStatus();
      const session = this.sessions.get(sessionId);
      
      if (!botStatus || !session) {
        clearInterval(monitorInterval);
        return;
      }

      // Update session status from bot
      session.status = {
        ...session.status,
        pnl: botStatus.pnl || 0,
        openPositions: botStatus.openPositions || 0,
        cycle: botStatus.cycle || 0,
        status: botStatus.isRunning ? 'running' : 'stopped',
        lastUpdate: new Date()
      };

      this.broadcastUpdate(sessionId);

      // Clean up if session is completed or stopped
      if (!botStatus.isRunning) {
        clearInterval(monitorInterval);
        setTimeout(() => {
          this.sessions.delete(sessionId);
        }, 30000);
      }
    }, 1000); // Check every second
  }


  private updateSessionStatus(sessionId: string, updates: Partial<SessionStatus>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = { ...session.status, ...updates };
    this.broadcastUpdate(sessionId);
  }

  private broadcastUpdate(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const update = {
      type: 'trading_update',
      data: session.status
    };

    // Security: Remove debug logging in production

    session.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(update));
        } catch (error) {
          // Security: Remove error logging in production
          session.subscribers.delete(ws);
        }
      } else {
        session.subscribers.delete(ws);
      }
    });
  }

  subscribeToUpdates(sessionId: string, ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.add(ws);
      console.log(`[SESSION_MANAGER] Client subscribed to session ${sessionId}`);
      
      // Send current status immediately
      const update = {
        type: 'trading_update',
        data: session.status
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(update));
      }
    } else {
      console.warn(`[SESSION_MANAGER] Attempted to subscribe to non-existent session ${sessionId}`);
    }
  }

  unsubscribeFromUpdates(sessionId: string, ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.delete(ws);
      console.log(`[SESSION_MANAGER] Client unsubscribed from session ${sessionId}`);
    }
  }

  /**
   * Get wallet address for a session (for Base Account queries)
   */
  getSessionWalletAddress(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.walletAddress || session?.config.walletAddress;
  }

  /**
   * Check if a session is using Base Account
   */
  isSessionBaseAccount(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.isBaseAccount || false;
  }

  getSessionStatus(sessionId: string): SessionStatus | null {
    const session = this.sessions.get(sessionId);
    return session ? session.status : null;
  }

  getAllSessions(): SessionStatus[] {
    return Array.from(this.sessions.values()).map(session => session.status);
  }

  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[SESSION_MANAGER] Stopping session ${sessionId}`);
      this.tradingBot.stopTrading();
      this.updateSessionStatus(sessionId, { status: 'stopped', lastUpdate: new Date() });
      return true;
    }
    return false;
  }

  forceStopSession(sessionId: string): boolean {
    return this.stopSession(sessionId);
  }

  cleanup() {
    console.log('[SESSION_MANAGER] Cleaning up all sessions');
    this.tradingBot.stopTrading();
    this.sessions.clear();
  }
}
