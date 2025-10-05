import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3010;

// Service configurations
const SERVICES = {
  user_service: {
    name: 'User Service',
    endpoints: [
      'http://user-service-1:3001/health',
      'http://user-service-2:3001/health',
      'http://user-service-3:3001/health',
      'http://user-service-4:3001/health',
    ],
    timeout: 5000,
    critical: true,
  },
  trading_service: {
    name: 'Trading Service',
    endpoints: [
      'http://trading-service-1:3002/health',
      'http://trading-service-2:3002/health',
      'http://trading-service-3:3002/health',
      'http://trading-service-4:3002/health',
    ],
    timeout: 10000,
    critical: true,
  },
  portfolio_service: {
    name: 'Portfolio Service',
    endpoints: [
      'http://portfolio-service-1:3003/health',
      'http://portfolio-service-2:3003/health',
      'http://portfolio-service-3:3003/health',
      'http://portfolio-service-4:3003/health',
    ],
    timeout: 5000,
    critical: true,
  },
  market_data_service: {
    name: 'Market Data Service',
    endpoints: [
      'http://market-data-service-1:3004/health',
      'http://market-data-service-2:3004/health',
      'http://market-data-service-3:3004/health',
      'http://market-data-service-4:3004/health',
    ],
    timeout: 3000,
    critical: false,
  },
  cache_service: {
    name: 'Cache Service',
    endpoints: [
      'http://cache-service-1:3006/health',
      'http://cache-service-2:3006/health',
      'http://cache-service-3:3006/health',
      'http://cache-service-4:3006/health',
    ],
    timeout: 3000,
    critical: false,
  },
  rate_limiting_service: {
    name: 'Rate Limiting Service',
    endpoints: [
      'http://rate-limiting-service:3007/health',
    ],
    timeout: 5000,
    critical: false,
  },
  circuit_breaker_service: {
    name: 'Circuit Breaker Service',
    endpoints: [
      'http://circuit-breaker-service:3008/health',
    ],
    timeout: 5000,
    critical: false,
  },
  api_analytics_service: {
    name: 'API Analytics Service',
    endpoints: [
      'http://api-analytics-service:3009/health',
    ],
    timeout: 5000,
    critical: false,
  },
};

// Health check results cache
const healthCheckCache = new Map<string, any>();
const CACHE_TTL = 30000; // 30 seconds

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

// Health check function
async function checkServiceHealth(serviceName: string, config: any) {
  const results = [];
  let healthyInstances = 0;
  let totalInstances = config.endpoints.length;

  for (const endpoint of config.endpoints) {
    try {
      const startTime = Date.now();
      const response = await axios.get(endpoint, {
        timeout: config.timeout,
        validateStatus: (status) => status < 500, // Accept 4xx as healthy
      });
      const responseTime = Date.now() - startTime;

      const result = {
        endpoint,
        status: response.status,
        healthy: response.status < 400,
        responseTime,
        timestamp: new Date().toISOString(),
        error: null,
      };

      if (response.status < 400) {
        healthyInstances++;
      }

      results.push(result);
    } catch (error) {
      const result = {
        endpoint,
        status: 0,
        healthy: false,
        responseTime: 0,
        timestamp: new Date().toISOString(),
        error: error.message,
      };

      results.push(result);
    }
  }

  const overallHealth = healthyInstances > 0;
  const healthPercentage = (healthyInstances / totalInstances) * 100;

  return {
    serviceName,
    serviceDisplayName: config.name,
    overallHealth,
    healthPercentage,
    healthyInstances,
    totalInstances,
    critical: config.critical,
    results,
    lastChecked: new Date().toISOString(),
  };
}

// Check all services health
async function checkAllServicesHealth() {
  const results = [];
  
  for (const [serviceName, config] of Object.entries(SERVICES)) {
    try {
      const result = await checkServiceHealth(serviceName, config);
      results.push(result);
      
      // Cache the result
      healthCheckCache.set(serviceName, {
        ...result,
        cachedAt: Date.now(),
      });
    } catch (error) {
      console.error(`Failed to check health for ${serviceName}:`, error);
      
      const errorResult = {
        serviceName,
        serviceDisplayName: config.name,
        overallHealth: false,
        healthPercentage: 0,
        healthyInstances: 0,
        totalInstances: config.endpoints.length,
        critical: config.critical,
        results: [],
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
      
      results.push(errorResult);
    }
  }

  return results;
}

// Get cached result if available and not expired
function getCachedResult(serviceName: string) {
  const cached = healthCheckCache.get(serviceName);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  return null;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'health-check-service',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Check all services
app.get('/check/all', async (req, res) => {
  try {
    const results = await checkAllServicesHealth();
    
    // Calculate overall system health
    const criticalServices = results.filter(r => r.critical);
    const healthyCriticalServices = criticalServices.filter(r => r.overallHealth);
    const systemHealth = criticalServices.length === healthyCriticalServices.length;
    
    res.json({
      systemHealth,
      services: results,
      summary: {
        totalServices: results.length,
        healthyServices: results.filter(r => r.overallHealth).length,
        criticalServices: criticalServices.length,
        healthyCriticalServices: healthyCriticalServices.length,
        overallHealthPercentage: (results.filter(r => r.overallHealth).length / results.length) * 100,
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check services health',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Check specific service
app.get('/check/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    
    if (!SERVICES[serviceName]) {
      return res.status(404).json({
        error: 'Service not found',
        message: `No configuration found for service: ${serviceName}`,
        requestId: req.requestId,
      });
    }

    // Check cache first
    const cached = getCachedResult(serviceName);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
        requestId: req.requestId,
      });
    }

    const result = await checkServiceHealth(serviceName, SERVICES[serviceName]);
    
    // Cache the result
    healthCheckCache.set(serviceName, {
      ...result,
      cachedAt: Date.now(),
    });

    res.json({
      ...result,
      cached: false,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check service health',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get service status summary
app.get('/status', async (req, res) => {
  try {
    const results = await checkAllServicesHealth();
    
    const summary = {
      systemHealth: results.every(r => r.overallHealth || !r.critical),
      totalServices: results.length,
      healthyServices: results.filter(r => r.overallHealth).length,
      criticalServices: results.filter(r => r.critical).length,
      healthyCriticalServices: results.filter(r => r.critical && r.overallHealth).length,
      services: results.map(r => ({
        name: r.serviceName,
        displayName: r.serviceDisplayName,
        healthy: r.overallHealth,
        healthPercentage: r.healthPercentage,
        critical: r.critical,
        healthyInstances: r.healthyInstances,
        totalInstances: r.totalInstances,
      })),
    };

    res.json({
      ...summary,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service status',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get detailed health report
app.get('/report', async (req, res) => {
  try {
    const results = await checkAllServicesHealth();
    
    const report = {
      timestamp: new Date().toISOString(),
      systemHealth: results.every(r => r.overallHealth || !r.critical),
      services: results.map(service => ({
        name: service.serviceName,
        displayName: service.serviceDisplayName,
        overallHealth: service.overallHealth,
        healthPercentage: service.healthPercentage,
        healthyInstances: service.healthyInstances,
        totalInstances: service.totalInstances,
        critical: service.critical,
        instances: service.results.map(instance => ({
          endpoint: instance.endpoint,
          healthy: instance.healthy,
          status: instance.status,
          responseTime: instance.responseTime,
          error: instance.error,
        })),
        lastChecked: service.lastChecked,
      })),
      summary: {
        totalServices: results.length,
        healthyServices: results.filter(r => r.overallHealth).length,
        criticalServices: results.filter(r => r.critical).length,
        healthyCriticalServices: results.filter(r => r.critical && r.overallHealth).length,
        overallHealthPercentage: (results.filter(r => r.overallHealth).length / results.length) * 100,
      },
    };

    res.json({
      ...report,
      requestId: req.requestId,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate health report',
      message: error.message,
      requestId: req.requestId,
    });
  }
});

// Get service metrics
app.get('/metrics', async (req, res) => {
  try {
    const results = await checkAllServicesHealth();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      systemHealth: results.every(r => r.overallHealth || !r.critical),
      services: results.map(service => ({
        name: service.serviceName,
        healthy: service.overallHealth,
        healthPercentage: service.healthPercentage,
        healthyInstances: service.healthyInstances,
        totalInstances: service.totalInstances,
        critical: service.critical,
        averageResponseTime: service.results
          .filter(r => r.healthy)
          .reduce((sum, r) => sum + r.responseTime, 0) / 
          Math.max(service.results.filter(r => r.healthy).length, 1),
      })),
      summary: {
        totalServices: results.length,
        healthyServices: results.filter(r => r.overallHealth).length,
        criticalServices: results.filter(r => r.critical).length,
        healthyCriticalServices: results.filter(r => r.critical && r.overallHealth).length,
      },
    };

    res.json({
      ...metrics,
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

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Health check service error:', error);
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
  console.log(`Health check service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
