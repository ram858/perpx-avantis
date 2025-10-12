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

import { checkAndCloseForTP } from './tpsl';
import { guessMarketRegime } from './regime';
import { getCachedOHLCV } from './binanceHistorical';
import { getBudgetAndLeverage, validateAndCapBudget } from './BudgetAndLeverage';
import { winRateTracker } from './winRateTracker';
import { getAIPOS } from './aiStorage';
import { recordLiquidatedTrades, recordExistingPositionsAsTrades } from './hyperliquid';

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

  async startTrading(config: TradingConfig): Promise<void> {
    this.config = config;
    this.sessionId = config.sessionId;
    this.isRunning = true;
    this.shouldStop = false;
    this.pnl = 0;
    this.openPositions = 0;
    this.cycle = 0;

    log('WEB_BOT', `Starting trading session ${this.sessionId}`);
    log('WEB_BOT', `Config: Budget=$${config.maxBudget}, Goal=$${config.profitGoal}, MaxPos=${config.maxPerSession}`);

    try {
      // Initialize blockchain connection
      await initBlockchain();
      log('WEB_BOT', 'Blockchain initialized successfully');

      // Record existing positions as trades
      await recordExistingPositionsAsTrades();

      // Start the main trading loop
      await this.runTradingLoop();
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
    const validatedBudget = await validateAndCapBudget(maxBudget, maxPerSession);
    log('WEB_BOT', `Validated budget: $${validatedBudget}`);

    // Get initial positions and record them
    const initialPositions = await getPositions();
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

        // Get current PnL
        const totalPnL = await getTotalPnL();
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

        // Get current positions
        const positions = await getPositions();
        this.openPositions = positions.length;
        log('WEB_BOT', `Open positions: ${positions.length}`);

        // Check for take profit on existing positions
        await checkAndCloseForTP({
          client,
          account,
          profitGoal,
          closePosition
        });

        // Get market regime (use BTC as default) - use 4h and 6h timeframes as expected by guessMarketRegime
        const btcOHLCV4h = await getCachedOHLCV('BTC', '4h', 300).catch(() => null);
        const btcOHLCV6h = await getCachedOHLCV('BTC', '6h', 300).catch(() => null);
        const regimeResult = (btcOHLCV4h && btcOHLCV6h) ? await guessMarketRegime('BTC', btcOHLCV4h, btcOHLCV6h) : { regime: 'neutral' };
        const marketRegime = regimeResult.regime;
        log('WEB_BOT', `Market regime: ${marketRegime}`);

        // Only open new positions if we're under the limit
        if (positions.length < maxPerSession) {
          // Get available trading symbols
          const tokens = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM'];
          const slotsLeft = maxPerSession - positions.length;
          let entriesThis = 0;

          for (const symbol of tokens) {
            if (entriesThis >= slotsLeft) break;

            try {
              // Get OHLCV data for signal evaluation - use 4h and 6h as expected by runSignalCheckAndOpen
              const ohlcv4h = await getCachedOHLCV(symbol, '4h', 300).catch(() => null);
              const ohlcv6h = await getCachedOHLCV(symbol, '6h', 300).catch(() => null);
              
              if (!ohlcv4h || !ohlcv6h || ohlcv4h.close.length < 30 || ohlcv6h.close.length < 30) {
                log('WEB_BOT', `Skipping ${symbol}: insufficient data (4h: ${ohlcv4h?.close.length || 0}, 6h: ${ohlcv6h?.close.length || 0})`);
                continue;
              }

              // Calculate budget per position
              const perPositionBudget = validatedBudget.budgetPerPosition;
              
              // Get leverage for this symbol
              const { leverage } = getBudgetAndLeverage(marketRegime as any, symbol, perPositionBudget);

              log('WEB_BOT', `Evaluating ${symbol} | Budget=$${perPositionBudget.toFixed(2)} | Leverage=${leverage}x`);

              // Run signal check and potentially open new positions
              const result = await runSignalCheckAndOpen({
                symbol,
                perPositionBudget,
                leverage,
                regimeOverride: marketRegime
              });

              const { positionOpened, signalScore, reason } = result;
              
              if (positionOpened) {
                entriesThis++;
                log('WEB_BOT', `✅ ${symbol} opened | Score=${signalScore} | Count=${entriesThis}`);
              } else {
                log('WEB_BOT', `${symbol} => ❌ No trade | Reason: ${reason}`);
              }
            } catch (error) {
              log('WEB_BOT', `Error evaluating ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }

        // Wait before next cycle
        await delay(10000); // 10 seconds between cycles to reduce server load

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
    const finalPnL = await getTotalPnL();
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
