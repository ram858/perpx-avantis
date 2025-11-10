"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedLogger = exports.EnhancedLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class EnhancedLogger {
    constructor() {
        this.sessionStartTime = null;
        this.currentSessionId = null;
        const logsDir = path_1.default.join(process.cwd(), 'logs');
        if (!fs_1.default.existsSync(logsDir)) {
            fs_1.default.mkdirSync(logsDir, { recursive: true });
        }
        this.tradeLogPath = path_1.default.join(logsDir, 'enhanced_trade_logs.jsonl');
        this.performanceLogPath = path_1.default.join(logsDir, 'performance_metrics.jsonl');
        this.systemLogPath = path_1.default.join(logsDir, 'system_logs.jsonl');
    }
    /**
     * Start a new trading session
     */
    startSession(sessionId, config) {
        this.sessionStartTime = new Date();
        this.currentSessionId = sessionId;
        this.logTrade({
            event: 'SESSION_START',
            sessionId,
            budget: config.budget,
            metadata: {
                profitGoal: config.profitGoal,
                maxPositions: config.maxPositions,
                timestamp: this.sessionStartTime.toISOString()
            }
        });
        console.log(`📊 [LOGGER] Session ${sessionId} started at ${this.sessionStartTime.toISOString()}`);
    }
    /**
     * End the current trading session
     */
    endSession(reason, finalPnL, stats) {
        if (!this.sessionStartTime || !this.currentSessionId) {
            console.warn('⚠️ [LOGGER] No active session to end');
            return;
        }
        const sessionDuration = Date.now() - this.sessionStartTime.getTime();
        this.logTrade({
            event: 'SESSION_END',
            sessionId: this.currentSessionId || undefined,
            totalPnL: finalPnL,
            reason,
            metadata: {
                sessionDuration,
                finalStats: stats,
                timestamp: new Date().toISOString()
            }
        });
        // Log performance metrics
        this.logPerformance({
            timestamp: new Date().toISOString(),
            sessionId: this.currentSessionId,
            totalTrades: stats.totalTrades || 0,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            winRate: stats.winRate || 0,
            totalPnL: finalPnL,
            averagePnL: stats.averagePnL || 0,
            largestWin: stats.largestWin || 0,
            largestLoss: stats.largestLoss || 0,
            averageWin: stats.averageWin || 0,
            averageLoss: stats.averageLoss || 0,
            totalROI: stats.totalROI || 0,
            sessionDuration: sessionDuration / 1000, // Convert to seconds
            averageTradeDuration: stats.averageTradeDuration || 0,
            profitFactor: stats.profitFactor || 0
        });
        console.log(`📊 [LOGGER] Session ${this.currentSessionId} ended | Duration: ${(sessionDuration / 1000 / 60).toFixed(2)}min | PnL: $${finalPnL.toFixed(2)}`);
        this.sessionStartTime = null;
        this.currentSessionId = null;
    }
    /**
     * Log a trade event
     */
    logTrade(entry) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: entry.event || 'SYSTEM',
            ...entry
        };
        try {
            fs_1.default.appendFileSync(this.tradeLogPath, JSON.stringify(logEntry) + '\n');
        }
        catch (error) {
            console.error('❌ [LOGGER] Failed to write trade log:', error);
        }
    }
    /**
     * Log performance metrics
     */
    logPerformance(metrics) {
        try {
            fs_1.default.appendFileSync(this.performanceLogPath, JSON.stringify(metrics) + '\n');
        }
        catch (error) {
            console.error('❌ [LOGGER] Failed to write performance log:', error);
        }
    }
    /**
     * Log system events
     */
    logSystem(event, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            data,
            sessionId: this.currentSessionId
        };
        try {
            fs_1.default.appendFileSync(this.systemLogPath, JSON.stringify(logEntry) + '\n');
        }
        catch (error) {
            console.error('❌ [LOGGER] Failed to write system log:', error);
        }
    }
    /**
     * Log trade opening
     */
    logTradeOpen(symbol, side, entryPrice, positionSize, leverage, signalData, cycleNumber) {
        this.logTrade({
            event: 'TRADE_OPEN',
            symbol,
            side,
            entryPrice,
            positionSize,
            leverage,
            marketRegime: signalData.marketRegime,
            signalScore: signalData.signalScore,
            rsi: signalData.rsi,
            macdHist: signalData.macdHist,
            emaSlope: signalData.emaSlope,
            atrPct: signalData.atrPct,
            adx: signalData.adx,
            volumePct: signalData.volumePct,
            divergenceScore: signalData.divergenceScore,
            sessionId: this.currentSessionId || undefined,
            cycleNumber
        });
        console.log(`📊 [LOGGER] Trade opened: ${symbol} ${side} @ $${entryPrice.toFixed(4)} | Score: ${(signalData.signalScore * 100).toFixed(1)}% | Regime: ${signalData.marketRegime}`);
    }
    /**
     * Log trade closing
     */
    logTradeClose(symbol, side, entryPrice, exitPrice, positionSize, pnl, reason, tradeDuration, cycleNumber) {
        const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        this.logTrade({
            event: 'TRADE_CLOSE',
            symbol,
            side,
            entryPrice,
            exitPrice,
            positionSize,
            pnl,
            pnlPercent,
            reason,
            sessionId: this.currentSessionId || undefined,
            cycleNumber,
            metadata: {
                tradeDuration,
                timestamp: new Date().toISOString()
            }
        });
        console.log(`📊 [LOGGER] Trade closed: ${symbol} ${side} | Entry: $${entryPrice.toFixed(4)} | Exit: $${exitPrice.toFixed(4)} | PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%) | Reason: ${reason}`);
    }
    /**
     * Log signal generation
     */
    logSignalGenerated(symbol, signalData, cycleNumber) {
        this.logTrade({
            event: 'SIGNAL_GENERATED',
            symbol,
            marketRegime: signalData.marketRegime,
            signalScore: signalData.signalScore,
            rsi: signalData.rsi,
            macdHist: signalData.macdHist,
            emaSlope: signalData.emaSlope,
            atrPct: signalData.atrPct,
            adx: signalData.adx,
            volumePct: signalData.volumePct,
            divergenceScore: signalData.divergenceScore,
            sessionId: this.currentSessionId || undefined,
            cycleNumber,
            metadata: {
                shouldOpen: signalData.shouldOpen,
                reason: signalData.reason
            }
        });
    }
    /**
     * Log position updates
     */
    logPositionUpdate(symbol, currentPrice, pnl, openPositions, totalPnL, cycleNumber) {
        this.logTrade({
            event: 'POSITION_UPDATE',
            symbol,
            exitPrice: currentPrice,
            pnl,
            totalPnL,
            openPositions,
            sessionId: this.currentSessionId || undefined,
            cycleNumber
        });
    }
    /**
     * Log errors
     */
    logError(error, context) {
        this.logTrade({
            event: 'ERROR',
            errorMessage: error.message,
            sessionId: this.currentSessionId || undefined,
            metadata: {
                context,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
        console.error(`❌ [LOGGER] Error${context ? ` in ${context}` : ''}: ${error.message}`);
    }
    /**
     * Get log file paths
     */
    getLogPaths() {
        return {
            tradeLog: this.tradeLogPath,
            performanceLog: this.performanceLogPath,
            systemLog: this.systemLogPath
        };
    }
}
exports.EnhancedLogger = EnhancedLogger;
// Export singleton instance
exports.enhancedLogger = new EnhancedLogger();
//# sourceMappingURL=enhancedLogger.js.map