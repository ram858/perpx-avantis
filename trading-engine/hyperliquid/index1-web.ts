import dotenv from 'dotenv';
dotenv.config();

import Decimal from 'decimal.js';
import readline from 'readline';

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
import { logToTelegram, updateBotState, sendGoalAchievementNotification, sendSessionUpdate } from './telegrambot';
import { enhancedLogger } from './enhancedLogger';
import { stopController } from './stopController';
import { recordLiquidatedTrades } from './hyperliquid';

const MAX_CYCLES = 10000;

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

function log(tag: string, message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${tag}] ${timestamp} — ${message}`;
  console.log(logMessage);
}

// Check if running in web mode - get at runtime (not build time)
function getIsWebMode(): boolean {
  return process.env.WEB_MODE === 'true';
}

function getSessionId(): string | undefined {
  return process.env.SESSION_ID;
}

function getTradingConfig(): string | undefined {
  return process.env.TRADING_CONFIG;
}

const isWebMode = getIsWebMode();
const sessionId = getSessionId();
const tradingConfig = getTradingConfig();

interface WebTradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
}

async function runWebSession() {
  if (!isWebMode || !sessionId || !tradingConfig) {
    console.error('Web mode requires WEB_MODE=true, SESSION_ID, and TRADING_CONFIG environment variables');
    process.exit(1);
  }

  let config: WebTradingConfig;
  try {
    config = JSON.parse(tradingConfig);
  } catch (error) {
    console.error('Failed to parse TRADING_CONFIG:', error);
    process.exit(1);
  }

  log('WEB_SESSION', `Starting session ${sessionId} with config: ${JSON.stringify(config)}`);

  const maxBudgetDecimal = new Decimal(config.maxBudget);
  let sessionCount = 0;
  let totalPnL = 0;

  const tokens = Object.keys(priceFeeds);
  const openMap: Record<string, boolean> = {};
  tokens.forEach(t => openMap[t] = false);

  await initBlockchain();
  log('START', `Web session initialized | Budget: $${config.maxBudget} | Goal: $${config.profitGoal}`);
  
  // Clear any existing stop request for new session
  stopController.clearStopRequest();
  
  // Start enhanced logging session
  enhancedLogger.startSession(sessionId, {
    budget: config.maxBudget,
    profitGoal: config.profitGoal,
    maxPositions: config.maxPerSession
  });
  
  // Send Telegram notification for session start (if configured)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    logToTelegram('SESSION', `🚀 Web session started | Budget: $${config.maxBudget} | Goal: $${config.profitGoal} | Max Positions: ${config.maxPerSession}`);
  }

  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    log('CYCLE', `--- Cycle ${cycle + 1} ---`);
    
    // Check if stop was requested from Telegram
    if (stopController.isStopRequested()) {
      const stopTime = stopController.getStopRequestTime();
      log('STOP', `🛑 Stop requested from Telegram at ${stopTime}. Ending session gracefully.`);
      
      if (process.env.TELEGRAM_BOT_TOKEN) {
        logToTelegram('STOP', `🛑 Web session stopped by user request from Telegram.`);
      }
      
      // Enhanced logging for manual stop
      const stopStats = winRateTracker.getStats();
      enhancedLogger.endSession('manual_stop', totalPnL, {
        ...stopStats,
        totalROI: (totalPnL / config.maxBudget) * 100
      });
      
      // Clear the stop request
      stopController.clearStopRequest();
      
      log('SESSION_END', `Web session ended manually. PnL: $${totalPnL.toFixed(2)}`);
      return { shouldRestart: false, reason: 'manual_stop', pnl: totalPnL };
    }

    // Fetch positions and update open map
    const pos = await getPositions().catch(() => []);

    const currentlyOpen = new Set<string>();

    for (const p of pos) {
      const rawSzi = p.szi ?? '0';
      const szi = Number(rawSzi);

      if (!Number.isFinite(szi)) {
        console.warn(`⚠️ Invalid position size: szi="${rawSzi}" for coin=${p.coin}`);
        continue;
      }

      if (Math.abs(szi) < 1) continue;

      const token = tokens.find(t => p.coin?.toUpperCase().includes(t));
      if (token) currentlyOpen.add(token);
    }
    
    tokens.forEach(t => openMap[t] = currentlyOpen.has(t));
    const openCount = currentlyOpen.size;
    const slotsLeft = config.maxPerSession - openCount;

    // Check total PnL and close all positions if profit goal is reached
    const pnl = await getTotalPnL().catch(() => null);
    if (pnl != null) {
      totalPnL = pnl;
      log('PNL', `Total PnL: $${pnl.toFixed(2)} | Goal: $${config.profitGoal}`);
      
      // Enhanced logging for position updates
      enhancedLogger.logPositionUpdate(
        'ALL', // Log for all positions
        0, // Current price not available here
        0, // Individual PnL not available here
        openCount,
        pnl,
        cycle + 1
      );
      
      // Close all positions if total profit goal is reached
      if (pnl >= config.profitGoal) {
        log('PROFIT_GOAL', `🎯 Total profit goal reached! Closing all positions. PnL: $${pnl.toFixed(2)} >= Goal: $${config.profitGoal}`);
        
        // Get all positions and close them
        const positions = await getPositions().catch(() => []);
        let closedCount = 0;
        
        for (const pos of positions) {
          if (!pos.coin || !pos.szi || Math.abs(Number(pos.szi)) < 1) continue;
          
          try {
            let mark = await fetchPrice(pos.coin);
            
            // Retry once if price fetch failed
            if (!mark || mark <= 0) {
              console.warn(`⚠️ Retrying price fetch for ${pos.coin}...`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              mark = await fetchPrice(pos.coin);
            }
            
            if (mark && mark > 0) {
              await closePosition(pos.coin, pos, "total_profit_goal_reached", mark);
              closedCount++;
              log('CLOSE', `✅ Closed ${pos.coin} position due to total profit goal`);
            } else {
              console.warn(`⚠️ Cannot close ${pos.coin} position - invalid price after retry: ${mark}`);
            }
          } catch (e) {
            console.warn(`❌ Failed to close ${pos.coin}:`, e);
          }
        }
        
        if (closedCount > 0) {
          log('SESSION_END', `🎉 Web session completed! Total PnL: $${pnl.toFixed(2)} | Closed ${closedCount} positions`);
          
          // Try to record any remaining liquidated trades
          await recordLiquidatedTrades();
          
          // Log final win rate statistics
          console.log('\n🎯 [SESSION_END] Final Win Rate Statistics:');
          winRateTracker.logStats();
          
          // Send Telegram notification for profit goal achievement (if configured)
          if (process.env.TELEGRAM_BOT_TOKEN) {
            const stats = winRateTracker.getStats();
            const sessionData = {
              sessionId: sessionId,
              trades: stats.totalTrades,
              wins: stats.wins,
              losses: stats.losses,
              winRate: stats.winRate / 100,
              totalPnL: pnl,
              totalROI: (pnl / config.maxBudget) * 100,
              goalAchieved: true
            };
            sendSessionUpdate(sessionData);
          }
          
          // Enhanced logging for session end
          const finalStats = winRateTracker.getStats();
          enhancedLogger.endSession('profit_goal_reached', pnl, {
            ...finalStats,
            totalROI: (pnl / config.maxBudget) * 100
          });
          
          log('SESSION_END', `Web session completed successfully. PnL: $${pnl.toFixed(2)}`);
          return { shouldRestart: true, reason: 'profit_goal_reached', pnl: pnl };
        }
      }
    }

    // Only check individual position profit goals if total PnL hasn't reached the goal
    if (pnl == null || pnl < config.profitGoal) {
      const { closedAny, closedCount } = await checkAndCloseForTP({
        client,
        account,
        closePosition,
        profitGoal: config.profitGoal // Pass profit goal for individual position checks
      });

      if (closedAny) {
        sessionCount = Math.max(0, sessionCount - closedCount);
        
        // Log win rate stats after any positions are closed
        winRateTracker.logStats();
      }
    }

    // Check if all positions are liquidated (only if we had positions before and now have none)
    // Don't trigger liquidation on fresh start
    if (openCount === 0 && slotsLeft === config.maxPerSession && sessionCount > 0) {
      log('LIQUIDATION', `💀 All positions liquidated! Restarting session...`);
      
      // Try to record any remaining liquidated trades
      await recordLiquidatedTrades();
      
      // Log final win rate statistics
      console.log('\n💀 [LIQUIDATION] Final Win Rate Statistics:');
      winRateTracker.logStats();
      
      // Send Telegram notification for liquidation (if configured)
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const stats = winRateTracker.getStats();
        const sessionData = {
          sessionId: sessionId,
          trades: stats.totalTrades,
          wins: stats.wins,
          losses: stats.losses,
          winRate: stats.winRate / 100,
          totalPnL: pnl || 0,
          totalROI: ((pnl || 0) / config.maxBudget) * 100,
          goalAchieved: false
        };
        sendSessionUpdate(sessionData);
      }
      
      // Enhanced logging for session end (liquidation)
      const liquidationStats = winRateTracker.getStats();
      enhancedLogger.endSession('all_liquidated', pnl || 0, {
        ...liquidationStats,
        totalROI: ((pnl || 0) / config.maxBudget) * 100
      });
      
      log('SESSION_END', `Web session ended due to liquidation. PnL: $${(pnl || 0).toFixed(2)}`);
      return { shouldRestart: true, reason: 'all_liquidated', pnl: pnl || 0 };
    }

    // Entry logic
    if (slotsLeft > 0) {
      let entriesThis = 0;

      for (const symbol of tokens) {
        if (openMap[symbol] || entriesThis >= slotsLeft) continue;

        const ohlcv15 = await getCachedOHLCV(symbol, '15m', 300).catch(() => null);
        const ohlcv30 = await getCachedOHLCV(symbol, '30m', 300).catch(() => null);
        if (!ohlcv15 || !ohlcv30 || ohlcv15.close.length < 100) {
          log('SKIP', `${symbol} missing or insufficient data`);
          continue;
        }

        const { regime } = await guessMarketRegime(symbol, ohlcv15, ohlcv30);
        
        // Calculate budget per position from user's input, not regime-based budget
        const budgetValidation = validateAndCapBudget(config.maxBudget, config.maxPerSession, symbol, 'avantis');
        const perPositionBudget = budgetValidation.budgetPerPosition;

        // Get maximum leverage for this symbol using user's budget
        const { leverage } = getBudgetAndLeverage(regime, symbol, perPositionBudget);

        // Log warnings if any
        if (budgetValidation.warnings) {
          budgetValidation.warnings.forEach(warning => {
            log('WARNING', warning);
          });
        }

        log('ENTRY', `${symbol} | Regime=${regime} | Budget=$${perPositionBudget.toFixed(2)} (${config.maxBudget}/${config.maxPerSession}) | MAX_LEV=${leverage}x`);

        const res = await runSignalCheckAndOpen({
          symbol,
          perPositionBudget: perPositionBudget,
          leverage,
          regimeOverride: regime // explicit regime support
        });

        const { positionOpened, marketRegime, signalScore, reason } = res;

        if (positionOpened) {
          openMap[symbol] = true;
          sessionCount++;
          entriesThis++;
          
          log('TRADE', `✅ ${symbol} opened | Regime=${marketRegime} | Score=${signalScore} | Count=${sessionCount}`);
          
          // Enhanced logging for trade opening
          enhancedLogger.logTradeOpen(
            symbol,
            'LONG', // Will be determined by the actual trade direction
            0, // Entry price will be logged when position is actually opened
            0, // Position size will be logged when position is actually opened
            leverage,
            {
              marketRegime: marketRegime,
              signalScore: signalScore,
              rsi: 0, // Will be logged from stored position data
              macdHist: 0,
              emaSlope: 0,
              atrPct: 0,
              adx: 0,
              volumePct: 0,
              divergenceScore: 0
            },
            cycle + 1
          );
          
          // Send Telegram notification for new position (if configured)
          if (process.env.TELEGRAM_BOT_TOKEN) {
            logToTelegram('TRADE', `✅ ${symbol} position opened | Regime: ${marketRegime} | Signal Score: ${(signalScore * 100).toFixed(1)}%`);
          }
        } else {
          log('SKIP', `${symbol} => ❌ No trade | Reason: ${reason}`);
        }
      }
    }

    await delay(5000); // 5s between cycles for faster trading
  }
  
  // If we reach here, the session completed normally without profit goal or liquidation
  log('SESSION_END', `Web session completed normally after ${MAX_CYCLES} cycles`);
  
  // Enhanced logging for normal session end
  const normalStats = winRateTracker.getStats();
  enhancedLogger.endSession('max_cycles_reached', totalPnL, {
    ...normalStats,
    totalROI: (totalPnL / config.maxBudget) * 100
  });
  
  log('SESSION_END', `Web session completed after max cycles. PnL: $${totalPnL.toFixed(2)}`);
  return { shouldRestart: false, reason: 'max_cycles_reached', pnl: totalPnL };
}

// Main execution
if (isWebMode) {
  runWebSession().catch(err => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log('FATAL', `Critical error in web session: ${errorMessage}`);
    process.exit(1);
  });
} else {
  // Original CLI behavior - import and run the original index1.ts
  console.log('Running in CLI mode. Please use index1.ts for CLI functionality.');
  process.exit(0);
}
