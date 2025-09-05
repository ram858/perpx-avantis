// winRateTracker.ts — tracks win/loss with PnL, score, and regime
import { enhancedLogger } from './enhancedLogger';

export interface TradeResult {
  symbol: string;
  entryTime: Date;
  exitTime?: Date;
  entryPrice: number;
  exitPrice?: number;
  positionSize: number;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'LIQUIDATED' | 'CLOSED_MANUAL';
  pnl?: number;
  reason?: string;
}

export interface WinRateStats {
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
}

export class WinRateTracker {
  private trades: TradeResult[] = [];
  private openTrades: Map<string, TradeResult> = new Map();

  /**
   * Record a new trade when it's opened
   */
  recordTradeOpen(
    symbol: string,
    entryPrice: number,
    positionSize: number,
    side: 'LONG' | 'SHORT'
  ): void {
    const trade: TradeResult = {
      symbol,
      entryTime: new Date(),
      entryPrice,
      positionSize,
      side,
      status: 'OPEN'
    };

    this.openTrades.set(symbol, trade);
    this.trades.push(trade);
    
    console.log(`📊 [WIN_RATE] Trade opened: ${symbol} ${side} @ $${entryPrice.toFixed(4)}`);
  }

  /**
   * Record when a trade is closed for take profit
   */
  recordTradeWin(
    symbol: string,
    exitPrice: number,
    pnl: number,
    reason: string = 'take_profit'
  ): void {
    const trade = this.openTrades.get(symbol);
    if (!trade) {
      console.warn(`⚠️ [WIN_RATE] No open trade found for ${symbol} when recording win`);
      return;
    }

    trade.exitTime = new Date();
    trade.exitPrice = exitPrice;
    trade.status = 'CLOSED_TP';
    trade.pnl = pnl;
    trade.reason = reason;

    this.openTrades.delete(symbol);
    
    // Enhanced logging for trade close
    const tradeDuration = trade.exitTime ? trade.exitTime.getTime() - trade.entryTime.getTime() : 0;
    enhancedLogger.logTradeClose(
      symbol,
      trade.side,
      trade.entryPrice,
      exitPrice,
      trade.positionSize,
      pnl,
      reason,
      tradeDuration,
      0 // Cycle number not available here
    );
    
    console.log(`✅ [WIN_RATE] WIN recorded: ${symbol} | PnL: $${pnl.toFixed(2)} | Reason: ${reason}`);
    this.logStats();
  }

  /**
   * Record when a trade is closed for stop loss
   */
  recordTradeLoss(
    symbol: string,
    exitPrice: number,
    pnl: number,
    reason: string = 'stop_loss'
  ): void {
    const trade = this.openTrades.get(symbol);
    if (!trade) {
      console.warn(`⚠️ [WIN_RATE] No open trade found for ${symbol} when recording loss`);
      return;
    }

    trade.exitTime = new Date();
    trade.exitPrice = exitPrice;
    trade.status = 'CLOSED_SL';
    trade.pnl = pnl;
    trade.reason = reason;

    this.openTrades.delete(symbol);
    
    // Enhanced logging for trade close
    const tradeDuration = trade.exitTime ? trade.exitTime.getTime() - trade.entryTime.getTime() : 0;
    enhancedLogger.logTradeClose(
      symbol,
      trade.side,
      trade.entryPrice,
      exitPrice,
      trade.positionSize,
      pnl,
      reason,
      tradeDuration,
      0 // Cycle number not available here
    );
    
    console.log(`❌ [WIN_RATE] LOSS recorded: ${symbol} | PnL: $${pnl.toFixed(2)} | Reason: ${reason}`);
    this.logStats();
  }

  /**
   * Record when a trade is liquidated
   */
  recordTradeLiquidated(
    symbol: string,
    exitPrice: number,
    pnl: number
  ): void {
    const trade = this.openTrades.get(symbol);
    if (!trade) {
      console.warn(`⚠️ [WIN_RATE] No open trade found for ${symbol} when recording liquidation`);
      return;
    }

    trade.exitTime = new Date();
    trade.exitPrice = exitPrice;
    trade.status = 'LIQUIDATED';
    trade.pnl = pnl;
    trade.reason = 'liquidation';

    this.openTrades.delete(symbol);
    
    console.log(`💥 [WIN_RATE] LIQUIDATION recorded: ${symbol} | PnL: $${pnl.toFixed(2)}`);
    this.logStats();
  }

  /**
   * Record when a trade is closed manually (e.g., session end)
   */
  recordTradeManualClose(
    symbol: string,
    exitPrice: number,
    pnl: number,
    reason: string = 'manual_close'
  ): void {
    const trade = this.openTrades.get(symbol);
    if (!trade) {
      console.warn(`⚠️ [WIN_RATE] No open trade found for ${symbol} when recording manual close`);
      return;
    }

    trade.exitTime = new Date();
    trade.exitPrice = exitPrice;
    trade.status = 'CLOSED_MANUAL';
    trade.pnl = pnl;
    trade.reason = reason;

    this.openTrades.delete(symbol);
    
    console.log(`🔧 [WIN_RATE] Manual close recorded: ${symbol} | PnL: $${pnl.toFixed(2)} | Reason: ${reason}`);
    this.logStats();
  }

  /**
   * Get current win rate statistics
   */
  getStats(): WinRateStats {
    const closedTrades = this.trades.filter(t => t.status !== 'OPEN');
    
    // Debug: Show all closed trades and their PnLs
    console.log(`🔍 [STATS_DEBUG] All closed trades:`);
    closedTrades.forEach(trade => {
      console.log(`   ${trade.symbol}: PnL=$${trade.pnl?.toFixed(2) || '0.00'}, Status=${trade.status}, Reason=${trade.reason || 'N/A'}`);
    });
    
    // Determine wins/losses based on actual PnL, not just status
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);
    
    console.log(`🔍 [STATS_DEBUG] Wins: ${wins.length} trades, Losses: ${losses.length} trades`);
    
    const totalTrades = closedTrades.length;
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    
    const allPnLs = closedTrades.map(t => t.pnl || 0);
    const totalPnL = allPnLs.reduce((sum, pnl) => sum + pnl, 0);
    const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
    
    const winPnLs = wins.map(t => t.pnl || 0);
    const lossPnLs = losses.map(t => t.pnl || 0);
    
    const largestWin = winPnLs.length > 0 ? Math.max(...winPnLs) : 0;
    const largestLoss = lossPnLs.length > 0 ? Math.min(...lossPnLs) : 0;
    const averageWin = winPnLs.length > 0 ? winPnLs.reduce((sum, pnl) => sum + pnl, 0) / winPnLs.length : 0;
    const averageLoss = lossPnLs.length > 0 ? lossPnLs.reduce((sum, pnl) => sum + pnl, 0) / lossPnLs.length : 0;

    return {
      totalTrades,
      wins: winCount,
      losses: lossCount,
      winRate,
      totalPnL,
      averagePnL,
      largestWin,
      largestLoss,
      averageWin,
      averageLoss
    };
  }

  /**
   * Log current statistics
   */
  logStats(): void {
    const stats = this.getStats();
    const openCount = this.openTrades.size;
    
    console.log(`\n📊 [WIN_RATE] Current Statistics:`);
    console.log(`   Total Trades: ${stats.totalTrades}`);
    console.log(`   Wins: ${stats.wins} | Losses: ${stats.losses}`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(2)}%`);
    console.log(`   Total PnL: $${stats.totalPnL.toFixed(2)}`);
    console.log(`   Average PnL: $${stats.averagePnL.toFixed(2)}`);
    console.log(`   Largest Win: $${stats.largestWin.toFixed(2)}`);
    console.log(`   Largest Loss: $${stats.largestLoss.toFixed(2)}`);
    console.log(`   Average Win: $${stats.averageWin.toFixed(2)}`);
    console.log(`   Average Loss: $${stats.averageLoss.toFixed(2)}`);
    console.log(`   Open Positions: ${openCount}\n`);
  }

  /**
   * Get detailed trade history
   */
  getTradeHistory(): TradeResult[] {
    return [...this.trades];
  }

  /**
   * Get open trades
   */
  getOpenTrades(): TradeResult[] {
    return Array.from(this.openTrades.values());
  }

  /**
   * Check if a symbol has an open trade
   */
  hasOpenTrade(symbol: string): boolean {
    return this.openTrades.has(symbol);
  }

  /**
   * Get open trade for a symbol
   */
  getOpenTrade(symbol: string): TradeResult | undefined {
    return this.openTrades.get(symbol);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.trades = [];
    this.openTrades.clear();
  }
}

// Export a singleton instance
export const winRateTracker = new WinRateTracker();