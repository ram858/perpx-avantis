import express from 'express';
import Redis from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3008;

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

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

// Default configurations for different services
const circuitBreakerConfigs: Record<string, CircuitBreakerConfig> = {
  user_service: {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
    halfOpenMaxCalls: 3,
  },
  trading_service: {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 120000, // 2 minutes
    halfOpenMaxCalls: 2,
  },
  portfolio_service: {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
    halfOpenMaxCalls: 3,
  },
  market_data_service: {
    failureThreshold: 10,
    recoveryTimeout: 15000, // 15 seconds
    monitoringPeriod: 30000, // 30 seconds
    halfOpenMaxCalls: 5,
  },
  cache_service: {
    failureThreshold: 8,
    recoveryTimeout: 20000, // 20 seconds
    monitoringPeriod: 45000, // 45 seconds
    halfOpenMaxCalls: 4,
  },
};

// Circuit breaker class
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;
  private config: CircuitBreakerConfig;

  constructor(
    private serviceName: string,
    config: CircuitBreakerConfig,
    private redis: Redis
  ) {
    this.config = config;
    this.loadState();
  }

  private async loadState() {
    try {
      const stateData = await this.redis.hgetall(`circuit_breaker:${this.serviceName}`);
      if (stateData.state) {
        this.state = stateData.state as CircuitState;
        this.failureCount = parseInt(stateData.failureCount || '0');
        this.lastFailureTime = parseInt(stateData.lastFailureTime || '0');
        this.halfOpenCalls = parseInt(stateData.halfOpenCalls || '0');
      }
    } catch (error) {
      console.error(`Failed to load circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  private async saveState() {
    try {
      await this.redis.hset(`circuit_breaker:${this.serviceName}`, {
        state: this.state,
        failureCount: this.failureCount.toString(),
        lastFailureTime: this.lastFailureTime.toString(),
        halfOpenCalls: this.halfOpenCalls.toString(),
        lastUpdated: Date.now().toString(),
      });
    } catch (error) {
      console.error(`Failed to save circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
        await this.saveState();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new Error(`Circuit breaker HALF_OPEN limit reached for ${this.serviceName}`);
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure();
      throw error;
    }
  }

  private async onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenCalls = 0;
    }
    await this.saveState();
  }

  private async onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }

    await this.saveState();
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls,
      config: this.config,
    };
  }

  async reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
    await this.saveState();
  }
}

// Circuit breaker instances
const circuitBreakers: Record<string, CircuitBreaker> = {};

// Initialize circuit breakers
Object.keys(circuitBreakerConfigs).forEach(serviceName => {
  circuitBreakers[serviceName] = new CircuitBreaker(
    serviceName,
    circuitBreakerConfigs[serviceName],
    redis
  );
});

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'circuit-breaker-service',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Get circuit breaker status
app.get('/status', (req, res) => {
  const status = Object.keys(circuitBreakers).reduce((acc, serviceName) => {
    acc[serviceName] = circuitBreakers[serviceName].getStats();
    return acc;
  }, {} as Record<string, any>);

  res.json({
    circuitBreakers: status,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Get specific circuit breaker status
app.get('/status/:serviceName', (req, res) => {
  const { serviceName } = req.params;
  
  if (!circuitBreakers[serviceName]) {
    return res.status(404).json({
      error: 'Circuit breaker not found',
      message: `No circuit breaker found for service: ${serviceName}`,
      requestId: req.requestId,
    });
  }

  res.json({
    circuitBreaker: circuitBreakers[serviceName].getStats(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Reset circuit breaker
app.post('/reset/:serviceName', async (req, res) => {
  const { serviceName } = req.params;
  
  if (!circuitBreakers[serviceName]) {
    return res.status(404).json({
      error: 'Circuit breaker not found',
      message: `No circuit breaker found for service: ${serviceName}`,
      requestId: req.requestId,
    });
  }

  try {
    await circuitBreakers[serviceName].reset();
    res.json({
      success: true,
      message: `Circuit breaker reset for ${serviceName}`,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Test circuit breaker
app.post('/test/:serviceName', async (req, res) => {
  const { serviceName } = req.params;
  const { url, method = 'GET', data } = req.body;
  
  if (!circuitBreakers[serviceName]) {
    return res.status(404).json({
      error: 'Circuit breaker not found',
      message: `No circuit breaker found for service: ${serviceName}`,
      requestId: req.requestId,
    });
  }

  if (!url) {
    return res.status(400).json({
      error: 'Missing URL',
      message: 'URL is required for testing',
      requestId: req.requestId,
    });
  }

  try {
    const result = await circuitBreakers[serviceName].execute(async () => {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        data,
        timeout: 10000,
      });
      return response.data;
    });

    res.json({
      success: true,
      result,
      circuitBreakerState: circuitBreakers[serviceName].getState(),
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Circuit breaker test failed',
      message: error.message,
      circuitBreakerState: circuitBreakers[serviceName].getState(),
      requestId: req.requestId,
    });
  }
});

// Circuit breaker middleware
export const circuitBreakerMiddleware = (serviceName: string) => {
  return async (req: any, res: any, next: any) => {
    if (!circuitBreakers[serviceName]) {
      return next();
    }

    try {
      await circuitBreakers[serviceName].execute(async () => {
        // This will be handled by the actual service call
        return Promise.resolve();
      });
      next();
    } catch (error) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: `Circuit breaker is OPEN for ${serviceName}`,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Analytics endpoint
app.get('/analytics', (req, res) => {
  const analytics = {
    service: 'circuit-breaker-service',
    timestamp: new Date().toISOString(),
    circuitBreakers: Object.keys(circuitBreakers).map(serviceName => ({
      serviceName,
      state: circuitBreakers[serviceName].getState(),
      config: circuitBreakerConfigs[serviceName],
    })),
    redis: {
      connected: redis.status === 'ready',
      status: redis.status,
    },
    requestId: req.requestId,
  };

  res.json(analytics);
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Circuit breaker service error:', error);
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
  console.log(`Circuit breaker service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  redis.disconnect();
  process.exit(0);
});

export default app;
