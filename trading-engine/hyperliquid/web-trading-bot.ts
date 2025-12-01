import dotenv from 'dotenv';
dotenv.config();

import Decimal from 'decimal.js';
import {
  initBlockchain,
  getTotalPnL,
  closeAllPositions,
  getPositions,
  runSignalCheckAndOpen,
  closePosition,
  fetchPrice,
  client,
  account,
  priceFeeds
} from './hyperliquid';
import { openAvantisPositionSafe, getAvantisPositions } from '../avantis-trading';

import { checkAndCloseForTP } from './tpsl';
import { guessMarketRegime } from './regime';
import { getCachedOHLCV } from './binanceHistorical';
import { getBudgetAndLeverage, validateAndCapBudget } from './BudgetAndLeverage';
import { winRateTracker } from './winRateTracker';
import { getAIPOS } from './aiStorage';
import { recordLiquidatedTrades, recordExistingPositionsAsTrades } from './hyperliquid';
import { evaluateSignalOnly } from './strategyEngine';

const MAX_CYCLES = 10000;

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

function log(tag: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${tag}] ${timestamp} — ${message}`);
}

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
  sessionId: string;
  privateKey?: string; // Private key for Avantis trading
}

export interface TradingResult {
  shouldRestart: boolean;
  reason: string;
  pnl: number;
  finalStatus: 'completed' | 'error' | 'stopped';
}

export class WebTradingBot {
  private isRunning = false;
  private shouldStop = false;
  private sessionId: string = '';
  private config: TradingConfig | null = null;
  private pnl: number = 0;
  private openPositions: number = 0;
  private cycle: number = 0;
  private totalLossToday: number = 0;
  private tradesOpenedToday: number = 0;
  private sessionStartTime: Date = new Date();
  
  // Risk management constants
  private readonly MAX_DAILY_LOSS_PERCENT = 20; // Stop trading if daily loss exceeds 20% of budget
  private readonly MAX_TRADES_PER_DAY = 50; // Max trades per day to prevent overtrading
  private readonly MIN_TIME_BETWEEN_TRADES_MS = 30000; // 30 seconds between trades

  async startTrading(config: TradingConfig): Promise<void> {
    this.config = config;
    this.sessionId = config.sessionId;
    this.isRunning = true;
    this.shouldStop = false;
    this.pnl = 0;
    this.openPositions = 0;
    this.cycle = 0;
    this.totalLossToday = 0;
    this.tradesOpenedToday = 0;
    this.sessionStartTime = new Date();

    log('WEB_BOT', `Starting trading session ${this.sessionId}`);
    log('WEB_BOT', `Config: Budget=$${config.maxBudget}, Goal=$${config.profitGoal}, MaxPos=${config.maxPerSession}`);
    log('WEB_BOT', `Risk Limits: Max Daily Loss=${this.MAX_DAILY_LOSS_PERCENT}%, Max Trades/Day=${this.MAX_TRADES_PER_DAY}`);
    
    // Log trading platform
    if (config.privateKey) {
      log('AVANTIS', `✅ Trading on AVANTIS platform with private key: ${config.privateKey.slice(0, 10)}...${config.privateKey.slice(-4)}`);
      log('AVANTIS', `✅ Positions will be opened on REAL Avantis dashboard`);
      log('AVANTIS', `✅ Make sure your backend wallet is connected to Avantis dashboard to see positions`);
      log('AVANTIS', `✅ All positions opened will appear in your Avantis dashboard in real-time`);
    } else {
      log('WARN', `⚠️ No private key provided - using Hyperliquid fallback (testing mode)`);
      log('ERROR', `❌ Cannot open positions on Avantis without private key!`);
    }

    try {
      // Initialize blockchain connection (non-blocking for faster startup)
      initBlockchain().then(() => {
        log('WEB_BOT', 'Blockchain initialized successfully');
      }).catch(err => {
        log('ERROR', `Blockchain init error: ${err}`);
      });

      // Record existing positions as trades (non-blocking)
      recordExistingPositionsAsTrades().catch(err => {
        log('WARN', `Failed to record existing positions: ${err}`);
      });

      // Start the main trading loop (don't await - return immediately)
      // This allows the API to return sessionId faster
      this.runTradingLoop().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('FATAL', `Critical error in session ${this.sessionId}: ${errorMessage}`);
        this.isRunning = false;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('FATAL', `Critical error in session ${this.sessionId}: ${errorMessage}`);
      throw error;
    }
  }

  stopTrading(): void {
    log('WEB_BOT', `Stopping trading session ${this.sessionId}`);
    this.shouldStop = true;
    this.isRunning = false;
  }

  private async runTradingLoop(): Promise<TradingResult> {
    if (!this.config) {
      throw new Error('No trading configuration available');
    }

    const { maxBudget, profitGoal, maxPerSession } = this.config;
    let sessionCount = 0;

    // Validate and cap budget
    const validatedBudget = await validateAndCapBudget(maxBudget, maxPerSession, undefined, 'avantis');
    log('WEB_BOT', `Validated budget: $${validatedBudget.budgetPerPosition.toFixed(2)} per position (${validatedBudget.isValid ? 'valid' : 'invalid'})`);

        // Get initial positions - use Avantis only (no Hyperliquid fallback)
        let initialPositions: any[] = [];
        if (this.config && this.config.privateKey) {
          try {
            const avantisPositions = await getAvantisPositions(this.config.privateKey);
            log('AVANTIS', `📊 Found ${avantisPositions.length} existing position(s) on Avantis dashboard`);
            if (avantisPositions.length > 0) {
              log('AVANTIS', `📊 These positions are visible in your Avantis dashboard at https://www.avantisfi.com`);
              avantisPositions.forEach((pos, idx) => {
                log('AVANTIS', `   Position ${idx + 1}: ${pos.symbol} ${pos.is_long ? 'LONG' : 'SHORT'} | PnL: $${pos.pnl.toFixed(2)}`);
              });
            }
            initialPositions = avantisPositions;
          } catch (err) {
            log('ERROR', `Failed to get Avantis positions: ${err}`);
            // Don't fallback to Hyperliquid - we only use Avantis
            initialPositions = [];
          }
        } else {
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
            const avantisPositions = await getAvantisPositions(this.config.privateKey);
            totalPnL = avantisPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
            log('AVANTIS', `💰 Total PnL from Avantis: $${totalPnL.toFixed(2)}`);
            
            // Update daily loss tracker
            if (totalPnL < 0) {
              this.totalLossToday = Math.abs(totalPnL);
            }
          } catch (err) {
            log('ERROR', `Failed to get Avantis PnL: ${err}`);
            // Don't fallback to Hyperliquid - we only use Avantis
            totalPnL = 0;
          }
          
          // ==========================================
          // RISK CHECK: Stop if daily loss limit exceeded
          // ==========================================
          const maxLossAmount = (maxBudget * this.MAX_DAILY_LOSS_PERCENT) / 100;
          if (this.totalLossToday >= maxLossAmount) {
            log('RISK', `🛑 DAILY LOSS LIMIT REACHED! Loss: $${this.totalLossToday.toFixed(2)} >= Max: $${maxLossAmount.toFixed(2)}`);
            log('RISK', `🛑 Stopping trading to protect capital. Session will resume tomorrow.`);
            return { shouldRestart: false, reason: 'daily_loss_limit', pnl: totalPnL, finalStatus: 'stopped' };
          }
          
          // RISK CHECK: Max trades per day
          if (this.tradesOpenedToday >= this.MAX_TRADES_PER_DAY) {
            log('RISK', `🛑 MAX TRADES PER DAY REACHED (${this.MAX_TRADES_PER_DAY}). Stopping for today.`);
            return { shouldRestart: false, reason: 'max_trades_reached', pnl: totalPnL, finalStatus: 'completed' };
          }
        } else {
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
        let positions: any[] = [];
        if (this.config && this.config.privateKey) {
          try {
            positions = await getAvantisPositions(this.config.privateKey);
            log('AVANTIS', `📊 Fetched ${positions.length} position(s) from Avantis dashboard`);
          } catch (err) {
            log('ERROR', `Failed to get Avantis positions: ${err}`);
            // Don't fallback to Hyperliquid - we only use Avantis
            positions = [];
          }
        } else {
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
          getCachedOHLCV('BTC', '4h', 300).catch(() => null),
          getCachedOHLCV('BTC', '6h', 300).catch(() => null)
        ]);
        const regimeResult = (btcOHLCV4h && btcOHLCV6h) ? await guessMarketRegime('BTC', btcOHLCV4h, btcOHLCV6h) : { regime: 'neutral' };
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
                getCachedOHLCV(symbol, '4h', 300).catch(() => null),
                getCachedOHLCV(symbol, '6h', 300).catch(() => null)
              ]);
              
              if (!ohlcv4h || !ohlcv6h || ohlcv4h.close.length < 10 || ohlcv6h.close.length < 10) {
                return null; // Skip silently for speed
              }

              // Calculate budget per position
              const perPositionBudget = validatedBudget.budgetPerPosition;
              
              // Get leverage for this symbol
              const { leverage } = getBudgetAndLeverage(marketRegime as any, symbol, perPositionBudget);

              log('WEB_BOT', `Evaluating ${symbol} | Budget=$${perPositionBudget.toFixed(2)} | Leverage=${leverage}x`);

              // Evaluate signal to get direction (using already fetched OHLCV data)
              // We'll use the signal logic but execute on Avantis instead

              // Evaluate signal to get direction
              const signalResult = await evaluateSignalOnly(symbol, ohlcv4h, {
                regimeOverride: marketRegime as any,
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
                  
                  // ========================================================
                  // RISK MANAGEMENT: Calculate SL and TP for protection
                  // ========================================================
                  // Get current price for SL/TP calculation
                  let currentPrice = 0;
                  try {
                    currentPrice = await fetchPrice(symbol);
                  } catch (e) {
                    log('AVANTIS', `⚠️ Could not fetch price for SL/TP calculation: ${e}`);
                  }
                  
                  // Calculate Stop Loss and Take Profit
                  // For high leverage positions, we MUST have a stop loss to prevent liquidation
                  let sl: number | undefined;
                  let tp: number | undefined;
                  
                  if (currentPrice > 0) {
                    // Stop Loss: Set at 50% of liquidation distance to give buffer
                    // With 25x leverage, liquidation is at ~4% move against you
                    // So we set SL at ~2% to exit before liquidation
                    const slPercentage = Math.min(2.5, 50 / leverage); // 2.5% max, or 50%/leverage
                    
                    // Take Profit: Set at 2x the SL distance (risk:reward = 1:2)
                    const tpPercentage = slPercentage * 2;
                    
                    if (isLong) {
                      // Long position: SL below entry, TP above entry
                      sl = currentPrice * (1 - slPercentage / 100);
                      tp = currentPrice * (1 + tpPercentage / 100);
                    } else {
                      // Short position: SL above entry, TP below entry
                      sl = currentPrice * (1 + slPercentage / 100);
                      tp = currentPrice * (1 - tpPercentage / 100);
                    }
                    
                    log('AVANTIS', `🛡️ RISK PROTECTION: SL=${sl?.toFixed(2)}, TP=${tp?.toFixed(2)} (${slPercentage.toFixed(1)}% SL / ${tpPercentage.toFixed(1)}% TP)`);
                  } else {
                    log('AVANTIS', `⚠️ WARNING: Opening position WITHOUT Stop Loss - liquidation risk!`);
                  }
                  
                  log('AVANTIS', `🚀 Opening ${symbol} ${isLong ? 'LONG' : 'SHORT'} on REAL AVANTIS PLATFORM...`);
                  log('AVANTIS', `   Collateral: $${perPositionBudget.toFixed(2)} | Leverage: ${leverage}x`);
                  if (sl) log('AVANTIS', `   Stop Loss: $${sl.toFixed(2)} | Take Profit: $${tp?.toFixed(2)}`);
                  
                  const avantisResult = await openAvantisPositionSafe({
                    symbol,
                    collateral: perPositionBudget,
                    leverage,
                    is_long: isLong,
                    private_key: this.config.privateKey,
                    sl,  // Add Stop Loss for protection
                    tp   // Add Take Profit for profit-taking
                  });

                  if (avantisResult && avantisResult.success) {
                    // Increment daily trade counter
                    this.tradesOpenedToday++;
                    
                    log('AVANTIS', `✅✅✅ Position SUCCESSFULLY opened on Avantis Dashboard!`);
                    log('AVANTIS', `   Symbol: ${symbol} | Direction: ${isLong ? 'LONG' : 'SHORT'}`);
                    log('AVANTIS', `   Transaction: ${avantisResult.tx_hash?.slice(0, 16)}...`);
                    log('AVANTIS', `   Pair Index: ${avantisResult.pair_index}`);
                    log('AVANTIS', `   Collateral: $${perPositionBudget.toFixed(2)} | Leverage: ${leverage}x`);
                    log('AVANTIS', `   Trades Today: ${this.tradesOpenedToday}/${this.MAX_TRADES_PER_DAY}`);
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
                  } else {
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
                } catch (avantisError) {
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
              } else {
                // No private key - fallback to Hyperliquid (for testing/development)
                log('WARN', `⚠️ No private key available - using Hyperliquid fallback for ${symbol} (positions won't appear on Avantis)`);
                const result = await runSignalCheckAndOpen({
                  symbol,
                  perPositionBudget,
                  leverage,
                  regimeOverride: marketRegime
                });
                return { symbol, result };
              }
            } catch (error) {
              log('WEB_BOT', `Error evaluating ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
              return null;
            }
          });

          // Wait for all evaluations to complete
          const evaluationResults = await Promise.all(symbolPromises);
          
          // Process results and open positions (respecting slot limit)
          for (const evalResult of evaluationResults) {
            if (!evalResult) continue;
            if (entriesThis >= slotsLeft) break;
            
            const { symbol, result } = evalResult;
            const { positionOpened, signalScore, reason } = result;
            
            if (positionOpened) {
              entriesThis++;
              log('WEB_BOT', `✅ ${symbol} opened | Score=${signalScore} | Count=${entriesThis}`);
            } else {
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

      } catch (error) {
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
        const avantisPositions = await getAvantisPositions(this.config.privateKey);
        finalPnL = avantisPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
      } catch (err) {
        log('WARN', `Failed to get final Avantis PnL, falling back to Hyperliquid: ${err}`);
        finalPnL = await getTotalPnL();
      }
    } else {
      finalPnL = await getTotalPnL();
    }
    log('WEB_BOT', `Session ${this.sessionId} completed after ${sessionCount} cycles. Final PnL: $${finalPnL.toFixed(2)}`);
    
    return { shouldRestart: false, reason: 'max_cycles_reached', pnl: finalPnL, finalStatus: 'completed' };
  }

  private async closeAllPositions(): Promise<void> {
    try {
      log('WEB_BOT', 'Closing all positions...');
      await closeAllPositions();
      log('WEB_BOT', 'All positions closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('ERROR', `Error closing positions: ${errorMessage}`);
    }
  }

  getStatus(): { 
    isRunning: boolean; 
    sessionId: string; 
    config: TradingConfig | null;
    pnl: number;
    openPositions: number;
    cycle: number;
  } {
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

// Export for use in the web server
export const webTradingBot = new WebTradingBot();
