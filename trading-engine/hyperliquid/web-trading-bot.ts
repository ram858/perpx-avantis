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

  async startTrading(config: TradingConfig): Promise<void> {
    this.config = config;
    this.sessionId = config.sessionId;
    this.isRunning = true;
    this.shouldStop = false;

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
    const validatedBudget = await validateAndCapBudget(maxBudget);
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
        log('WEB_BOT', `Open positions: ${positions.length}`);

        // Check for take profit on existing positions
        await checkAndCloseForTP();

        // Get market regime
        const marketRegime = await guessMarketRegime();
        log('WEB_BOT', `Market regime: ${marketRegime}`);

        // Only open new positions if we're under the limit
        if (positions.length < maxPerSession) {
          // Get budget and leverage for new positions
          const { budget, leverage } = await getBudgetAndLeverage(validatedBudget, positions.length, maxPerSession);
          
          if (budget > 0) {
            // Run signal check and potentially open new positions
            const { symbol, signalScore, reason } = await runSignalCheckAndOpen(budget, leverage, marketRegime);
            
            if (symbol && signalScore > 0) {
              log('WEB_BOT', `✅ ${symbol} opened | Regime=${marketRegime} | Score=${signalScore} | Count=${sessionCount}`);
            } else {
              log('WEB_BOT', `${symbol || 'No symbol'} => ❌ No trade | Reason: ${reason}`);
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

  getStatus(): { isRunning: boolean; sessionId: string; config: TradingConfig | null } {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      config: this.config
    };
  }
}

// Export for use in the web server
export const webTradingBot = new WebTradingBot();
