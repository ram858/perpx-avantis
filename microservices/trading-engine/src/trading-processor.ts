import { Kafka, Producer, Consumer } from 'kafkajs';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Decimal } from 'decimal.js';

interface TradingCommand {
  command: 'start_session' | 'stop_session' | 'update_position';
  sessionId: string;
  userId: number;
  config?: {
    maxBudget: number;
    profitGoal: number;
    maxPositions: number;
    strategy: string;
  };
  timestamp: string;
}

interface TradingResult {
  sessionId: string;
  userId: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  pnl: number;
  openPositions: number;
  totalTrades: number;
  timestamp: string;
  message?: string;
}

export class TradingProcessor {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private dbPool: Pool;
  private redis: Redis;
  private activeSessions: Map<string, any> = new Map();

  constructor() {
    // Kafka setup
    this.kafka = new Kafka({
      clientId: 'trading-processor',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'trading-processor-group' });

    // Database connection
    this.dbPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'prepx_trading',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  async start() {
    await this.producer.connect();
    await this.consumer.connect();
    
    // Subscribe to trading commands
    await this.consumer.subscribe({ topic: 'trading-commands' });
    
    // Start consuming messages
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const command: TradingCommand = JSON.parse(message.value?.toString() || '{}');
          await this.processTradingCommand(command);
        } catch (error) {
          console.error('Error processing trading command:', error);
        }
      },
    });

    console.log('Trading processor started');
  }

  private async processTradingCommand(command: TradingCommand) {
    console.log(`Processing trading command: ${command.command} for session ${command.sessionId}`);

    switch (command.command) {
      case 'start_session':
        await this.startTradingSession(command);
        break;
      case 'stop_session':
        await this.stopTradingSession(command);
        break;
      case 'update_position':
        await this.updatePosition(command);
        break;
      default:
        console.warn(`Unknown trading command: ${command.command}`);
    }
  }

  private async startTradingSession(command: TradingCommand) {
    const { sessionId, userId, config } = command;

    try {
      // Initialize session state
      const sessionState = {
        sessionId,
        userId,
        config: config!,
        status: 'running',
        pnl: 0,
        openPositions: 0,
        totalTrades: 0,
        startTime: new Date(),
        positions: new Map(),
        lastUpdate: new Date()
      };

      this.activeSessions.set(sessionId, sessionState);

      // Update database
      await this.dbPool.query(
        'UPDATE trading_sessions SET status = $1, started_at = NOW() WHERE session_id = $2',
        ['running', sessionId]
      );

      // Start trading loop for this session
      this.startTradingLoop(sessionId);

      // Publish initial result
      await this.publishTradingResult({
        sessionId,
        userId,
        status: 'running',
        pnl: 0,
        openPositions: 0,
        totalTrades: 0,
        timestamp: new Date().toISOString(),
        message: 'Trading session started successfully'
      });

    } catch (error) {
      console.error(`Error starting trading session ${sessionId}:`, error);
      
      await this.publishTradingResult({
        sessionId,
        userId,
        status: 'error',
        pnl: 0,
        openPositions: 0,
        totalTrades: 0,
        timestamp: new Date().toISOString(),
        message: `Failed to start session: ${error.message}`
      });
    }
  }

  private async stopTradingSession(command: TradingCommand) {
    const { sessionId, userId } = command;

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found in active sessions`);
        return;
      }

      // Close all open positions
      await this.closeAllPositions(session);

      // Update session state
      session.status = 'stopped';
      session.lastUpdate = new Date();

      // Update database
      await this.dbPool.query(
        'UPDATE trading_sessions SET status = $1, stopped_at = NOW() WHERE session_id = $2',
        ['stopped', sessionId]
      );

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Publish final result
      await this.publishTradingResult({
        sessionId,
        userId,
        status: 'stopped',
        pnl: session.pnl,
        openPositions: 0,
        totalTrades: session.totalTrades,
        timestamp: new Date().toISOString(),
        message: 'Trading session stopped successfully'
      });

    } catch (error) {
      console.error(`Error stopping trading session ${sessionId}:`, error);
      
      await this.publishTradingResult({
        sessionId,
        userId,
        status: 'error',
        pnl: 0,
        openPositions: 0,
        totalTrades: 0,
        timestamp: new Date().toISOString(),
        message: `Failed to stop session: ${error.message}`
      });
    }
  }

  private async startTradingLoop(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const tradingInterval = setInterval(async () => {
      try {
        // Check if session is still active
        if (session.status !== 'running') {
          clearInterval(tradingInterval);
          return;
        }

        // Simulate trading cycle
        await this.executeTradingCycle(session);

        // Check profit goal
        if (session.pnl >= session.config.profitGoal) {
          session.status = 'completed';
          clearInterval(tradingInterval);
          
          await this.publishTradingResult({
            sessionId: session.sessionId,
            userId: session.userId,
            status: 'completed',
            pnl: session.pnl,
            openPositions: session.openPositions,
            totalTrades: session.totalTrades,
            timestamp: new Date().toISOString(),
            message: 'Profit goal reached!'
          });

          this.activeSessions.delete(sessionId);
        }

        // Check stop loss
        if (session.pnl <= -session.config.maxBudget * 0.8) {
          session.status = 'stopped';
          clearInterval(tradingInterval);
          
          await this.closeAllPositions(session);
          
          await this.publishTradingResult({
            sessionId: session.sessionId,
            userId: session.userId,
            status: 'stopped',
            pnl: session.pnl,
            openPositions: 0,
            totalTrades: session.totalTrades,
            timestamp: new Date().toISOString(),
            message: 'Stop loss triggered!'
          });

          this.activeSessions.delete(sessionId);
        }

        // Update last update time
        session.lastUpdate = new Date();

      } catch (error) {
        console.error(`Error in trading loop for session ${sessionId}:`, error);
        clearInterval(tradingInterval);
        session.status = 'error';
        this.activeSessions.delete(sessionId);
      }
    }, 5000); // Run every 5 seconds
  }

  private async executeTradingCycle(session: any) {
    // Simulate market analysis and trading decisions
    const shouldOpenPosition = Math.random() > 0.7; // 30% chance
    const shouldClosePosition = Math.random() > 0.8; // 20% chance

    if (shouldOpenPosition && session.openPositions < session.config.maxPositions) {
      await this.openNewPosition(session);
    }

    if (shouldClosePosition && session.openPositions > 0) {
      await this.closeRandomPosition(session);
    }

    // Simulate PnL changes for open positions
    await this.updatePositionValues(session);
  }

  private async openNewPosition(session: any) {
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    
    const position = {
      symbol,
      side,
      entryPrice: 100 + Math.random() * 100, // Simulate price
      quantity: 1,
      leverage: 5,
      openTime: new Date(),
      unrealizedPnl: 0
    };

    session.positions.set(`${symbol}_${side}`, position);
    session.openPositions++;
    session.totalTrades++;

    console.log(`Opened ${side} position for ${symbol} at $${position.entryPrice}`);
  }

  private async closeRandomPosition(session: any) {
    const positions = Array.from(session.positions.entries());
    if (positions.length === 0) return;

    const [key, position] = positions[Math.floor(Math.random() * positions.length)];
    
    // Calculate realized PnL
    const realizedPnl = (Math.random() - 0.4) * 50; // Simulate PnL
    session.pnl += realizedPnl;
    session.positions.delete(key);
    session.openPositions--;

    console.log(`Closed position ${key} with PnL: $${realizedPnl.toFixed(2)}`);
  }

  private async updatePositionValues(session: any) {
    for (const [key, position] of session.positions) {
      // Simulate price movement
      const priceChange = (Math.random() - 0.5) * 10;
      const currentPrice = position.entryPrice + priceChange;
      
      // Calculate unrealized PnL
      if (position.side === 'LONG') {
        position.unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity;
      } else {
        position.unrealizedPnl = (position.entryPrice - currentPrice) * position.quantity;
      }

      // Update total unrealized PnL
      session.unrealizedPnl = Array.from(session.positions.values())
        .reduce((sum: number, pos: any) => sum + pos.unrealizedPnl, 0);
    }
  }

  private async closeAllPositions(session: any) {
    for (const [key, position] of session.positions) {
      const realizedPnl = (Math.random() - 0.4) * 50; // Simulate PnL
      session.pnl += realizedPnl;
      console.log(`Force closed position ${key} with PnL: $${realizedPnl.toFixed(2)}`);
    }
    
    session.positions.clear();
    session.openPositions = 0;
  }

  private async updatePosition(command: TradingCommand) {
    // Handle position updates from external sources
    console.log(`Updating position for session ${command.sessionId}`);
  }

  private async publishTradingResult(result: TradingResult) {
    try {
      await this.producer.send({
        topic: 'trading-results',
        messages: [{
          key: result.sessionId,
          value: JSON.stringify(result)
        }]
      });

      // Cache result in Redis
      await this.redis.setex(
        `trading_result:${result.sessionId}`,
        3600,
        JSON.stringify(result)
      );

      console.log(`Published trading result for session ${result.sessionId}: ${result.status}`);
    } catch (error) {
      console.error('Error publishing trading result:', error);
    }
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    await this.dbPool.end();
    this.redis.disconnect();
    console.log('Trading processor stopped');
  }
}

// Start the trading processor
if (require.main === module) {
  const processor = new TradingProcessor();
  
  processor.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down trading processor');
    await processor.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down trading processor');
    await processor.stop();
    process.exit(0);
  });
}
