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