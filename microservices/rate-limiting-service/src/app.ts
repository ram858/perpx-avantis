import express from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3007;

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis-master-1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

const redis = new Redis(redisConfig);
const redisClient = createClient(redisConfig);

// Rate limiting configurations
const rateLimiters = {
  // Global rate limiting
  global: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'global',
    points: 1000, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds
  }),

  // IP-based rate limiting
  ip: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'ip',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes
  }),

  // User-based rate limiting
  user: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'user',
    points: 200, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes
  }),

  // Trading endpoint rate limiting
  trading: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'trading',
    points: 60, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 600, // Block for 10 minutes
  }),

  // Authentication rate limiting
  auth: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'auth',
    points: 10, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 900, // Block for 15 minutes
  }),

  // Market data rate limiting
  marketData: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'market_data',
    points: 500, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 1 minute
  }),

  // Portfolio rate limiting
  portfolio: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'portfolio',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes
  }),

  // API key rate limiting
  apiKey: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'api_key',
    points: 1000, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes
  }),
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://prepx.com'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Rate limiting middleware factory
const createRateLimiter = (limiter: RateLimiterRedis, keyExtractor: (req: any) => string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const key = keyExtractor(req);
      const result = await limiter.consume(key);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext));
      
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.setHeader('Retry-After', String(secs));
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: secs,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Key extractors
const extractIP = (req: any) => req.ip || req.connection.remoteAddress;
const extractUser = (req: any) => req.headers['x-user-id'] || req.user?.id || 'anonymous';
const extractAPIKey = (req: any) => req.headers['x-api-key'] || 'no-key';

// Rate limiting middlewares
const globalRateLimit = createRateLimiter(rateLimiters.global, () => 'global');
const ipRateLimit = createRateLimiter(rateLimiters.ip, extractIP);
const userRateLimit = createRateLimiter(rateLimiters.user, extractUser);
const tradingRateLimit = createRateLimiter(rateLimiters.trading, extractIP);
const authRateLimit = createRateLimiter(rateLimiters.auth, extractIP);
const marketDataRateLimit = createRateLimiter(rateLimiters.marketData, extractIP);
const portfolioRateLimit = createRateLimiter(rateLimiters.portfolio, extractUser);
const apiKeyRateLimit = createRateLimiter(rateLimiters.apiKey, extractAPIKey);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rate-limiting-service',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Rate limit check endpoint
app.post('/check', async (req, res) => {
  try {
    const { type, key, points = 1 } = req.body;
    
    if (!type || !key) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type and key are required',
        requestId: req.requestId,
      });
    }

    const limiter = rateLimiters[type as keyof typeof rateLimiters];
    if (!limiter) {
      return res.status(400).json({
        error: 'Invalid rate limiter type',
        message: `Available types: ${Object.keys(rateLimiters).join(', ')}`,
        requestId: req.requestId,
      });
    }

    const result = await limiter.consume(key, points);
    
    res.json({
      allowed: true,
      remaining: result.remainingPoints,
      resetTime: new Date(Date.now() + result.msBeforeNext),
      requestId: req.requestId,
    });
  } catch (error) {
    const secs = Math.round(error.msBeforeNext / 1000) || 1;
    res.status(429).json({
      allowed: false,
      retryAfter: secs,
      message: 'Rate limit exceeded',
      requestId: req.requestId,
    });
  }
});

// Reset rate limit endpoint
app.post('/reset', async (req, res) => {
  try {
    const { type, key } = req.body;
    
    if (!type || !key) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type and key are required',
        requestId: req.requestId,
      });
    }

    const limiter = rateLimiters[type as keyof typeof rateLimiters];
    if (!limiter) {
      return res.status(400).json({
        error: 'Invalid rate limiter type',
        message: `Available types: ${Object.keys(rateLimiters).join(', ')}`,
        requestId: req.requestId,
      });
    }

    await limiter.delete(key);
    
    res.json({
      success: true,
      message: 'Rate limit reset successfully',
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset rate limit',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get rate limit status
app.get('/status/:type/:key', async (req, res) => {
  try {
    const { type, key } = req.params;
    
    const limiter = rateLimiters[type as keyof typeof rateLimiters];
    if (!limiter) {
      return res.status(400).json({
        error: 'Invalid rate limiter type',
        message: `Available types: ${Object.keys(rateLimiters).join(', ')}`,
        requestId: req.requestId,
      });
    }

    const result = await limiter.get(key);
    
    if (!result) {
      return res.json({
        remaining: limiter.points,
        resetTime: new Date(Date.now() + limiter.duration * 1000),
        blocked: false,
        requestId: req.requestId,
      });
    }

    res.json({
      remaining: result.remainingPoints,
      resetTime: new Date(Date.now() + result.msBeforeNext),
      blocked: result.remainingPoints <= 0,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get rate limit status',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Rate limiting middleware for different endpoints
app.use('/api/trading', globalRateLimit, ipRateLimit, tradingRateLimit);
app.use('/api/auth', globalRateLimit, ipRateLimit, authRateLimit);
app.use('/api/market', globalRateLimit, ipRateLimit, marketDataRateLimit);
app.use('/api/portfolio', globalRateLimit, userRateLimit, portfolioRateLimit);
app.use('/api/users', globalRateLimit, userRateLimit);
app.use('/api', globalRateLimit, ipRateLimit);

// Analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    const analytics = {
      service: 'rate-limiting-service',
      timestamp: new Date().toISOString(),
      rateLimiters: Object.keys(rateLimiters).map(key => ({
        name: key,
        points: rateLimiters[key as keyof typeof rateLimiters].points,
        duration: rateLimiters[key as keyof typeof rateLimiters].duration,
        blockDuration: rateLimiters[key as keyof typeof rateLimiters].blockDuration,
      })),
      redis: {
        connected: redis.status === 'ready',
        status: redis.status,
      },
      requestId: req.requestId,
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Rate limiting service error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Rate limiting service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  redis.disconnect();
  redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  redis.disconnect();
  redisClient.quit();
  process.exit(0);
});

export default app;
