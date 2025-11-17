"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingWebSocketServer = void 0;
const ws_1 = require("ws");
class TradingWebSocketServer {
    constructor(port, sessionManager) {
        this.pingInterval = null;
        this.port = port;
        this.sessionManager = sessionManager;
        this.wss = new ws_1.WebSocketServer({
            port,
            perMessageDeflate: false // Disable compression for better performance
        });
        this.setupWebSocketServer();
        this.startPingInterval();
        console.log(`[WEBSOCKET] Server started on port ${port}`);
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            const clientIP = req.socket.remoteAddress;
            console.log(`[WEBSOCKET] Client connected from ${clientIP}`);
            // Set up message handling
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(ws, data);
                }
                catch (error) {
                    console.error('[WEBSOCKET] Invalid message format:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            // Handle connection close
            ws.on('close', (code, reason) => {
                console.log(`[WEBSOCKET] Client disconnected (${code}): ${reason}`);
                this.cleanupClient(ws);
            });
            // Handle connection errors
            ws.on('error', (error) => {
                console.error('[WEBSOCKET] Client error:', error);
                this.cleanupClient(ws);
            });
            // Send welcome message
            this.sendMessage(ws, {
                type: 'pong',
                data: { message: 'Connected to trading WebSocket server' }
            });
        });
        // Handle server errors
        this.wss.on('error', (error) => {
            console.error('[WEBSOCKET] Server error:', error);
        });
    }
    handleMessage(ws, message) {
        switch (message.type) {
            case 'subscribe':
                if (message.sessionId) {
                    this.sessionManager.subscribeToUpdates(message.sessionId, ws);
                    this.sendMessage(ws, {
                        type: 'pong',
                        data: { message: `Subscribed to session ${message.sessionId}` }
                    });
                }
                else {
                    this.sendError(ws, 'Session ID required for subscription');
                }
                break;
            case 'unsubscribe':
                if (message.sessionId) {
                    this.sessionManager.unsubscribeFromUpdates(message.sessionId, ws);
                    this.sendMessage(ws, {
                        type: 'pong',
                        data: { message: `Unsubscribed from session ${message.sessionId}` }
                    });
                }
                else {
                    this.sendError(ws, 'Session ID required for unsubscription');
                }
                break;
            case 'ping':
                this.sendMessage(ws, { type: 'pong', data: { timestamp: Date.now() } });
                break;
            default:
                this.sendError(ws, `Unknown message type: ${message.type}`);
        }
    }
    sendMessage(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            }
            catch (error) {
                console.error('[WEBSOCKET] Failed to send message:', error);
            }
        }
    }
    sendError(ws, error) {
        this.sendMessage(ws, {
            type: 'error',
            data: { error, timestamp: Date.now() }
        });
    }
    cleanupClient(ws) {
        // Remove client from all session subscriptions
        // This is handled by the session manager when WebSocket closes
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.readyState === ws_1.WebSocket.OPEN) {
                    this.sendMessage(ws, { type: 'ping', data: { timestamp: Date.now() } });
                }
            });
        }, 30000); // Ping every 30 seconds
    }
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
    }
    getConnectedClients() {
        return this.wss.clients.size;
    }
    broadcast(message) {
        this.wss.clients.forEach((ws) => {
            this.sendMessage(ws, message);
        });
    }
    close() {
        console.log('[WEBSOCKET] Closing WebSocket server');
        this.stopPingInterval();
        this.wss.close();
    }
}
exports.TradingWebSocketServer = TradingWebSocketServer;
// Main entry point - start WebSocket server if run directly
// For ts-node, we check if this is the main module
if (require.main === module || (process.argv[1] && process.argv[1].includes('websocket/server'))) {
    const port = parseInt(process.env.WEBSOCKET_PORT || process.env.PORT || '3002', 10);
    const { TradingSessionManager } = require('../session-manager');
    const sessionManager = new TradingSessionManager();
    const wsServer = new TradingWebSocketServer(port, sessionManager);
    console.log(`[WEBSOCKET] Server starting on port ${port}...`);
    // Graceful shutdown
    const shutdown = () => {
        console.log('[WEBSOCKET] Shutting down gracefully...');
        wsServer.close();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
// Graceful shutdown (for when imported)
process.on('SIGTERM', () => {
    console.log('[WEBSOCKET] Received SIGTERM, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[WEBSOCKET] Received SIGINT, shutting down gracefully');
    process.exit(0);
});
//# sourceMappingURL=server.js.map