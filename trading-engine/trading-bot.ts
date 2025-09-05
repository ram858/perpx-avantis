import dotenv from 'dotenv';
dotenv.config();

import Decimal from 'decimal.js';

// Simplified trading bot for demo purposes
// In production, this would integrate with the full Hyperliquid engine

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
}

export interface TradingSession {
  sessionId: string;
  config: TradingConfig;
  status: 'running' | 'stopped' | 'completed' | 'error';
  pnl: number;
  openPositions: number;
  cycle: number;
  startTime: Date;
  lastUpdate: Date;
}

export class SimpleTradingBot {
  private session: TradingSession | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  async startSession(config: TradingConfig): Promise<string> {
    const sessionId = `session_${Date.now()}`;
    
    this.session = {
      sessionId,
      config,
      status: 'running',
      pnl: 0,
      openPositions: 0,
      cycle: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    console.log(`[TRADING_BOT] Starting session ${sessionId} with config:`, config);

    // Simulate trading activity
    this.startTradingSimulation();

    return sessionId;
  }

  private startTradingSimulation() {
    if (!this.session) return;

    this.intervalId = setInterval(() => {
      if (!this.session || this.session.status !== 'running') {
        this.stopSimulation();
        return;
      }

      // Simulate trading cycle
      this.session.cycle++;
      this.session.lastUpdate = new Date();

      // Simulate PnL changes (random walk with slight upward bias)
      const change = (Math.random() - 0.4) * 2; // Slight positive bias
      this.session.pnl += change;

      // Simulate position changes
      if (Math.random() > 0.7) {
        this.session.openPositions = Math.min(
          this.session.config.maxPerSession,
          this.session.openPositions + (Math.random() > 0.5 ? 1 : -1)
        );
        this.session.openPositions = Math.max(0, this.session.openPositions);
      }

      // Check if profit goal reached
      if (this.session.pnl >= this.session.config.profitGoal) {
        this.session.status = 'completed';
        console.log(`[TRADING_BOT] Session ${this.session.sessionId} completed! PnL: $${this.session.pnl.toFixed(2)}`);
        this.stopSimulation();
      }

      // Check if budget exhausted (simplified)
      if (this.session.pnl <= -this.session.config.maxBudget * 0.8) {
        this.session.status = 'error';
        console.log(`[TRADING_BOT] Session ${this.session.sessionId} stopped due to losses`);
        this.stopSimulation();
      }

      console.log(`[TRADING_BOT] Cycle ${this.session.cycle}: PnL=$${this.session.pnl.toFixed(2)}, Positions=${this.session.openPositions}`);
    }, 5000); // Update every 5 seconds
  }

  private stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  stopSession(sessionId: string): boolean {
    if (this.session && this.session.sessionId === sessionId) {
      this.session.status = 'stopped';
      this.stopSimulation();
      console.log(`[TRADING_BOT] Session ${sessionId} stopped`);
      return true;
    }
    return false;
  }

  getSessionStatus(sessionId: string): TradingSession | null {
    if (this.session && this.session.sessionId === sessionId) {
      return { ...this.session };
    }
    return null;
  }

  getAllSessions(): TradingSession[] {
    return this.session ? [{ ...this.session }] : [];
  }

  cleanup() {
    this.stopSimulation();
    this.session = null;
  }
}
