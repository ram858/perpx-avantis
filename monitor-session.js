#!/usr/bin/env node

/**
 * Enhanced monitoring script for trading session
 * Monitors session status, logs, and alerts when positions open
 */

const SESSION_ID = 'session_1763966373921';
const TRADING_ENGINE_URL = process.env.TRADING_ENGINE_URL || 'http://localhost:3001';
const LOG_FILE = '/private/tmp/trading-engine.log';
const CHECK_INTERVAL = 5000; // Check every 5 seconds
const LOG_CHECK_INTERVAL = 10000; // Check logs every 10 seconds

let lastCycle = 0;
let lastOpenPositions = 0;
let checkCount = 0;
let lastLogPosition = 0;
let positionOpenCount = 0;
let rejectionReasons = new Map(); // Track rejection reasons

const fs = require('fs');

async function checkSessionStatus() {
  try {
    const response = await fetch(`${TRADING_ENGINE_URL}/api/trading/status/${SESSION_ID}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to get session status: ${response.status} ${response.statusText}`);
      return;
    }

    const status = await response.json();
    checkCount++;

    const timestamp = new Date().toISOString();
    const cycle = status.cycle || 0;
    const openPositions = status.openPositions || 0;
    const pnl = status.pnl || 0;
    const sessionStatus = status.status || 'unknown';

    // Show status update with better formatting
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${new Date().toLocaleTimeString()}] Check #${checkCount} | Session: ${SESSION_ID.slice(-8)}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Status: ${sessionStatus.toUpperCase()} ${sessionStatus === 'running' ? '🟢' : sessionStatus === 'stopped' ? '🔴' : '🟡'}`);
    console.log(`🔄 Cycle: ${cycle} ${cycle > lastCycle ? '⬆️ NEW CYCLE' : cycle < lastCycle ? '⬇️' : '➡️'}`);
    console.log(`📈 Open Positions: ${openPositions} ${openPositions > lastOpenPositions ? '✅ NEW POSITION!' : openPositions < lastOpenPositions ? '⚠️ CLOSED' : openPositions > 0 ? '✅' : '⏳ WAITING'}`);
    console.log(`💰 PnL: $${pnl.toFixed(2)} ${pnl > 0 ? '📈' : pnl < 0 ? '📉' : '➡️'}`);
    
    // Alert if position opened
    if (openPositions > lastOpenPositions) {
      positionOpenCount++;
      console.log(`\n${'🎉'.repeat(20)}`);
      console.log(`🎉🎉🎉 POSITION #${positionOpenCount} OPENED! 🎉🎉🎉`);
      console.log(`   Previous: ${lastOpenPositions} → Current: ${openPositions}`);
      console.log(`   Session: ${SESSION_ID}`);
      console.log(`   Cycle: ${cycle}`);
      console.log(`   PnL: $${pnl.toFixed(2)}`);
      console.log(`${'🎉'.repeat(20)}\n`);
      
      // Play sound notification (if available)
      try {
        require('child_process').exec('say "Position opened" 2>/dev/null || echo ""');
      } catch (e) {}
    }

    // Alert if position closed
    if (openPositions < lastOpenPositions) {
      console.log(`\n⚠️⚠️⚠️ POSITION CLOSED ⚠️⚠️⚠️`);
      console.log(`   Previous: ${lastOpenPositions} → Current: ${openPositions}`);
      console.log(`   Final PnL: $${pnl.toFixed(2)}`);
    }

    // Show config if available
    if (status.config) {
      console.log(`⚙️  Config: Budget=$${status.config.maxBudget} | Goal=$${status.config.profitGoal} | MaxPos=${status.config.maxPerSession}`);
    }

    // Show rejection summary if we have data
    if (rejectionReasons.size > 0) {
      console.log(`\n📋 Recent Rejection Reasons (last 5):`);
      const recentReasons = Array.from(rejectionReasons.entries()).slice(-5);
      recentReasons.forEach(([symbol, reason], idx) => {
        const shortReason = reason.length > 60 ? reason.substring(0, 60) + '...' : reason;
        console.log(`   ${idx + 1}. ${symbol}: ${shortReason}`);
      });
    }

    // Update tracking
    lastCycle = cycle;
    lastOpenPositions = openPositions;

    // Check if session stopped
    if (sessionStatus === 'stopped' || sessionStatus === 'completed' || sessionStatus === 'error') {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`⚠️ Session ${sessionStatus.toUpperCase()}. Stopping monitor.`);
      if (status.error) {
        console.log(`   Error: ${status.error}`);
      }
      console.log(`   Total Positions Opened: ${positionOpenCount}`);
      console.log(`   Final PnL: $${pnl.toFixed(2)}`);
      console.log(`${'='.repeat(80)}\n`);
      process.exit(0);
    }

  } catch (error) {
    console.error(`❌ Error checking session status:`, error.message);
  }
}

function checkLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const stats = fs.statSync(LOG_FILE);
    if (stats.size < lastLogPosition) {
      // Log file was rotated
      lastLogPosition = 0;
    }

    const stream = fs.createReadStream(LOG_FILE, { start: lastLogPosition });
    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      lines.forEach(line => {
        if (line.includes('Evaluating') || line.includes('No trade') || line.includes('opened')) {
          // Extract symbol and reason
          const symbolMatch = line.match(/Evaluating (\w+)|(\w+) =>|(\w+) opened/);
          const symbol = symbolMatch ? (symbolMatch[1] || symbolMatch[2] || symbolMatch[3]) : null;
          
          if (line.includes('No trade') && symbol) {
            const reasonMatch = line.match(/Reason: (.+)/);
            const reason = reasonMatch ? reasonMatch[1] : 'Unknown';
            rejectionReasons.set(`${symbol}-${Date.now()}`, reason);
            
            // Keep only last 20 rejection reasons
            if (rejectionReasons.size > 20) {
              const firstKey = rejectionReasons.keys().next().value;
              rejectionReasons.delete(firstKey);
            }
          }
          
          // Show important log lines
          if (line.includes('AVANTIS') || line.includes('opened') || line.includes('SUCCESSFULLY')) {
            console.log(`\n📝 LOG: ${line.substring(0, 120)}`);
          }
        }
      });
    });

    stream.on('end', () => {
      lastLogPosition = stats.size;
    });

  } catch (error) {
    // Silently handle log reading errors
  }
}

// Start monitoring
console.log(`\n${'='.repeat(80)}`);
console.log(`🔍 ENHANCED SESSION MONITOR`);
console.log(`${'='.repeat(80)}`);
console.log(`📋 Session ID: ${SESSION_ID}`);
console.log(`📡 Trading Engine URL: ${TRADING_ENGINE_URL}`);
console.log(`⏱️  Status Check: Every ${CHECK_INTERVAL / 1000} seconds`);
console.log(`📝 Log Check: Every ${LOG_CHECK_INTERVAL / 1000} seconds`);
console.log(`📄 Log File: ${LOG_FILE}`);
console.log(`${'='.repeat(80)}\n`);

// Initial check
checkSessionStatus();
checkLogs();

// Set up periodic checks
const statusInterval = setInterval(checkSessionStatus, CHECK_INTERVAL);
const logInterval = setInterval(checkLogs, LOG_CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping monitor...');
  clearInterval(statusInterval);
  clearInterval(logInterval);
  console.log(`   Total positions opened during monitoring: ${positionOpenCount}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Stopping monitor...');
  clearInterval(statusInterval);
  clearInterval(logInterval);
  console.log(`   Total positions opened during monitoring: ${positionOpenCount}`);
  process.exit(0);
});

