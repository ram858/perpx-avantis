"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webTradingBot = exports.WebTradingBot = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const hyperliquid_1 = require("./hyperliquid");
const avantis_trading_1 = require("../avantis-trading");
const regime_1 = require("./regime");
const binanceHistorical_1 = require("./binanceHistorical");
const BudgetAndLeverage_1 = require("./BudgetAndLeverage");
const hyperliquid_2 = require("./hyperliquid");
const strategyEngine_1 = require("./strategyEngine");
const MAX_CYCLES = 10000;
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}
function log(tag, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${tag}] ${timestamp} — ${message}`);
}
class WebTradingBot {
    constructor() {
        this.isRunning = false;
        this.shouldStop = false;
        this.sessionId = '';
        this.config = null;
        this.pnl = 0;
        this.openPositions = 0;
        this.cycle = 0;
    }
    async startTrading(config) {
        this.config = config;
        this.sessionId = config.sessionId;
        this.isRunning = true;
        this.shouldStop = false;
        this.pnl = 0;
        this.openPositions = 0;
        this.cycle = 0;
        log('WEB_BOT', `Starting trading session ${this.sessionId}`);
        log('WEB_BOT', `Config: Budget=$${config.maxBudget}, Goal=$${config.profitGoal}, MaxPos=${config.maxPerSession}`);
        // Log trading platform
        if (config.privateKey) {
            log('AVANTIS', `✅ Trading on AVANTIS platform with private key: ${config.privateKey.slice(0, 10)}...${config.privateKey.slice(-4)}`);
            log('AVANTIS', `✅ Positions will be opened on REAL Avantis dashboard`);
            log('AVANTIS', `✅ Make sure your backend wallet is connected to Avantis dashboard to see positions`);
            log('AVANTIS', `✅ All positions opened will appear in your Avantis dashboard in real-time`);
        }
        else {
            log('WARN', `⚠️ No private key provided - using Hyperliquid fallback (testing mode)`);
            log('ERROR', `❌ Cannot open positions on Avantis without private key!`);
        }
        try {
            // Initialize blockchain connection (non-blocking for faster startup)
            (0, hyperliquid_1.initBlockchain)().then(() => {
                log('WEB_BOT', 'Blockchain initialized successfully');
            }).catch(err => {
                log('ERROR', `Blockchain init error: ${err}`);
            });
            // Record existing positions as trades (non-blocking)
            (0, hyperliquid_2.recordExistingPositionsAsTrades)().catch(err => {
                log('WARN', `Failed to record existing positions: ${err}`);
            });
            // Start the main trading loop (don't await - return immediately)
            // This allows the API to return sessionId faster
            this.runTradingLoop().catch(error => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log('FATAL', `Critical error in session ${this.sessionId}: ${errorMessage}`);
                this.isRunning = false;
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('FATAL', `Critical error in session ${this.sessionId}: ${errorMessage}`);
            throw error;
        }
    }
    stopTrading() {
        log('WEB_BOT', `Stopping trading session ${this.sessionId}`);
        this.shouldStop = true;
        this.isRunning = false;
    }
    async runTradingLoop() {
        if (!this.config) {
            throw new Error('No trading configuration available');
        }
        const { maxBudget, profitGoal, maxPerSession } = this.config;
        let sessionCount = 0;
        // Validate and cap budget
        const validatedBudget = await (0, BudgetAndLeverage_1.validateAndCapBudget)(maxBudget, maxPerSession, undefined, 'avantis');
        log('WEB_BOT', `Validated budget: $${validatedBudget.budgetPerPosition.toFixed(2)} per position (${validatedBudget.isValid ? 'valid' : 'invalid'})`);
        // Get initial positions - use Avantis only (no Hyperliquid fallback)
        let initialPositions = [];
        if (this.config && this.config.privateKey) {
            try {
                const avantisPositions = await (0, avantis_trading_1.getAvantisPositions)(this.config.privateKey);
                log('AVANTIS', `📊 Found ${avantisPositions.length} existing position(s) on Avantis dashboard`);
                if (avantisPositions.length > 0) {
                    log('AVANTIS', `📊 These positions are visible in your Avantis dashboard at https://www.avantisfi.com`);
                    avantisPositions.forEach((pos, idx) => {
                        log('AVANTIS', `   Position ${idx + 1}: ${pos.symbol} ${pos.is_long ? 'LONG' : 'SHORT'} | PnL: $${pos.pnl.toFixed(2)}`);
                    });
                }
                initialPositions = avantisPositions;
            }
            catch (err) {
                log('ERROR', `Failed to get Avantis positions: ${err}`);
                // Don't fallback to Hyperliquid - we only use Avantis
                initialPositions = [];
            }
        }
        else {
            log('WARN', `No private key available - cannot fetch initial Avantis positions`);
            initialPositions = [];
        }
        log('WEB_BOT', `Initial positions: ${initialPositions.length}`);
        // Main trading loop
        while (this.isRunning && !this.shouldStop && sessionCount < MAX_CYCLES) {
            try {
                sessionCount++;
                // Check if we should stop
                if (this.shouldStop) {
                    log('WEB_BOT', `Session ${this.sessionId} stopped by user`);
                    return { shouldRestart: false, reason: 'user_stopped', pnl: 0, finalStatus: 'stopped' };
                }
                // Get current PnL - use Avantis only (no Hyperliquid fallback)
                let totalPnL = 0;
                if (this.config && this.config.privateKey) {
                    try {
                        const avantisPositions = await (0, avantis_trading_1.getAvantisPositions)(this.config.privateKey);
                        totalPnL = avantisPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
                        log('AVANTIS', `💰 Total PnL from Avantis: $${totalPnL.toFixed(2)}`);
                    }
                    catch (err) {
                        log('ERROR', `Failed to get Avantis PnL: ${err}`);
                        // Don't fallback to Hyperliquid - we only use Avantis
                        totalPnL = 0;
                    }
                }
                else {
                    log('WARN', `No private key available - cannot fetch Avantis PnL`);
                    totalPnL = 0;
                }
                this.pnl = totalPnL;
                this.cycle = sessionCount;
                log('WEB_BOT', `Cycle ${sessionCount}: Total PnL: $${totalPnL.toFixed(2)}`);
                // Check profit goal
                if (totalPnL >= profitGoal) {
                    log('WEB_BOT', `✅ Profit goal reached! PnL: $${totalPnL.toFixed(2)}`);
                    await this.closeAllPositions();
                    return { shouldRestart: false, reason: 'profit_goal_reached', pnl: totalPnL, finalStatus: 'completed' };
                }
                // Check if we've lost too much
                if (totalPnL <= -validatedBudget * 0.8) {
                    log('WEB_BOT', `❌ Stop loss triggered! PnL: $${totalPnL.toFixed(2)}`);
                    await this.closeAllPositions();
                    return { shouldRestart: false, reason: 'stop_loss_triggered', pnl: totalPnL, finalStatus: 'completed' };
                }
                // Get current positions - use Avantis only (no Hyperliquid fallback)
                let positions = [];
                if (this.config && this.config.privateKey) {
                    try {
                        positions = await (0, avantis_trading_1.getAvantisPositions)(this.config.privateKey);
                        log('AVANTIS', `📊 Fetched ${positions.length} position(s) from Avantis dashboard`);
                    }
                    catch (err) {
                        log('ERROR', `Failed to get Avantis positions: ${err}`);
                        // Don't fallback to Hyperliquid - we only use Avantis
                        positions = [];
                    }
                }
                else {
                    log('WARN', `No private key available - cannot fetch Avantis positions`);
                    positions = [];
                }
                this.openPositions = positions.length;
                log('WEB_BOT', `Open positions: ${positions.length}`);
                // Check for take profit on existing positions - Skip for Avantis-only trading
                // TP/SL is handled by Avantis platform directly
                // await checkAndCloseForTP({
                //   client,
                //   account,
                //   profitGoal,
                //   closePosition
                // });
                // Get market regime (use BTC as default) - parallelize data fetching for speed
                const [btcOHLCV4h, btcOHLCV6h] = await Promise.all([
                    (0, binanceHistorical_1.getCachedOHLCV)('BTC', '4h', 300).catch(() => null),
                    (0, binanceHistorical_1.getCachedOHLCV)('BTC', '6h', 300).catch(() => null)
                ]);
                const regimeResult = (btcOHLCV4h && btcOHLCV6h) ? await (0, regime_1.guessMarketRegime)('BTC', btcOHLCV4h, btcOHLCV6h) : { regime: 'neutral' };
                const marketRegime = regimeResult.regime;
                log('WEB_BOT', `Market regime: ${marketRegime}`);
                // Only open new positions if we're under the limit
                if (positions.length < maxPerSession) {
                    // Get available trading symbols
                    const tokens = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM'];
                    const slotsLeft = maxPerSession - positions.length;
                    let entriesThis = 0;
                    // Parallelize symbol evaluation for faster execution (limit to available slots)
                    const symbolsToEvaluate = tokens.slice(0, Math.min(slotsLeft * 2, tokens.length)); // Evaluate more symbols in parallel
                    const symbolPromises = symbolsToEvaluate.map(async (symbol) => {
                        try {
                            // Parallelize OHLCV data fetching for speed
                            const [ohlcv4h, ohlcv6h] = await Promise.all([
                                (0, binanceHistorical_1.getCachedOHLCV)(symbol, '4h', 300).catch(() => null),
                                (0, binanceHistorical_1.getCachedOHLCV)(symbol, '6h', 300).catch(() => null)
                            ]);
                            if (!ohlcv4h || !ohlcv6h || ohlcv4h.close.length < 10 || ohlcv6h.close.length < 10) {
                                return null; // Skip silently for speed
                            }
                            // Calculate budget per position
                            const perPositionBudget = validatedBudget.budgetPerPosition;
                            // Get leverage for this symbol
                            const { leverage } = (0, BudgetAndLeverage_1.getBudgetAndLeverage)(marketRegime, symbol, perPositionBudget);
                            log('WEB_BOT', `Evaluating ${symbol} | Budget=$${perPositionBudget.toFixed(2)} | Leverage=${leverage}x`);
                            // Evaluate signal to get direction (using already fetched OHLCV data)
                            // We'll use the signal logic but execute on Avantis instead
                            // Evaluate signal to get direction
                            const signalResult = await (0, strategyEngine_1.evaluateSignalOnly)(symbol, ohlcv4h, {
                                regimeOverride: marketRegime,
                                leverage,
                                bypassBacktestCheck: true
                            });
                            const { direction, signalScore, passed, reason: signalReason } = signalResult;
                            if (!direction || !passed) {
                                return {
                                    symbol,
                                    result: {
                                        positionOpened: false,
                                        marketRegime,
                                        reason: signalReason || "signal_not_passed",
                                        signalScore
                                    }
                                };
                            }
                            // If we have a private key, open position on Avantis (real trading)
                            if (this.config && this.config.privateKey) {
                                try {
                                    const isLong = direction === "long";
                                    log('AVANTIS', `🚀 Opening ${symbol} ${isLong ? 'LONG' : 'SHORT'} on REAL AVANTIS PLATFORM...`);
                                    log('AVANTIS', `   Collateral: $${perPositionBudget.toFixed(2)} | Leverage: ${leverage}x`);
                                    const avantisResult = await (0, avantis_trading_1.openAvantisPosition)({
                                        symbol,
                                        collateral: perPositionBudget,
                                        leverage,
                                        is_long: isLong,
                                        private_key: this.config.privateKey
                                    });
                                    if (avantisResult && avantisResult.success) {
                                        log('AVANTIS', `✅✅✅ Position SUCCESSFULLY opened on Avantis Dashboard!`);
                                        log('AVANTIS', `   Symbol: ${symbol} | Direction: ${isLong ? 'LONG' : 'SHORT'}`);
                                        log('AVANTIS', `   Transaction: ${avantisResult.tx_hash?.slice(0, 16)}...`);
                                        log('AVANTIS', `   Pair Index: ${avantisResult.pair_index}`);
                                        log('AVANTIS', `   Collateral: $${perPositionBudget.toFixed(2)} | Leverage: ${leverage}x`);
                                        log('AVANTIS', `   ==========================================`);
                                        log('AVANTIS', `   📊 POSITION IS NOW LIVE ON AVANTIS DASHBOARD`);
                                        log('AVANTIS', `   📊 Visit avantisfi.com and connect your backend wallet`);
                                        log('AVANTIS', `   📊 The position will appear in "Current Positions" section`);
                                        log('AVANTIS', `   ==========================================`);
                                        return {
                                            symbol,
                                            result: {
                                                positionOpened: true,
                                                marketRegime,
                                                reason: "executed_on_avantis",
                                                signalScore,
                                                avantisTxHash: avantisResult.tx_hash,
                                                avantisPairIndex: avantisResult.pair_index
                                            }
                                        };
                                    }
                                    else {
                                        log('AVANTIS', `❌ Failed to open position on Avantis: ${avantisResult.error}`);
                                        return {
                                            symbol,
                                            result: {
                                                positionOpened: false,
                                                marketRegime,
                                                reason: `avantis_error: ${avantisResult.error}`,
                                                signalScore
                                            }
                                        };
                                    }
                                }
                                catch (avantisError) {
                                    log('AVANTIS', `❌ Exception opening position on Avantis: ${avantisError}`);
                                    return {
                                        symbol,
                                        result: {
                                            positionOpened: false,
                                            marketRegime,
                                            reason: `avantis_exception: ${avantisError}`,
                                            signalScore
                                        }
                                    };
                                }
                            }
                            else {
                                // No private key - fallback to Hyperliquid (for testing/development)
                                log('WARN', `⚠️ No private key available - using Hyperliquid fallback for ${symbol} (positions won't appear on Avantis)`);
                                const result = await (0, hyperliquid_1.runSignalCheckAndOpen)({
                                    symbol,
                                    perPositionBudget,
                                    leverage,
                                    regimeOverride: marketRegime
                                });
                                return { symbol, result };
                            }
                        }
                        catch (error) {
                            log('WEB_BOT', `Error evaluating ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
                            return null;
                        }
                    });
                    // Wait for all evaluations to complete
                    const evaluationResults = await Promise.all(symbolPromises);
                    // Process results and open positions (respecting slot limit)
                    for (const evalResult of evaluationResults) {
                        if (!evalResult)
                            continue;
                        if (entriesThis >= slotsLeft)
                            break;
                        const { symbol, result } = evalResult;
                        const { positionOpened, signalScore, reason } = result;
                        if (positionOpened) {
                            entriesThis++;
                            log('WEB_BOT', `✅ ${symbol} opened | Score=${signalScore} | Count=${entriesThis}`);
                        }
                        else {
                            log('WEB_BOT', `${symbol} => ❌ No trade | Reason: ${reason}`);
                            // Log detailed rejection reason for debugging
                            if (reason && reason.length > 0) {
                                const reasonLines = reason.split('\n');
                                reasonLines.forEach(line => {
                                    if (line.trim()) {
                                        log('WEB_BOT', `   ${line.trim()}`);
                                    }
                                });
                            }
                        }
                    }
                }
                // Wait before next cycle - reduced for faster execution
                await delay(5000); // 5 seconds between cycles (optimized for speed)
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log('ERROR', `Error in cycle ${sessionCount}: ${errorMessage}`);
                // Continue trading unless it's a critical error
                if (errorMessage.includes('FATAL') || errorMessage.includes('Critical')) {
                    return { shouldRestart: false, reason: 'critical_error', pnl: 0, finalStatus: 'error' };
                }
            }
        }
        // If we reach here, the session completed normally
        let finalPnL = 0;
        if (this.config.privateKey) {
            try {
                const avantisPositions = await (0, avantis_trading_1.getAvantisPositions)(this.config.privateKey);
                finalPnL = avantisPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
            }
            catch (err) {
                log('WARN', `Failed to get final Avantis PnL, falling back to Hyperliquid: ${err}`);
                finalPnL = await (0, hyperliquid_1.getTotalPnL)();
            }
        }
        else {
            finalPnL = await (0, hyperliquid_1.getTotalPnL)();
        }
        log('WEB_BOT', `Session ${this.sessionId} completed after ${sessionCount} cycles. Final PnL: $${finalPnL.toFixed(2)}`);
        return { shouldRestart: false, reason: 'max_cycles_reached', pnl: finalPnL, finalStatus: 'completed' };
    }
    async closeAllPositions() {
        try {
            log('WEB_BOT', 'Closing all positions...');
            await (0, hyperliquid_1.closeAllPositions)();
            log('WEB_BOT', 'All positions closed');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('ERROR', `Error closing positions: ${errorMessage}`);
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            sessionId: this.sessionId,
            config: this.config,
            pnl: this.pnl,
            openPositions: this.openPositions,
            cycle: this.cycle
        };
    }
}
exports.WebTradingBot = WebTradingBot;
// Export for use in the web server
exports.webTradingBot = new WebTradingBot();
//# sourceMappingURL=web-trading-bot.js.map