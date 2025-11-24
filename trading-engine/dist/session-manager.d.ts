import WebSocket from 'ws';
export interface TradingConfig {
    maxBudget: number;
    profitGoal: number;
    maxPerSession: number;
    lossThreshold?: number;
    userPhoneNumber?: string;
    walletAddress?: string;
    userFid?: number;
    privateKey?: string;
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
export declare class TradingSessionManager {
    private tradingBot;
    private sessions;
    constructor();
    startSession(config: TradingConfig): Promise<string>;
    private startSessionMonitoring;
    private updateSessionStatus;
    private broadcastUpdate;
    subscribeToUpdates(sessionId: string, ws: WebSocket): void;
    unsubscribeFromUpdates(sessionId: string, ws: WebSocket): void;
    /**
     * Get wallet address for a session
     */
    getSessionWalletAddress(sessionId: string): string | undefined;
    private sanitizeSessionStatus;
    getSessionStatus(sessionId: string): (Omit<SessionStatus, 'config'> & {
        config: Omit<TradingConfig, 'privateKey'>;
    }) | null;
    getAllSessions(): (Omit<SessionStatus, 'config'> & {
        config: Omit<TradingConfig, 'privateKey'>;
    })[];
    stopSession(sessionId: string): boolean;
    forceStopSession(sessionId: string): boolean;
    cleanup(): void;
}
//# sourceMappingURL=session-manager.d.ts.map