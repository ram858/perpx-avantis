import express from 'express';
import Redis from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3009;

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

// Analytics data structures
interface RequestMetrics {
  timestamp: number;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  userAgent: string;
  ip: string;
  userId?: string;
  requestId: string;
  serviceName: string;
  region?: string;
  loadBalancerAlgorithm?: string;
}

interface ServiceMetrics {
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  lastUpdated: number;
}

interface UserMetrics {
  userId: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  lastActivity: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

// Analytics storage keys
const ANALYTICS_KEYS = {
  REQUESTS: 'analytics:requests',
  SERVICE_METRICS: 'analytics:service_metrics',
  USER_METRICS: 'analytics:user_metrics',
  REAL_TIME: 'analytics:real_time',
  HOURLY: 'analytics:hourly',
  DAILY: 'analytics:daily',
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

// Analytics collection middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    try {
      const metrics: RequestMetrics = {
        timestamp: startTime,
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
        userAgent: req.get('User-Agent') || 'unknown',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userId: req.headers['x-user-id'] as string,
        requestId: req.requestId,
        serviceName: 'api-analytics-service',
        region: req.headers['x-client-region'] as string,
        loadBalancerAlgorithm: req.headers['x-lb-algorithm'] as string,
      };

      await recordRequestMetrics(metrics);
    } catch (error) {
      console.error('Failed to record request metrics:', error);
    }
  });

  next();
});

// Record request metrics
async function recordRequestMetrics(metrics: RequestMetrics) {
  try {
    // Store raw request data
    await redis.lpush(ANALYTICS_KEYS.REQUESTS, JSON.stringify(metrics));
    
    // Keep only last 10000 requests
    await redis.ltrim(ANALYTICS_KEYS.REQUESTS, 0, 9999);
    
    // Update service metrics
    await updateServiceMetrics(metrics);
    
    // Update user metrics if user ID is present
    if (metrics.userId) {
      await updateUserMetrics(metrics);
    }
    
    // Update real-time metrics
    await updateRealTimeMetrics(metrics);
    
    // Update hourly metrics
    await updateHourlyMetrics(metrics);
    
    // Update daily metrics
    await updateDailyMetrics(metrics);
  } catch (error) {
    console.error('Failed to record request metrics:', error);
  }
}

// Update service metrics
async function updateServiceMetrics(metrics: RequestMetrics) {
  const serviceKey = `${ANALYTICS_KEYS.SERVICE_METRICS}:${metrics.serviceName}`;
  
  try {
    const existing = await redis.hgetall(serviceKey);
    const current: ServiceMetrics = existing.totalRequests ? {
      totalRequests: parseInt(existing.totalRequests),
      successRequests: parseInt(existing.successRequests),
      errorRequests: parseInt(existing.errorRequests),
      averageResponseTime: parseFloat(existing.averageResponseTime),
      p95ResponseTime: parseFloat(existing.p95ResponseTime),
      p99ResponseTime: parseFloat(existing.p99ResponseTime),
      requestsPerMinute: parseFloat(existing.requestsPerMinute),
      errorRate: parseFloat(existing.errorRate),
      lastUpdated: parseInt(existing.lastUpdated),
    } : {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      lastUpdated: Date.now(),
    };

    // Update counters
    current.totalRequests++;
    if (metrics.statusCode >= 200 && metrics.statusCode < 400) {
      current.successRequests++;
    } else {
      current.errorRequests++;
    }

    // Update response time (simple moving average)
    current.averageResponseTime = (current.averageResponseTime * (current.totalRequests - 1) + metrics.responseTime) / current.totalRequests;
    
    // Update error rate
    current.errorRate = (current.errorRequests / current.totalRequests) * 100;
    
    // Update requests per minute (simplified)
    const timeDiff = Date.now() - current.lastUpdated;
    if (timeDiff > 0) {
      current.requestsPerMinute = (current.totalRequests / (timeDiff / 60000));
    }
    
    current.lastUpdated = Date.now();

    // Store updated metrics
    await redis.hset(serviceKey, {
      totalRequests: current.totalRequests.toString(),
      successRequests: current.successRequests.toString(),
      errorRequests: current.errorRequests.toString(),
      averageResponseTime: current.averageResponseTime.toString(),
      p95ResponseTime: current.p95ResponseTime.toString(),
      p99ResponseTime: current.p99ResponseTime.toString(),
      requestsPerMinute: current.requestsPerMinute.toString(),
      errorRate: current.errorRate.toString(),
      lastUpdated: current.lastUpdated.toString(),
    });
  } catch (error) {
    console.error('Failed to update service metrics:', error);
  }
}

// Update user metrics
async function updateUserMetrics(metrics: RequestMetrics) {
  const userKey = `${ANALYTICS_KEYS.USER_METRICS}:${metrics.userId}`;
  
  try {
    const existing = await redis.hgetall(userKey);
    const current: UserMetrics = existing.totalRequests ? {
      userId: metrics.userId!,
      totalRequests: parseInt(existing.totalRequests),
      successRequests: parseInt(existing.successRequests),
      errorRequests: parseInt(existing.errorRequests),
      averageResponseTime: parseFloat(existing.averageResponseTime),
      lastActivity: parseInt(existing.lastActivity),
      topEndpoints: JSON.parse(existing.topEndpoints || '[]'),
    } : {
      userId: metrics.userId!,
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      averageResponseTime: 0,
      lastActivity: Date.now(),
      topEndpoints: [],
    };

    // Update counters
    current.totalRequests++;
    if (metrics.statusCode >= 200 && metrics.statusCode < 400) {
      current.successRequests++;
    } else {
      current.errorRequests++;
    }

    // Update response time
    current.averageResponseTime = (current.averageResponseTime * (current.totalRequests - 1) + metrics.responseTime) / current.totalRequests;
    
    // Update last activity
    current.lastActivity = Date.now();
    
    // Update top endpoints
    const endpointIndex = current.topEndpoints.findIndex(ep => ep.endpoint === metrics.endpoint);
    if (endpointIndex >= 0) {
      current.topEndpoints[endpointIndex].count++;
    } else {
      current.topEndpoints.push({ endpoint: metrics.endpoint, count: 1 });
    }
    
    // Keep only top 10 endpoints
    current.topEndpoints.sort((a, b) => b.count - a.count);
    current.topEndpoints = current.topEndpoints.slice(0, 10);

    // Store updated metrics
    await redis.hset(userKey, {
      userId: current.userId,
      totalRequests: current.totalRequests.toString(),
      successRequests: current.successRequests.toString(),
      errorRequests: current.errorRequests.toString(),
      averageResponseTime: current.averageResponseTime.toString(),
      lastActivity: current.lastActivity.toString(),
      topEndpoints: JSON.stringify(current.topEndpoints),
    });
  } catch (error) {
    console.error('Failed to update user metrics:', error);
  }
}

// Update real-time metrics
async function updateRealTimeMetrics(metrics: RequestMetrics) {
  const realTimeKey = `${ANALYTICS_KEYS.REAL_TIME}:${Math.floor(Date.now() / 60000)}`; // 1-minute buckets
  
  try {
    await redis.hincrby(realTimeKey, 'total_requests', 1);
    await redis.hincrby(realTimeKey, `status_${metrics.statusCode}`, 1);
    await redis.hincrby(realTimeKey, `method_${metrics.method}`, 1);
    await redis.expire(realTimeKey, 3600); // Keep for 1 hour
  } catch (error) {
    console.error('Failed to update real-time metrics:', error);
  }
}

// Update hourly metrics
async function updateHourlyMetrics(metrics: RequestMetrics) {
  const hour = new Date().getHours();
  const hourlyKey = `${ANALYTICS_KEYS.HOURLY}:${hour}`;
  
  try {
    await redis.hincrby(hourlyKey, 'total_requests', 1);
    await redis.hincrby(hourlyKey, `status_${metrics.statusCode}`, 1);
    await redis.hincrby(hourlyKey, `method_${metrics.method}`, 1);
    await redis.expire(hourlyKey, 86400 * 7); // Keep for 7 days
  } catch (error) {
    console.error('Failed to update hourly metrics:', error);
  }
}

// Update daily metrics
async function updateDailyMetrics(metrics: RequestMetrics) {
  const date = new Date().toISOString().split('T')[0];
  const dailyKey = `${ANALYTICS_KEYS.DAILY}:${date}`;
  
  try {
    await redis.hincrby(dailyKey, 'total_requests', 1);
    await redis.hincrby(dailyKey, `status_${metrics.statusCode}`, 1);
    await redis.hincrby(dailyKey, `method_${metrics.method}`, 1);
    await redis.expire(dailyKey, 86400 * 30); // Keep for 30 days
  } catch (error) {
    console.error('Failed to update daily metrics:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-analytics-service',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Get service metrics
app.get('/metrics/service/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const serviceKey = `${ANALYTICS_KEYS.SERVICE_METRICS}:${serviceName}`;
    
    const metrics = await redis.hgetall(serviceKey);
    
    if (!metrics.totalRequests) {
      return res.status(404).json({
        error: 'Service not found',
        message: `No metrics found for service: ${serviceName}`,
        requestId: req.requestId,
      });
    }

    res.json({
      serviceName,
      metrics: {
        totalRequests: parseInt(metrics.totalRequests),
        successRequests: parseInt(metrics.successRequests),
        errorRequests: parseInt(metrics.errorRequests),
        averageResponseTime: parseFloat(metrics.averageResponseTime),
        p95ResponseTime: parseFloat(metrics.p95ResponseTime),
        p99ResponseTime: parseFloat(metrics.p99ResponseTime),
        requestsPerMinute: parseFloat(metrics.requestsPerMinute),
        errorRate: parseFloat(metrics.errorRate),
        lastUpdated: new Date(parseInt(metrics.lastUpdated)),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get user metrics
app.get('/metrics/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userKey = `${ANALYTICS_KEYS.USER_METRICS}:${userId}`;
    
    const metrics = await redis.hgetall(userKey);
    
    if (!metrics.totalRequests) {
      return res.status(404).json({
        error: 'User not found',
        message: `No metrics found for user: ${userId}`,
        requestId: req.requestId,
      });
    }

    res.json({
      userId,
      metrics: {
        totalRequests: parseInt(metrics.totalRequests),
        successRequests: parseInt(metrics.successRequests),
        errorRequests: parseInt(metrics.errorRequests),
        averageResponseTime: parseFloat(metrics.averageResponseTime),
        lastActivity: new Date(parseInt(metrics.lastActivity)),
        topEndpoints: JSON.parse(metrics.topEndpoints || '[]'),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get real-time metrics
app.get('/metrics/real-time', async (req, res) => {
  try {
    const currentMinute = Math.floor(Date.now() / 60000);
    const realTimeKey = `${ANALYTICS_KEYS.REAL_TIME}:${currentMinute}`;
    
    const metrics = await redis.hgetall(realTimeKey);
    
    res.json({
      timestamp: new Date(currentMinute * 60000),
      metrics: {
        totalRequests: parseInt(metrics.total_requests || '0'),
        statusCodes: Object.keys(metrics)
          .filter(key => key.startsWith('status_'))
          .reduce((acc, key) => {
            acc[key.replace('status_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
        methods: Object.keys(metrics)
          .filter(key => key.startsWith('method_'))
          .reduce((acc, key) => {
            acc[key.replace('method_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get real-time metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get hourly metrics
app.get('/metrics/hourly/:hour?', async (req, res) => {
  try {
    const hour = req.params.hour ? parseInt(req.params.hour) : new Date().getHours();
    
    if (hour < 0 || hour > 23) {
      return res.status(400).json({
        error: 'Invalid hour',
        message: 'Hour must be between 0 and 23',
        requestId: req.requestId,
      });
    }
    
    const hourlyKey = `${ANALYTICS_KEYS.HOURLY}:${hour}`;
    const metrics = await redis.hgetall(hourlyKey);
    
    res.json({
      hour,
      metrics: {
        totalRequests: parseInt(metrics.total_requests || '0'),
        statusCodes: Object.keys(metrics)
          .filter(key => key.startsWith('status_'))
          .reduce((acc, key) => {
            acc[key.replace('status_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
        methods: Object.keys(metrics)
          .filter(key => key.startsWith('method_'))
          .reduce((acc, key) => {
            acc[key.replace('method_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get hourly metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get daily metrics
app.get('/metrics/daily/:date?', async (req, res) => {
  try {
    const date = req.params.date || new Date().toISOString().split('T')[0];
    
    const dailyKey = `${ANALYTICS_KEYS.DAILY}:${date}`;
    const metrics = await redis.hgetall(dailyKey);
    
    res.json({
      date,
      metrics: {
        totalRequests: parseInt(metrics.total_requests || '0'),
        statusCodes: Object.keys(metrics)
          .filter(key => key.startsWith('status_'))
          .reduce((acc, key) => {
            acc[key.replace('status_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
        methods: Object.keys(metrics)
          .filter(key => key.startsWith('method_'))
          .reduce((acc, key) => {
            acc[key.replace('method_', '')] = parseInt(metrics[key]);
            return acc;
          }, {} as Record<string, number>),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get daily metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get all services metrics
app.get('/metrics/services', async (req, res) => {
  try {
    const serviceKeys = await redis.keys(`${ANALYTICS_KEYS.SERVICE_METRICS}:*`);
    const services = [];
    
    for (const key of serviceKeys) {
      const serviceName = key.replace(`${ANALYTICS_KEYS.SERVICE_METRICS}:`, '');
      const metrics = await redis.hgetall(key);
      
      services.push({
        serviceName,
        metrics: {
          totalRequests: parseInt(metrics.totalRequests || '0'),
          successRequests: parseInt(metrics.successRequests || '0'),
          errorRequests: parseInt(metrics.errorRequests || '0'),
          averageResponseTime: parseFloat(metrics.averageResponseTime || '0'),
          errorRate: parseFloat(metrics.errorRate || '0'),
          lastUpdated: new Date(parseInt(metrics.lastUpdated || '0')),
        },
      });
    }
    
    res.json({
      services,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get services metrics',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Analytics dashboard data
app.get('/dashboard', async (req, res) => {
  try {
    const currentMinute = Math.floor(Date.now() / 60000);
    const realTimeKey = `${ANALYTICS_KEYS.REAL_TIME}:${currentMinute}`;
    const realTimeMetrics = await redis.hgetall(realTimeKey);
    
    const serviceKeys = await redis.keys(`${ANALYTICS_KEYS.SERVICE_METRICS}:*`);
    const services = [];
    
    for (const key of serviceKeys) {
      const serviceName = key.replace(`${ANALYTICS_KEYS.SERVICE_METRICS}:`, '');
      const metrics = await redis.hgetall(key);
      
      services.push({
        serviceName,
        totalRequests: parseInt(metrics.totalRequests || '0'),
        errorRate: parseFloat(metrics.errorRate || '0'),
        averageResponseTime: parseFloat(metrics.averageResponseTime || '0'),
      });
    }
    
    res.json({
      realTime: {
        totalRequests: parseInt(realTimeMetrics.total_requests || '0'),
        timestamp: new Date(currentMinute * 60000),
      },
      services,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('API analytics service error:', error);
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
  console.log(`API analytics service running on port ${PORT}`);
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
