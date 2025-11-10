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
export declare class SimpleTradingBot {
    private session;
    private intervalId;
    startSession(config: TradingConfig): Promise<string>;
    private startTradingSimulation;
    private stopSimulation;
    stopSession(sessionId: string): boolean;
    getSessionStatus(sessionId: string): TradingSession | null;
    getAllSessions(): TradingSession[];
    cleanup(): void;
}
//# sourceMappingURL=trading-bot.d.ts.map