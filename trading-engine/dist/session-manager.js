"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingSessionManager = void 0;
const ws_1 = __importDefault(require("ws"));
// Dynamic import to avoid build errors during Avantis migration
let WebTradingBot;
try {
    const hyperliquidModule = require('./hyperliquid/web-trading-bot');
    WebTradingBot = hyperliquidModule.WebTradingBot;
}
catch (error) {
    console.warn('[SESSION_MANAGER] Hyperliquid module not available, using placeholder');
    // Placeholder class for when Hyperliquid is not available
    WebTradingBot = class PlaceholderTradingBot {
        async startTrading() { console.log('[PLACEHOLDER] Trading bot placeholder'); }
        async stop() { console.log('[PLACEHOLDER] Stop placeholder'); }
        getStatus() { return { pnl: 0, positions: [] }; }
    };
}
class TradingSessionManager {
    constructor() {
        this.sessions = new Map();
        this.tradingBot = new WebTradingBot();
    }
    async startSession(config) {
        const sessionId = `session_${Date.now()}`;
        // Create config with sessionId
        const botConfig = {
            ...config,
            sessionId
        };
        // Start the real trading bot
        await this.tradingBot.startTrading(botConfig);
        console.log(`[SESSION_MANAGER] Starting session ${sessionId} with config:`, config);
        const session = {
            config,
            status: {
                sessionId,
                status: 'running',
                pnl: 0,
                openPositions: 0,
                cycle: 0,
                lastUpdate: new Date(),
                config
            },
            subscribers: new Set(),
            walletAddress: config.walletAddress, // Store for Base Account queries
            isBaseAccount: config.isBaseAccount || false // Store Base Account flag
        };
        this.sessions.set(sessionId, session);
        // Log Base Account session info
        if (config.isBaseAccount) {
            console.log(`[SESSION_MANAGER] Base Account session ${sessionId} with address ${config.walletAddress}`);
            console.log(`[SESSION_MANAGER] Note: Automated trading disabled - transactions must be signed via Base Account SDK`);
        }
        // Start monitoring the session
        this.startSessionMonitoring(sessionId);
        return sessionId;
    }
    startSessionMonitoring(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        // For Base Account sessions, query Avantis API instead of bot status
        if (session.isBaseAccount && session.walletAddress) {
            this.monitorBaseAccountSession(sessionId, session.walletAddress);
            return;
        }
        // For traditional wallet sessions, monitor bot status
        const monitorInterval = setInterval(() => {
            const botStatus = this.tradingBot.getStatus();
            const session = this.sessions.get(sessionId);
            if (!botStatus || !session) {
                clearInterval(monitorInterval);
                return;
            }
            // Update session status from bot
            session.status = {
                ...session.status,
                pnl: botStatus.pnl || 0,
                openPositions: botStatus.openPositions || 0,
                cycle: botStatus.cycle || 0,
                status: botStatus.isRunning ? 'running' : 'stopped',
                lastUpdate: new Date()
            };
            this.broadcastUpdate(sessionId);
            // Clean up if session is completed or stopped
            if (!botStatus.isRunning) {
                clearInterval(monitorInterval);
                setTimeout(() => {
                    this.sessions.delete(sessionId);
                }, 30000);
            }
        }, 5000); // Check every 5 seconds (reduced from 1 second for performance)
    }
    monitorBaseAccountSession(sessionId, walletAddress) {
        const avantisApiUrl = process.env.AVANTIS_API_URL || 'http://localhost:8000';
        let lastUpdate = Date.now();
        // Update every 10 seconds for Base Account sessions (less frequent for performance)
        const monitorInterval = setInterval(async () => {
            const session = this.sessions.get(sessionId);
            if (!session) {
                clearInterval(monitorInterval);
                return;
            }
            try {
                // Fetch positions and PnL from Avantis service
                const [positionsResponse, pnlResponse] = await Promise.all([
                    fetch(`${avantisApiUrl}/api/positions?address=${walletAddress}`).catch(() => null),
                    fetch(`${avantisApiUrl}/api/total-pnl?address=${walletAddress}`).catch(() => null),
                ]);
                let pnl = 0;
                let openPositions = 0;
                if (positionsResponse?.ok) {
                    const positionsData = await positionsResponse.json();
                    if (typeof positionsData.count === 'number') {
                        openPositions = positionsData.count;
                    }
                    else if (Array.isArray(positionsData.positions)) {
                        openPositions = positionsData.positions.length;
                    }
                }
                if (pnlResponse?.ok) {
                    const pnlData = await pnlResponse.json();
                    if (typeof pnlData.total_pnl === 'number') {
                        pnl = pnlData.total_pnl;
                    }
                }
                // Update session status
                session.status = {
                    ...session.status,
                    pnl,
                    openPositions,
                    lastUpdate: new Date()
                };
                this.broadcastUpdate(sessionId);
                lastUpdate = Date.now();
            }
            catch (error) {
                console.error(`[SESSION_MANAGER] Error monitoring Base Account session ${sessionId}:`, error);
                // Don't clear interval on error, just log it
            }
        }, 10000); // Update every 10 seconds for Base Accounts
        // Store interval ID for cleanup
        const currentSession = this.sessions.get(sessionId);
        if (currentSession) {
            currentSession.monitorInterval = monitorInterval;
        }
    }
    updateSessionStatus(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.status = { ...session.status, ...updates };
        this.broadcastUpdate(sessionId);
    }
    broadcastUpdate(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const update = {
            type: 'trading_update',
            data: session.status
        };
        // Security: Remove debug logging in production
        session.subscribers.forEach(ws => {
            if (ws.readyState === ws_1.default.OPEN) {
                try {
                    ws.send(JSON.stringify(update));
                }
                catch (error) {
                    // Security: Remove error logging in production
                    session.subscribers.delete(ws);
                }
            }
            else {
                session.subscribers.delete(ws);
            }
        });
    }
    subscribeToUpdates(sessionId, ws) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.subscribers.add(ws);
            console.log(`[SESSION_MANAGER] Client subscribed to session ${sessionId}`);
            // Send current status immediately
            const update = {
                type: 'trading_update',
                data: session.status
            };
            if (ws.readyState === ws_1.default.OPEN) {
                ws.send(JSON.stringify(update));
            }
        }
        else {
            console.warn(`[SESSION_MANAGER] Attempted to subscribe to non-existent session ${sessionId}`);
        }
    }
    unsubscribeFromUpdates(sessionId, ws) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.subscribers.delete(ws);
            console.log(`[SESSION_MANAGER] Client unsubscribed from session ${sessionId}`);
        }
    }
    /**
     * Get wallet address for a session (for Base Account queries)
     */
    getSessionWalletAddress(sessionId) {
        const session = this.sessions.get(sessionId);
        return session?.walletAddress || session?.config.walletAddress;
    }
    /**
     * Check if a session is using Base Account
     */
    isSessionBaseAccount(sessionId) {
        const session = this.sessions.get(sessionId);
        return session?.isBaseAccount || false;
    }
    getSessionStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? session.status : null;
    }
    getAllSessions() {
        return Array.from(this.sessions.values()).map(session => session.status);
    }
    stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            console.log(`[SESSION_MANAGER] Stopping session ${sessionId}`);
            // Clear monitoring interval if it exists
            if (session.monitorInterval) {
                clearInterval(session.monitorInterval);
            }
            // Stop bot only for non-Base Account sessions
            if (!session.isBaseAccount) {
                this.tradingBot.stopTrading();
            }
            this.updateSessionStatus(sessionId, { status: 'stopped', lastUpdate: new Date() });
            return true;
        }
        return false;
    }
    forceStopSession(sessionId) {
        return this.stopSession(sessionId);
    }
    cleanup() {
        console.log('[SESSION_MANAGER] Cleaning up all sessions');
        this.tradingBot.stopTrading();
        this.sessions.clear();
    }
}
exports.TradingSessionManager = TradingSessionManager;
//# sourceMappingURL=session-manager.js.map