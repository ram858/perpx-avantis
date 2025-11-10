import { TradingSessionManager } from '../session-manager.js';
export interface WebSocketMessage {
    type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
    sessionId?: string;
    data?: any;
}
export declare class TradingWebSocketServer {
    private wss;
    private sessionManager;
    private port;
    private pingInterval;
    constructor(port: number, sessionManager: TradingSessionManager);
    private setupWebSocketServer;
    private handleMessage;
    private sendMessage;
    private sendError;
    private cleanupClient;
    private startPingInterval;
    private stopPingInterval;
    getConnectedClients(): number;
    broadcast(message: any): void;
    close(): void;
}
//# sourceMappingURL=server.d.ts.map