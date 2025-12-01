export interface TradingConfig {
    maxBudget: number;
    profitGoal: number;
    maxPerSession: number;
    sessionId: string;
    privateKey?: string;
}
export interface TradingResult {
    shouldRestart: boolean;
    reason: string;
    pnl: number;
    finalStatus: 'completed' | 'error' | 'stopped';
}
export declare class WebTradingBot {
    private isRunning;
    private shouldStop;
    private sessionId;
    private config;
    private pnl;
    private openPositions;
    private cycle;
    private totalLossToday;
    private tradesOpenedToday;
    private sessionStartTime;
    private readonly MAX_DAILY_LOSS_PERCENT;
    private readonly MAX_TRADES_PER_DAY;
    private readonly MIN_TIME_BETWEEN_TRADES_MS;
    startTrading(config: TradingConfig): Promise<void>;
    stopTrading(): void;
    private runTradingLoop;
    private closeAllPositions;
    getStatus(): {
        isRunning: boolean;
        sessionId: string;
        config: TradingConfig | null;
        pnl: number;
        openPositions: number;
        cycle: number;
    };
}
export declare const webTradingBot: WebTradingBot;
//# sourceMappingURL=web-trading-bot.d.ts.map