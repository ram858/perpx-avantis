import fs from 'fs';
import path from 'path';

// Enhanced logging system for comprehensive data collection
export interface TradeLogEntry {
  timestamp: string;
  event: 'TRADE_OPEN' | 'TRADE_CLOSE' | 'SIGNAL_GENERATED' | 'POSITION_UPDATE' | 'SESSION_START' | 'SESSION_END' | 'ERROR' | 'SYSTEM';
  symbol?: string;
  side?: 'LONG' | 'SHORT';
  entryPrice?: number;
  exitPrice?: number;
  positionSize?: number;
  pnl?: number;
  pnlPercent?: number;
  reason?: string;
  marketRegime?: string;
  signalScore?: number;
  leverage?: number;
  budget?: number;
  rsi?: number;
  macdHist?: number;
  emaSlope?: number;
  atrPct?: number;
  adx?: number;
  volumePct?: number;
  divergenceScore?: number;
  sessionId?: string;
  cycleNumber?: number;
  totalPnL?: number;
  openPositions?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  timestamp: string;
  sessionId: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
  largestWin: number;
  largestLoss: number;
  averageWin: number;
  averageLoss: number;
  totalROI: number;
  sessionDuration: number;
  averageTradeDuration: number;
  profitFactor: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

export class EnhancedLogger {
  private tradeLogPath: string;
  private performanceLogPath: string;
  private systemLogPath: string;
  private sessionStartTime: Date | null = null;
  private currentSessionId: string | null = null;

  constructor() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.tradeLogPath = path.join(logsDir, 'enhanced_trade_logs.jsonl');
    this.performanceLogPath = path.join(logsDir, 'performance_metrics.jsonl');
    this.systemLogPath = path.join(logsDir, 'system_logs.jsonl');
  }

  /**
   * Start a new trading session
   */
  startSession(sessionId: string, config: { budget: number; profitGoal: number; maxPositions: number }): void {
    this.sessionStartTime = new Date();
    this.currentSessionId = sessionId;
    
    this.logTrade({
      event: 'SESSION_START',
      sessionId,
      budget: config.budget,
      metadata: {
        profitGoal: config.profitGoal,
        maxPositions: config.maxPositions,
        timestamp: this.sessionStartTime.toISOString()
      }
    });

    console.log(`📊 [LOGGER] Session ${sessionId} started at ${this.sessionStartTime.toISOString()}`);
  }

  /**
   * End the current trading session
   */
  endSession(reason: string, finalPnL: number, stats: any): void {
    if (!this.sessionStartTime || !this.currentSessionId) {
      console.warn('⚠️ [LOGGER] No active session to end');
      return;
    }

    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    
    this.logTrade({
      event: 'SESSION_END',
      sessionId: this.currentSessionId || undefined,
      totalPnL: finalPnL,
      reason,
      metadata: {
        sessionDuration,
        finalStats: stats,
        timestamp: new Date().toISOString()
      }
    });

    // Log performance metrics
    this.logPerformance({
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      totalTrades: stats.totalTrades || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      winRate: stats.winRate || 0,
      totalPnL: finalPnL,
      averagePnL: stats.averagePnL || 0,
      largestWin: stats.largestWin || 0,
      largestLoss: stats.largestLoss || 0,
      averageWin: stats.averageWin || 0,
      averageLoss: stats.averageLoss || 0,
      totalROI: stats.totalROI || 0,
      sessionDuration: sessionDuration / 1000, // Convert to seconds
      averageTradeDuration: stats.averageTradeDuration || 0,
      profitFactor: stats.profitFactor || 0
    });

    console.log(`📊 [LOGGER] Session ${this.currentSessionId} ended | Duration: ${(sessionDuration / 1000 / 60).toFixed(2)}min | PnL: $${finalPnL.toFixed(2)}`);
    
    this.sessionStartTime = null;
    this.currentSessionId = null;
  }

  /**
   * Log a trade event
   */
  logTrade(entry: Partial<TradeLogEntry>): void {
    const logEntry: TradeLogEntry = {
      timestamp: new Date().toISOString(),
      event: entry.event || 'SYSTEM',
      ...entry
    };

    try {
      fs.appendFileSync(this.tradeLogPath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('❌ [LOGGER] Failed to write trade log:', error);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(metrics: PerformanceMetrics): void {
    try {
      fs.appendFileSync(this.performanceLogPath, JSON.stringify(metrics) + '\n');
    } catch (error) {
      console.error('❌ [LOGGER] Failed to write performance log:', error);
    }
  }

  /**
   * Log system events
   */
  logSystem(event: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      sessionId: this.currentSessionId
    };

    try {
      fs.appendFileSync(this.systemLogPath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('❌ [LOGGER] Failed to write system log:', error);
    }
  }

  /**
   * Log trade opening
   */
  logTradeOpen(
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    positionSize: number,
    leverage: number,
    signalData: {
      marketRegime: string;
      signalScore: number;
      rsi: number;
      macdHist: number;
      emaSlope: number;
      atrPct: number;
      adx: number;
      volumePct: number;
      divergenceScore: number;
    },
    cycleNumber: number
  ): void {
    this.logTrade({
      event: 'TRADE_OPEN',
      symbol,
      side,
      entryPrice,
      positionSize,
      leverage,
      marketRegime: signalData.marketRegime,
      signalScore: signalData.signalScore,
      rsi: signalData.rsi,
      macdHist: signalData.macdHist,
      emaSlope: signalData.emaSlope,
      atrPct: signalData.atrPct,
      adx: signalData.adx,
      volumePct: signalData.volumePct,
      divergenceScore: signalData.divergenceScore,
      sessionId: this.currentSessionId || undefined,
      cycleNumber
    });

    console.log(`📊 [LOGGER] Trade opened: ${symbol} ${side} @ $${entryPrice.toFixed(4)} | Score: ${(signalData.signalScore * 100).toFixed(1)}% | Regime: ${signalData.marketRegime}`);
  }

  /**
   * Log trade closing
   */
  logTradeClose(
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    exitPrice: number,
    positionSize: number,
    pnl: number,
    reason: string,
    tradeDuration: number,
    cycleNumber: number
  ): void {
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    
    this.logTrade({
      event: 'TRADE_CLOSE',
      symbol,
      side,
      entryPrice,
      exitPrice,
      positionSize,
      pnl,
      pnlPercent,
      reason,
      sessionId: this.currentSessionId || undefined,
      cycleNumber,
      metadata: {
        tradeDuration,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📊 [LOGGER] Trade closed: ${symbol} ${side} | Entry: $${entryPrice.toFixed(4)} | Exit: $${exitPrice.toFixed(4)} | PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%) | Reason: ${reason}`);
  }

  /**
   * Log signal generation
   */
  logSignalGenerated(
    symbol: string,
    signalData: {
      marketRegime: string;
      signalScore: number;
      rsi: number;
      macdHist: number;
      emaSlope: number;
      atrPct: number;
      adx: number;
      volumePct: number;
      divergenceScore: number;
      shouldOpen: boolean;
      reason: string;
    },
    cycleNumber: number
  ): void {
    this.logTrade({
      event: 'SIGNAL_GENERATED',
      symbol,
      marketRegime: signalData.marketRegime,
      signalScore: signalData.signalScore,
      rsi: signalData.rsi,
      macdHist: signalData.macdHist,
      emaSlope: signalData.emaSlope,
      atrPct: signalData.atrPct,
      adx: signalData.adx,
      volumePct: signalData.volumePct,
      divergenceScore: signalData.divergenceScore,
      sessionId: this.currentSessionId || undefined,
      cycleNumber,
      metadata: {
        shouldOpen: signalData.shouldOpen,
        reason: signalData.reason
      }
    });
  }

  /**
   * Log position updates
   */
  logPositionUpdate(
    symbol: string,
    currentPrice: number,
    pnl: number,
    openPositions: number,
    totalPnL: number,
    cycleNumber: number
  ): void {
    this.logTrade({
      event: 'POSITION_UPDATE',
      symbol,
      exitPrice: currentPrice,
      pnl,
      totalPnL,
      openPositions,
      sessionId: this.currentSessionId || undefined,
      cycleNumber
    });
  }

  /**
   * Log errors
   */
  logError(error: Error, context?: string): void {
    this.logTrade({
      event: 'ERROR',
      errorMessage: error.message,
      sessionId: this.currentSessionId || undefined,
      metadata: {
        context,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });

    console.error(`❌ [LOGGER] Error${context ? ` in ${context}` : ''}: ${error.message}`);
  }

  /**
   * Get log file paths
   */
  getLogPaths(): { tradeLog: string; performanceLog: string; systemLog: string } {
    return {
      tradeLog: this.tradeLogPath,
      performanceLog: this.performanceLogPath,
      systemLog: this.systemLogPath
    };
  }
}

// Export singleton instance
export const enhancedLogger = new EnhancedLogger();
