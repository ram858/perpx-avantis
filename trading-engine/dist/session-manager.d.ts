import WebSocket from 'ws';
export interface TradingConfig {
    maxBudget: number;
    profitGoal: number;
    maxPerSession: number;
    userPhoneNumber?: string;
    walletAddress?: string;
    userFid?: number;
    isBaseAccount?: boolean;
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
    private monitorBaseAccountSession;
    private updateSessionStatus;
    private broadcastUpdate;
    subscribeToUpdates(sessionId: string, ws: WebSocket): void;
    unsubscribeFromUpdates(sessionId: string, ws: WebSocket): void;
    /**
     * Get wallet address for a session (for Base Account queries)
     */
    getSessionWalletAddress(sessionId: string): string | undefined;
    /**
     * Check if a session is using Base Account
     */
    isSessionBaseAccount(sessionId: string): boolean;
    getSessionStatus(sessionId: string): SessionStatus | null;
    getAllSessions(): SessionStatus[];
    stopSession(sessionId: string): boolean;
    forceStopSession(sessionId: string): boolean;
    cleanup(): void;
}
//# sourceMappingURL=session-manager.d.ts.map