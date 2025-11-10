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
export declare class WinRateTracker {
    private trades;
    private openTrades;
    /**
     * Record a new trade when it's opened
     */
    recordTradeOpen(symbol: string, entryPrice: number, positionSize: number, side: 'LONG' | 'SHORT'): void;
    /**
     * Record when a trade is closed for take profit
     */
    recordTradeWin(symbol: string, exitPrice: number, pnl: number, reason?: string): void;
    /**
     * Record when a trade is closed for stop loss
     */
    recordTradeLoss(symbol: string, exitPrice: number, pnl: number, reason?: string): void;
    /**
     * Record when a trade is liquidated
     */
    recordTradeLiquidated(symbol: string, exitPrice: number, pnl: number): void;
    /**
     * Record when a trade is closed manually (e.g., session end)
     */
    recordTradeManualClose(symbol: string, exitPrice: number, pnl: number, reason?: string): void;
    /**
     * Get current win rate statistics
     */
    getStats(): WinRateStats;
    /**
     * Log current statistics
     */
    logStats(): void;
    /**
     * Get detailed trade history
     */
    getTradeHistory(): TradeResult[];
    /**
     * Get open trades
     */
    getOpenTrades(): TradeResult[];
    /**
     * Check if a symbol has an open trade
     */
    hasOpenTrade(symbol: string): boolean;
    /**
     * Get open trade for a symbol
     */
    getOpenTrade(symbol: string): TradeResult | undefined;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
}
export declare const winRateTracker: WinRateTracker;
//# sourceMappingURL=winRateTracker.d.ts.map