import WebSocket from 'ws';
import { SimpleTradingBot } from './trading-bot';

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
  userPhoneNumber?: string;
  walletAddress?: string;
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
  private tradingBot: SimpleTradingBot;
  private sessions: Map<string, {
    config: TradingConfig;
    status: SessionStatus;
    subscribers: Set<WebSocket>;
  }> = new Map();

  constructor() {
    this.tradingBot = new SimpleTradingBot();
  }

  async startSession(config: TradingConfig): Promise<string> {
    const sessionId = await this.tradingBot.startSession(config);
    
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
      subscribers: new Set<WebSocket>()
    };

    this.sessions.set(sessionId, session);

    // Start monitoring the session
    this.startSessionMonitoring(sessionId);

    return sessionId;
  }

  private startSessionMonitoring(sessionId: string) {
    const monitorInterval = setInterval(() => {
      const botSession = this.tradingBot.getSessionStatus(sessionId);
      const session = this.sessions.get(sessionId);
      
      if (!botSession || !session) {
        clearInterval(monitorInterval);
        return;
      }

      // Update session status from bot
      session.status = {
        ...session.status,
        pnl: botSession.pnl,
        openPositions: botSession.openPositions,
        cycle: botSession.cycle,
        status: botSession.status,
        lastUpdate: botSession.lastUpdate
      };

      this.broadcastUpdate(sessionId);

      // Clean up if session is completed or stopped
      if (botSession.status === 'completed' || botSession.status === 'error') {
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
      this.tradingBot.stopSession(sessionId);
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
    this.tradingBot.cleanup();
    this.sessions.clear();
  }
}
