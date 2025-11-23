import dotenv from 'dotenv';
dotenv.config();
console.log('✅ Loaded .env');

import TelegramBot from 'node-telegram-bot-api';

// Optional proxy support
let SocksProxyAgent: any = null;
try {
  const { SocksProxyAgent: SPA } = require('socks-proxy-agent');
  SocksProxyAgent = SPA;
} catch (error) {
  console.log('ℹ️ SOCKS proxy support not available (optional dependency)');
}

// Import our Hyperliquid functions
import { getTotalPnL, getPositions, closeAllPositions } from './hyperliquid';
import { winRateTracker } from './winRateTracker';
import { getAIPOS } from './aiStorage';
import { runTelegramSession, getDefaultSessionConfig, canStartSession } from './telegramSession';
import { stopController } from './stopController';

// Production configuration - get at runtime (not build time)
function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getChatId(): string | undefined {
  return process.env.TELEGRAM_CHAT_ID;
}

function getIsProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Make Telegram bot optional for development
let bot: TelegramBot | null = null;

const BOT_TOKEN = getBotToken();
const CHAT_ID = getChatId();
const IS_PRODUCTION = getIsProduction();

if (BOT_TOKEN && CHAT_ID) {
  // Configure proxy if available
  const botOptions: any = { 
    polling: true,
    request: {
      timeout: 30000
    }
  };

  // Get SOCKS proxy at runtime
  const socksProxy = process.env.SOCKS_PROXY;
  if (socksProxy && SocksProxyAgent) {
    try {
      const agent = new SocksProxyAgent(socksProxy);
      botOptions.request.agent = agent;
      console.log('🔗 Using SOCKS proxy for Telegram connection');
    } catch (error) {
      console.warn('⚠️ Failed to configure SOCKS proxy:', error);
    }
  }

  try {
    bot = new TelegramBot(BOT_TOKEN, botOptions);
    console.log('🤖 Hyperliquid Telegram bot started. Waiting for commands...');
  } catch (error) {
    console.warn('⚠️ Failed to start Telegram bot:', error);
    bot = null;
  }
} else {
  console.log('ℹ️ Telegram bot disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  console.log('ℹ️ Bot will run without Telegram notifications');
}


// Enhanced monitoring state
interface BotState {
  isHealthy: boolean;
  lastHealthCheck: number;
  sessionInProgress: boolean;
  currentSessionId: string | null;
  shouldStop: boolean;
  stopRequestedAt: string | null;
  userGoals: {
    budget: number;
    profitGoal: number;
    timeframe: string;
    startTime: Date | null;
    targetAmount: number;
    isActive: boolean;
  } | null;
  globalStats: {
    totalSessions: number;
    successfulSessions: number;
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    totalPnL: number;
    averageROI: number;
    startTime: Date | null;
  } | null;
  lastHourlyUpdate: number;
}

const botState: BotState = {
  isHealthy: true,
  lastHealthCheck: Date.now(),
  sessionInProgress: false,
  currentSessionId: null,
  shouldStop: false,
  stopRequestedAt: null,
  userGoals: null,
  globalStats: null,
  lastHourlyUpdate: Date.now()
};

// Make botState globally accessible
declare global {
  var botState: BotState;
}
global.botState = botState;

// Rate limiting
const rateLimit = {
  lastCommand: 0,
  minInterval: 3000, // 3 seconds between commands
};

function logToTelegram(tag: string, message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
  const formatted = `[${tag}] ${timestamp} — ${message}`;
  console.log(formatted);
  
  // Don't spam in production, batch messages
  if (IS_PRODUCTION && tag === 'DEBUG') return;
  
  // Add data if provided
  const fullMessage = data ? `${formatted}\n\n${JSON.stringify(data, null, 2)}` : formatted;
  
  if (bot && CHAT_ID) { // Only send if bot is initialized
    bot.sendMessage(CHAT_ID, fullMessage, { parse_mode: 'Markdown' }).catch((err: any) => {
      console.error('Failed to send Telegram message:', err.message);
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

// Enhanced health check function
async function healthCheck(): Promise<boolean> {
  try {
    const positions = await getPositions();
    const pnl = await getTotalPnL();
    
    botState.lastHealthCheck = Date.now();
    botState.isHealthy = true;
    
    if (IS_PRODUCTION) {
      const activePositions = positions.filter(p => parseFloat(p.szi || '0') !== 0);
      logToTelegram('HEALTH', `✅ Bot healthy | Positions: ${activePositions.length} | PnL: $${pnl.toFixed(2)}`);
    }
    
    return true;
  } catch (error) {
    botState.isHealthy = false;
    logToTelegram('ERROR', `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Rate limiting check
function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimit.lastCommand < rateLimit.minInterval) {
    return false;
  }
  rateLimit.lastCommand = now;
  return true;
}

// Enhanced status command
async function sendDetailedStatus(): Promise<void> {
  try {
    const positions = await getPositions();
    const pnl = await getTotalPnL();
    const activePositions = positions.filter(p => parseFloat(p.szi || '0') !== 0);
    const stats = winRateTracker.getStats();
    
    const status = {
      healthy: botState.isHealthy,
      lastHealthCheck: new Date(botState.lastHealthCheck).toISOString(),
      sessionInProgress: botState.sessionInProgress,
      currentSessionId: botState.currentSessionId,
      uptime: Math.floor(process.uptime() / 60), // minutes
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
      nodeEnv: process.env.NODE_ENV,
      positions: {
        total: positions.length,
        active: activePositions.length,
        pnl: pnl.toFixed(2)
      },
      winRate: {
        totalTrades: stats.totalTrades,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate.toFixed(2)
      },
      userGoals: botState.userGoals,
      globalStats: botState.globalStats
    };
    
    const statusMessage = `🤖 *Hyperliquid Bot Status*\n\n` +
      `✅ Health: ${status.healthy ? 'Good' : 'Poor'}\n` +
      `🔄 Session: ${status.sessionInProgress ? 'Active' : 'Idle'}\n` +
      `⏰ Uptime: ${status.uptime} minutes\n` +
      `💾 Memory: ${status.memory} MB\n` +
      `💰 PnL: $${status.positions.pnl}\n` +
      `📊 Positions: ${status.positions.active}/${status.positions.total}\n` +
      `🎯 Win Rate: ${status.winRate.winRate}% (${status.winRate.wins}W/${status.winRate.losses}L)\n` +
      `🎯 Goal: ${status.userGoals ? `${status.userGoals.profitGoal}% ${status.userGoals.timeframe}` : 'Not set'}`;
    
    logToTelegram('STATUS', statusMessage);
  } catch (error) {
    logToTelegram('ERROR', `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced positions command
async function sendDetailedPositions(): Promise<void> {
  try {
    const positions = await getPositions();
    const pnl = await getTotalPnL();
    
    const activePositions = positions.filter(p => parseFloat(p.szi || '0') !== 0);
    
    if (activePositions.length === 0) {
      logToTelegram('POSITIONS', '📊 No active positions');
      return;
    }
    
    let positionsMessage = `📊 *Active Positions* (${activePositions.length})\n\n`;
    positionsMessage += `💰 Total PnL: $${pnl.toFixed(2)}\n\n`;
    
    activePositions.forEach((pos, index) => {
      const token = pos.coin || 'Unknown';
      const size = parseFloat(pos.szi || '0');
      const entryPrice = parseFloat(pos.entryPx || '0');
      const side = pos.side || 'unknown';
      
      positionsMessage += `${index + 1}. *${token}*\n`;
      positionsMessage += `   Size: ${size.toFixed(4)}\n`;
      positionsMessage += `   Entry: $${entryPrice.toFixed(6)}\n`;
      positionsMessage += `   Side: ${side}\n\n`;
    });
    
    logToTelegram('POSITIONS', positionsMessage);
  } catch (error) {
    logToTelegram('ERROR', `Failed to get positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Hourly update function
async function sendHourlyUpdate(): Promise<void> {
  try {
    const positions = await getPositions();
    const pnl = await getTotalPnL();
    const stats = winRateTracker.getStats();
    const activePositions = positions.filter(p => parseFloat(p.szi || '0') !== 0);
    
    let hourlyMessage = `📊 *Hourly Update*\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n` +
      `💰 Total PnL: $${pnl.toFixed(2)}\n` +
      `📊 Active Positions: ${activePositions.length}\n` +
      `🎯 Win Rate: ${stats.winRate.toFixed(2)}% (${stats.wins}W/${stats.losses}L)\n` +
      `📈 Total Trades: ${stats.totalTrades}\n` +
      `💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n` +
      `⏱️ Uptime: ${Math.floor(process.uptime() / 60)} minutes`;
    
    // Add position details if any are active
    if (activePositions.length > 0) {
      hourlyMessage += `\n\n*Active Positions:*\n`;
      activePositions.forEach((pos, index) => {
        const token = pos.coin || 'Unknown';
        const size = parseFloat(pos.szi || '0');
        const entryPrice = parseFloat(pos.entryPx || '0');
        const side = pos.side || 'unknown';
        
        hourlyMessage += `${index + 1}. ${token} (${side}) - Size: ${size.toFixed(4)}\n`;
      });
    }
    
    logToTelegram('HOURLY', hourlyMessage);
    botState.lastHourlyUpdate = Date.now();
  } catch (error) {
    logToTelegram('ERROR', `Failed to send hourly update: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced message handling with rate limiting
if (bot) { // Only add listeners if bot is initialized
  bot.on('message', (msg: any) => {
    console.log(`[RECV] ${msg.text} from chatId=${msg.chat.id}`);
    
    // Only process messages from authorized chat
    if (msg.chat.id.toString() !== CHAT_ID) {
      console.log(`[AUTH] Unauthorized message from chatId=${msg.chat.id}`);
      return;
    }
  });
}

// Enhanced command handlers
if (bot) { // Only add listeners if bot is initialized
  bot.onText(/\/start/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    const welcomeMessage = `🤖 *Hyperliquid Trading Bot*\n\n` +
      `Welcome! I'm your Hyperliquid trading bot assistant.\n\n` +
      `*Available Commands:*\n` +
      `/startbot - Start a new trading session\n` +
      `/stopbot - Stop the current trading session\n` +
      `/status - Show bot status\n` +
      `/positions - Show active positions\n` +
      `/health - Run health check\n` +
      `/closeall - Close all positions\n` +
      `/stats - Show performance stats\n` +
      `/hourly - Send hourly update\n` +
      `/logs - Show recent logs\n` +
      `/goals - Show current goals\n\n` +
      `Use /help for more information.`;
    
    logToTelegram('INFO', welcomeMessage);
  });

  bot.onText(/\/help/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    const helpMessage = `📚 *Command Help*\n\n` +
      `*Trading Commands:*\n` +
      `/startbot - Start a new trading session\n` +
      `/stopbot - Stop the current trading session\n` +
      `/closeall - Close all open positions\n\n` +
      `*Monitoring Commands:*\n` +
      `/status - Detailed bot status and health\n` +
      `/positions - List all active positions\n` +
      `/health - Run system health check\n` +
      `/hourly - Send hourly update\n` +
      `/logs - Show recent trading logs\n\n` +
      `*Analysis Commands:*\n` +
      `/goals - Show current profit goals\n` +
      `/stats - Show performance statistics\n` +
      `/performance - Show detailed performance\n\n` +
      `*System Commands:*\n` +
      `/restart - Restart the bot (if supported)\n` +
      `/config - Show current configuration\n` +
      `/setconfig - Configure session parameters`;
    
    logToTelegram('HELP', helpMessage);
  });

  // Add startbot command
  bot.onText(/\/startbot/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    // Check if bot is already running
    if (botState.sessionInProgress) {
      logToTelegram('WARN', '⚠️ Trading session already in progress. Please wait for it to complete.');
      return;
    }
    
    // Check if session can be started
    if (!canStartSession()) {
      logToTelegram('WARN', '⚠️ Cannot start session at this time. Please try again later.');
      return;
    }
    
    logToTelegram('INFO', '🚀 Starting trading session from Telegram...');
    
    try {
      // Get default configuration
      const config = getDefaultSessionConfig();
      
      // Start the trading session
      botState.sessionInProgress = true;
      botState.currentSessionId = `telegram_${Date.now()}`;
      
      // Run the Telegram session
      const result = await runTelegramSession(config);
      
      if (result.success) {
        logToTelegram('SESSION', `✅ Session completed | Reason: ${result.reason} | PnL: $${result.pnl.toFixed(2)}`);
      } else {
        logToTelegram('SESSION', `❌ Session failed | Reason: ${result.reason}`);
      }
      
    } catch (error) {
      logToTelegram('ERROR', `❌ Failed to start trading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      botState.sessionInProgress = false;
    }
  });

  // Add stopbot command
  bot.onText(/\/stopbot/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    logToTelegram('INFO', '🛑 Stopping trading session from Telegram...');
    
    try {
      // Request stop via file-based controller
      stopController.requestStop();
      
      logToTelegram('STOP', `🛑 Stop request received. Session will end gracefully after current cycle.`);
      
      // Wait a moment and check if session stopped
      setTimeout(async () => {
        if (stopController.isStopRequested()) {
          logToTelegram('INFO', '⏳ Session is still running. It will stop after completing the current cycle.');
        } else {
          logToTelegram('SUCCESS', '✅ Trading session has been stopped successfully.');
        }
      }, 2000);
      
    } catch (error) {
      logToTelegram('ERROR', `❌ Failed to stop trading session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Add setconfig command for configuring session parameters
  bot.onText(/\/setconfig/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    const configMessage = `⚙️ *Session Configuration*\n\n` +
      `Current default settings:\n` +
      `💰 Budget: $1000\n` +
      `🎯 Profit Goal: $50\n` +
      `📈 Max Positions: 5\n\n` +
      `💡 To customize these settings, you can:\n` +
      `1. Edit the \`telegramSession.ts\` file\n` +
      `2. Modify the \`getDefaultSessionConfig()\` function\n` +
      `3. Restart the bot\n\n` +
      `🛠️ Advanced configuration options are being developed.`;
    
    logToTelegram('CONFIG', configMessage);
  });

  bot.onText(/\/closeall/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    logToTelegram('INFO', '🛑 Closing all positions...');
    try {
      await closeAllPositions();
      logToTelegram('CLOSE', '✅ All positions closed successfully');
    } catch (error) {
      logToTelegram('ERROR', `Failed to close positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  bot.onText(/\/status/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    await sendDetailedStatus();
  });

  bot.onText(/\/health/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    const healthy = await healthCheck();
    logToTelegram('HEALTH', healthy ? '✅ Bot is healthy' : '❌ Bot is unhealthy');
  });

  bot.onText(/\/positions/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    await sendDetailedPositions();
  });

  bot.onText(/\/hourly/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    await sendHourlyUpdate();
  });

  bot.onText(/\/stats/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    try {
      const stats = winRateTracker.getStats();
      const pnl = await getTotalPnL();
      
      const statsMessage = `📊 *Performance Statistics*\n\n` +
        `📈 Total Trades: ${stats.totalTrades}\n` +
        `✅ Wins: ${stats.wins}\n` +
        `❌ Losses: ${stats.losses}\n` +
        `🎯 Win Rate: ${stats.winRate.toFixed(2)}%\n` +
        `💰 Total PnL: $${pnl.toFixed(2)}\n` +
        `📊 Average PnL: $${stats.averagePnL.toFixed(2)}\n` +
        `🏆 Largest Win: $${stats.largestWin.toFixed(2)}\n` +
        `💥 Largest Loss: $${stats.largestLoss.toFixed(2)}\n` +
        `📈 Average Win: $${stats.averageWin.toFixed(2)}\n` +
        `📉 Average Loss: $${stats.averageLoss.toFixed(2)}`;
      
      logToTelegram('STATS', statsMessage);
    } catch (error) {
      logToTelegram('ERROR', `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  bot.onText(/\/logs/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    try {
      const fs = require('fs');
      const logFile = 'logs/trading-bot.log';
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n');
        const recentLogs = lines.slice(-10); // Last 10 log entries
        
        let logsMessage = `📋 *Recent Logs*\n\n`;
        recentLogs.forEach((line: string, index: number) => {
          try {
            const logEntry = JSON.parse(line);
            const time = logEntry.timestamp ? logEntry.timestamp.split('T')[1].split('.')[0] : 'N/A';
            logsMessage += `${index + 1}. [${logEntry.level || 'INFO'}] ${time} - ${logEntry.message || line}\n`;
          } catch {
            logsMessage += `${index + 1}. ${line.substring(0, 100)}...\n`;
          }
        });
        
        logToTelegram('LOGS', logsMessage);
      } else {
        logToTelegram('LOGS', '📋 No logs available yet');
      }
    } catch (error) {
      logToTelegram('ERROR', `Failed to get logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  bot.onText(/\/goals/, async (msg: any) => {
    if (msg.chat.id.toString() !== CHAT_ID) return;
    
    if (!checkRateLimit()) {
      logToTelegram('WARN', 'Rate limit exceeded, please wait before next command');
      return;
    }
    
    if (botState.userGoals) {
      const goalsMessage = `🎯 *Current Goals*\n\n` +
        `💰 Budget: $${botState.userGoals.budget.toFixed(2)}\n` +
        `📈 Profit Goal: ${botState.userGoals.profitGoal}%\n` +
        `⏰ Timeframe: ${botState.userGoals.timeframe}\n` +
        `🎯 Target Amount: $${botState.userGoals.targetAmount.toFixed(2)}\n` +
        `🔄 Active: ${botState.userGoals.isActive ? 'Yes' : 'No'}\n` +
        `📅 Start Time: ${botState.userGoals.startTime ? botState.userGoals.startTime.toLocaleString() : 'Not set'}`;
      
      logToTelegram('GOALS', goalsMessage);
    } else {
      logToTelegram('GOALS', '🎯 No goals set yet');
    }
  });
}


// Function to update bot state from enhanced trading bot
export function updateBotState(userGoals: any, globalStats: any) {
  botState.userGoals = userGoals;
  botState.globalStats = globalStats;
}

// Function to send goal achievement notification
export function sendGoalAchievementNotification(goal: any, finalPnL: number, finalROI: number) {
  const achievementMessage = `🎉🎉🎉 *GOAL ACHIEVED!* 🎉🎉🎉\n\n` +
    `🎯 Target: ${goal.profitGoal}% ${goal.timeframe}\n` +
    `💰 Final PnL: $${finalPnL.toFixed(2)}\n` +
    `📈 Final ROI: ${finalROI.toFixed(2)}%\n` +
    `⏰ Achieved at: ${new Date().toLocaleString()}\n\n` +
    `Congratulations! Your trading goal has been reached! 🚀`;
  
  logToTelegram('GOAL', achievementMessage);
}

// Function to send session update
export function sendSessionUpdate(session: any) {
  const updateMessage = `📊 *Session Update*\n\n` +
    `🆔 Session ID: ${session.sessionId}\n` +
    `📈 Trades: ${session.trades}\n` +
    `✅ Wins: ${session.wins}\n` +
    `❌ Losses: ${session.losses}\n` +
    `🎯 Win Rate: ${(session.winRate * 100).toFixed(1)}%\n` +
    `💰 PnL: $${session.totalPnL?.toFixed(2) || '0.00'}\n` +
    `📊 ROI: ${session.totalROI?.toFixed(2) || '0.00'}%\n` +
    `🎉 Goal Achieved: ${session.goalAchieved ? 'Yes' : 'No'}`;
  
  logToTelegram('SESSION', updateMessage);
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  logToTelegram('SHUTDOWN', 'Bot shutting down gracefully');
  
  if (botState.sessionInProgress) {
    logToTelegram('WARN', 'Session in progress, waiting for completion...');
    // Wait for session to complete
    while (botState.sessionInProgress) {
      await delay(1000);
    }
  }
  
  if (bot) { // Only stop polling if bot is initialized
    bot.stopPolling();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  logToTelegram('SHUTDOWN', 'Bot shutting down gracefully');
  
  if (botState.sessionInProgress) {
    logToTelegram('WARN', 'Session in progress, waiting for completion...');
    while (botState.sessionInProgress) {
      await delay(1000);
    }
  }
  
  if (bot) { // Only stop polling if bot is initialized
    bot.stopPolling();
  }
  process.exit(0);
});

// Periodic health checks and hourly updates
if (IS_PRODUCTION) {
  // Health check every 5 minutes
  setInterval(async () => {
    await healthCheck();
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Hourly updates
  setInterval(async () => {
    await sendHourlyUpdate();
  }, 60 * 60 * 1000); // Every hour
}

// Initial health check
healthCheck().then(() => {
  logToTelegram('STARTUP', '🤖 Hyperliquid trading bot initialized and ready');
}).catch(error => {
  logToTelegram('ERROR', `Initial health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
});

export { bot, logToTelegram, botState, sendHourlyUpdate };
