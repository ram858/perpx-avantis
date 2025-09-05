# 🔄 Auto-Restart Feature

The Hyperliquid bot now includes automatic restart functionality that ensures continuous operation.

## 🎯 Restart Triggers

The bot will automatically restart in the following scenarios:

### 1. Profit Goal Reached
- **Trigger**: When the total PnL across all positions reaches the user-specified profit goal
- **Action**: All positions are closed and the bot restarts after 30 seconds
- **Log Message**: `🎯 Total profit goal reached! Closing all positions.`

### 2. All Positions Liquidated
- **Trigger**: When all open positions are liquidated (no positions remain open)
- **Action**: Bot restarts after 30 seconds to begin a new trading session
- **Log Message**: `💀 All positions liquidated! Restarting session...`

### 3. Fatal Errors
- **Trigger**: When an unhandled error occurs during trading
- **Action**: Bot restarts after 60 seconds to recover from the error
- **Log Message**: `Fatal error in session #X: [error message]`

### 4. PM2 Process Crash
- **Trigger**: When PM2 detects the process has crashed or stopped
- **Action**: PM2 automatically restarts the process after 30 seconds
- **Configuration**: Set in `ecosystem.config.js`

## ⚙️ Configuration

### Restart Delays
- **Normal restart** (profit goal/liquidation): 30 seconds
- **Error restart**: 60 seconds
- **PM2 restart**: 30 seconds

### Restart Limits
- **Maximum restarts**: 100 sessions (prevents infinite loops)
- **Session timeout**: 10,000 cycles per session (configurable)

## 📊 Session Tracking

The bot tracks:
- **Session number**: Each restart increments the session counter
- **Restart reason**: Why the session ended (profit goal, liquidation, error, etc.)
- **Total PnL**: Cumulative PnL across all sessions
- **Win rate statistics**: Maintained across restarts

## 🔍 Monitoring

### Log Messages
```
[BOT_START] Starting session #1 (restart #0)
[RESTART] Session ended with reason: profit_goal_reached | PnL: $150.00 | Restarting in 30 seconds...
[BOT_START] Starting session #2 (restart #1)
```

### PM2 Commands
```bash
# View restart logs
pm2 logs hyperliquid-bot

# Check restart count
pm2 status

# Monitor in real-time
pm2 monit
```

## 🛡️ Safety Features

### Maximum Restart Limit
- Prevents infinite restart loops
- Bot stops after 100 restarts
- Logs warning when approaching limit

### Error Handling
- Graceful handling of network errors
- Automatic retry for failed operations
- Detailed error logging

### State Management
- Win rate tracker persists across restarts
- Position data is cleared between sessions
- Fresh start for each new session

## 🚀 Deployment

### Local Testing
```bash
# Test restart logic
npm run test:restart

# Run bot locally
npm start
```

### AWS Deployment
```bash
# Deploy with PM2
./deploy.sh

# Monitor restarts
pm2 logs hyperliquid-bot --lines 50
```

## 📈 Benefits

1. **Continuous Operation**: Bot runs indefinitely without manual intervention
2. **Profit Optimization**: Automatically starts new sessions after profit goals
3. **Risk Management**: Restarts after liquidations to limit losses
4. **Error Recovery**: Handles temporary errors and network issues
5. **Performance Tracking**: Maintains statistics across multiple sessions

## 🔧 Customization

### Modify Restart Delays
Edit `index1.ts`:
```typescript
// Normal restart delay
await delay(30000); // 30 seconds

// Error restart delay  
await delay(60000); // 60 seconds
```

### Change Maximum Restarts
Edit `index1.ts`:
```typescript
const MAX_RESTARTS = 100; // Increase/decrease as needed
```

### Adjust Session Timeout
Edit `index1.ts`:
```typescript
const MAX_CYCLES = 10000; // Cycles per session
```

---

**🎉 The bot now runs continuously and automatically restarts when needed!**
