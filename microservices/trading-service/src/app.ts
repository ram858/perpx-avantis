import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 3002;

// Database connections
const dbPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'prepx_trading',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  max: 50, // Higher connection pool for trading operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection for real-time data
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'trading-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'trading-service-group' });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting for trading operations
const tradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 trading requests per minute
  message: 'Too many trading requests',
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await dbPool.query('SELECT 1');
    await redis.ping();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        kafka: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Start trading session
app.post('/api/trading/start', authenticateToken, tradingLimiter, async (req, res) => {
  const { maxBudget, profitGoal, maxPositions, strategy } = req.body;
  const userId = req.user.userId;
  
  try {
    // Validate input
    if (!maxBudget || !profitGoal || !maxPositions) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check user's active sessions limit
    const activeSessions = await dbPool.query(
      'SELECT COUNT(*) FROM trading_sessions WHERE user_id = $1 AND status IN ($2, $3)',
      [userId, 'running', 'starting']
    );
    
    if (parseInt(activeSessions.rows[0].count) >= 5) {
      return res.status(429).json({ error: 'Maximum active sessions reached' });
    }
    
    // Create trading session
    const sessionResult = await dbPool.query(
      `INSERT INTO trading_sessions 
       (user_id, max_budget, profit_goal, max_positions, strategy, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, session_id`,
      [userId, maxBudget, profitGoal, maxPositions, strategy || 'default', 'starting']
    );
    
    const session = sessionResult.rows[0];
    
    // Publish trading command to Kafka
    await producer.send({
      topic: 'trading-commands',
      messages: [{
        key: session.session_id,
        value: JSON.stringify({
          command: 'start_session',
          sessionId: session.session_id,
          userId: userId,
          config: {
            maxBudget,
            profitGoal,
            maxPositions,
            strategy
          },
          timestamp: new Date().toISOString()
        })
      }]
    });
    
    // Cache session data
    await redis.setex(`session:${session.session_id}`, 86400, JSON.stringify({
      sessionId: session.session_id,
      userId: userId,
      status: 'starting',
      config: { maxBudget, profitGoal, maxPositions, strategy }
    }));
    
    res.status(201).json({
      message: 'Trading session started',
      sessionId: session.session_id,
      status: 'starting'
    });
    
  } catch (error) {
    console.error('Start trading error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop trading session
app.post('/api/trading/stop/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;
  
  try {
    // Verify session ownership
    const sessionResult = await dbPool.query(
      'SELECT id, status FROM trading_sessions WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    
    if (session.status === 'stopped' || session.status === 'completed') {
      return res.status(400).json({ error: 'Session already stopped' });
    }
    
    // Publish stop command to Kafka
    await producer.send({
      topic: 'trading-commands',
      messages: [{
        key: sessionId,
        value: JSON.stringify({
          command: 'stop_session',
          sessionId: sessionId,
          userId: userId,
          timestamp: new Date().toISOString()
        })
      }]
    });
    
    // Update session status
    await dbPool.query(
      'UPDATE trading_sessions SET status = $1, stopped_at = NOW() WHERE session_id = $2',
      ['stopping', sessionId]
    );
    
    res.json({
      message: 'Trading session stopping',
      sessionId: sessionId,
      status: 'stopping'
    });
    
  } catch (error) {
    console.error('Stop trading error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session status
app.get('/api/trading/session/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;
  
  try {
    // Try to get from cache first
    const cachedSession = await redis.get(`session:${sessionId}`);
    if (cachedSession) {
      const sessionData = JSON.parse(cachedSession);
      if (sessionData.userId === userId) {
        return res.json(sessionData);
      }
    }
    
    // Get from database
    const result = await dbPool.query(
      `SELECT s.*, p.current_pnl, p.open_positions, p.total_trades
       FROM trading_sessions s
       LEFT JOIN portfolio_snapshots p ON s.session_id = p.session_id
       WHERE s.session_id = $1 AND s.user_id = $2`,
      [sessionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = result.rows[0];
    
    const sessionData = {
      sessionId: session.session_id,
      userId: session.user_id,
      status: session.status,
      config: {
        maxBudget: session.max_budget,
        profitGoal: session.profit_goal,
        maxPositions: session.max_positions,
        strategy: session.strategy
      },
      metrics: {
        currentPnl: session.current_pnl || 0,
        openPositions: session.open_positions || 0,
        totalTrades: session.total_trades || 0
      },
      timestamps: {
        createdAt: session.created_at,
        startedAt: session.started_at,
        stoppedAt: session.stopped_at
      }
    };
    
    // Cache the result
    await redis.setex(`session:${sessionId}`, 300, JSON.stringify(sessionData));
    
    res.json(sessionData);
    
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's trading history
app.get('/api/trading/history', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const result = await dbPool.query(
      `SELECT s.*, p.current_pnl, p.open_positions, p.total_trades
       FROM trading_sessions s
       LEFT JOIN portfolio_snapshots p ON s.session_id = p.session_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), offset]
    );
    
    const sessions = result.rows.map(session => ({
      sessionId: session.session_id,
      status: session.status,
      config: {
        maxBudget: session.max_budget,
        profitGoal: session.profit_goal,
        maxPositions: session.max_positions,
        strategy: session.strategy
      },
      metrics: {
        currentPnl: session.current_pnl || 0,
        openPositions: session.open_positions || 0,
        totalTrades: session.total_trades || 0
      },
      timestamps: {
        createdAt: session.created_at,
        startedAt: session.started_at,
        stoppedAt: session.stopped_at
      }
    }));
    
    res.json({
      sessions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.rowCount
      }
    });
    
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Kafka consumer setup
async function setupKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'trading-results' });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const data = JSON.parse(message.value?.toString() || '{}');
        
        // Update session status in database
        await dbPool.query(
          `UPDATE trading_sessions 
           SET status = $1, current_pnl = $2, updated_at = NOW()
           WHERE session_id = $3`,
          [data.status, data.pnl, data.sessionId]
        );
        
        // Update cache
        await redis.setex(`session:${data.sessionId}`, 86400, JSON.stringify({
          sessionId: data.sessionId,
          userId: data.userId,
          status: data.status,
          metrics: {
            currentPnl: data.pnl,
            openPositions: data.openPositions,
            totalTrades: data.totalTrades
          }
        }));
        
        console.log(`Updated session ${data.sessionId} with status ${data.status}`);
        
      } catch (error) {
        console.error('Error processing trading result:', error);
      }
    },
  });
}

// Initialize Kafka producer
async function initializeKafka() {
  await producer.connect();
  await setupKafkaConsumer();
  console.log('Kafka producer and consumer initialized');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await producer.disconnect();
  await consumer.disconnect();
  await dbPool.end();
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await producer.disconnect();
  await consumer.disconnect();
  await dbPool.end();
  redis.disconnect();
  process.exit(0);
});

// Start server
app.listen(port, async () => {
  console.log(`Trading service running on port ${port}`);
  await initializeKafka();
});

export default app;
