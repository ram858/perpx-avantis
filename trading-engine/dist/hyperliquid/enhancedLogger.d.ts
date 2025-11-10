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
export declare class EnhancedLogger {
    private tradeLogPath;
    private performanceLogPath;
    private systemLogPath;
    private sessionStartTime;
    private currentSessionId;
    constructor();
    /**
     * Start a new trading session
     */
    startSession(sessionId: string, config: {
        budget: number;
        profitGoal: number;
        maxPositions: number;
    }): void;
    /**
     * End the current trading session
     */
    endSession(reason: string, finalPnL: number, stats: any): void;
    /**
     * Log a trade event
     */
    logTrade(entry: Partial<TradeLogEntry>): void;
    /**
     * Log performance metrics
     */
    logPerformance(metrics: PerformanceMetrics): void;
    /**
     * Log system events
     */
    logSystem(event: string, data?: any): void;
    /**
     * Log trade opening
     */
    logTradeOpen(symbol: string, side: 'LONG' | 'SHORT', entryPrice: number, positionSize: number, leverage: number, signalData: {
        marketRegime: string;
        signalScore: number;
        rsi: number;
        macdHist: number;
        emaSlope: number;
        atrPct: number;
        adx: number;
        volumePct: number;
        divergenceScore: number;
    }, cycleNumber: number): void;
    /**
     * Log trade closing
     */
    logTradeClose(symbol: string, side: 'LONG' | 'SHORT', entryPrice: number, exitPrice: number, positionSize: number, pnl: number, reason: string, tradeDuration: number, cycleNumber: number): void;
    /**
     * Log signal generation
     */
    logSignalGenerated(symbol: string, signalData: {
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
    }, cycleNumber: number): void;
    /**
     * Log position updates
     */
    logPositionUpdate(symbol: string, currentPrice: number, pnl: number, openPositions: number, totalPnL: number, cycleNumber: number): void;
    /**
     * Log errors
     */
    logError(error: Error, context?: string): void;
    /**
     * Get log file paths
     */
    getLogPaths(): {
        tradeLog: string;
        performanceLog: string;
        systemLog: string;
    };
}
export declare const enhancedLogger: EnhancedLogger;
//# sourceMappingURL=enhancedLogger.d.ts.map