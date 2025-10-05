import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { enhancedCacheManager } from './enhanced-cache-manager';
import { tradingCacheLayer } from './trading-cache-layer';
import { cacheInvalidationService } from './cache-invalidation-service';
import { cacheMonitoringService } from './cache-monitoring';

const app = express();
const port = process.env['PORT'] || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const [cacheHealth, monitoringHealth] = await Promise.all([
      enhancedCacheManager.healthCheck(),
      cacheMonitoringService.healthCheck()
    ]);

    const status = cacheHealth.status === 'healthy' && monitoringHealth.status === 'healthy' 
      ? 'healthy' 
      : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        cache: cacheHealth,
        monitoring: monitoringHealth
      }
    });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
});

// Cache management endpoints
app.get('/api/cache/stats', (_req, res) => {
  try {
    const stats = enhancedCacheManager.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/cache/trading/stats', (_req, res) => {
  try {
    const stats = tradingCacheLayer.getTradingCacheStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cache operations endpoints
app.post('/api/cache/get', async (req, res) => {
  try {
    const { key, configType } = req.body;
    
    if (!key || !configType) {
      res.status(400).json({
        success: false,
        error: 'Key and configType are required'
      });
      return;
    }

    const value = await enhancedCacheManager.get(key, configType);
    
    res.json({
      success: true,
      data: { key, value, found: value !== null },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cache/set', async (req, res) => {
  try {
    const { key, value, configType, customTtl } = req.body;
    
    if (!key || !configType || value === undefined) {
      res.status(400).json({
        success: false,
        error: 'Key, value, and configType are required'
      });
      return;
    }

    const success = await enhancedCacheManager.set(key, value, configType, customTtl);
    
    res.json({
      success,
      data: { key, set: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.delete('/api/cache/delete', async (req, res) => {
  try {
    const { key, configType } = req.body;
    
    if (!key || !configType) {
      res.status(400).json({
        success: false,
        error: 'Key and configType are required'
      });
      return;
    }

    const success = await enhancedCacheManager.invalidate(key, configType);
    
    res.json({
      success,
      data: { key, deleted: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trading-specific cache endpoints
app.post('/api/cache/trading/market-data', async (req, res) => {
  try {
    const { symbol, data } = req.body;
    
    if (!symbol || !data) {
      res.status(400).json({
        success: false,
        error: 'Symbol and data are required'
      });
      return;
    }

    const success = await tradingCacheLayer.cacheMarketData(symbol, data);
    
    res.json({
      success,
      data: { symbol, cached: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/cache/trading/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await tradingCacheLayer.getMarketData(symbol);
    
    res.json({
      success: true,
      data: { symbol, data, found: data !== null },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cache/trading/portfolio', async (req, res) => {
  try {
    const portfolio = req.body;
    
    if (!portfolio.userId) {
      res.status(400).json({
        success: false,
        error: 'Portfolio userId is required'
      });
      return;
    }

    const success = await tradingCacheLayer.cachePortfolio(portfolio);
    
    res.json({
      success,
      data: { userId: portfolio.userId, cached: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/cache/trading/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const portfolio = await tradingCacheLayer.getPortfolio(parseInt(userId));
    
    res.json({
      success: true,
      data: { userId: parseInt(userId), portfolio, found: portfolio !== null },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cache invalidation endpoints
app.post('/api/cache/invalidate', async (req, res) => {
  try {
    const { pattern, context } = req.body;
    
    if (!pattern) {
      res.status(400).json({
        success: false,
        error: 'Pattern is required'
      });
      return;
    }

    const events = await cacheInvalidationService.invalidate(pattern, context);
    
    res.json({
      success: true,
      data: { pattern, events },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/cache/invalidation/stats', (_req, res) => {
  try {
    const stats = cacheInvalidationService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Monitoring endpoints
app.get('/api/monitoring/metrics', (_req, res) => {
  try {
    const metrics = cacheMonitoringService.getCurrentMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/monitoring/metrics/history', (req, res) => {
  try {
    const { limit } = req.query;
    const metrics = cacheMonitoringService.getMetricsHistory(
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/monitoring/alerts', (req, res) => {
  try {
    const { active } = req.query;
    const alerts = active === 'true' 
      ? cacheMonitoringService.getActiveAlerts()
      : cacheMonitoringService.getAllAlerts();
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/monitoring/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const resolved = cacheMonitoringService.resolveAlert(alertId);
    
    res.json({
      success: resolved,
      data: { alertId, resolved },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/monitoring/report', (req, res) => {
  try {
    const { period, startTime, endTime } = req.query;
    
    if (!period || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: 'Period, startTime, and endTime are required'
      });
      return;
    }

    const report = cacheMonitoringService.generateReport(
      period as string,
      parseInt(startTime as string),
      parseInt(endTime as string)
    );
    
    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cache warming endpoint
app.post('/api/cache/warm', async (req, res) => {
  try {
    const { key, configType, dataLoader } = req.body;
    
    if (!key || !configType) {
      res.status(400).json({
        success: false,
        error: 'Key and configType are required'
      });
      return;
    }

    // For demo purposes, we'll use a simple data loader
    const dataLoaderFn = dataLoader || (() => Promise.resolve({ data: 'warmed' }));
    
    const data = await enhancedCacheManager.warmCache(key, configType, dataLoaderFn);
    
    res.json({
      success: true,
      data: { key, data, warmed: data !== null },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await Promise.all([
      enhancedCacheManager.disconnect(),
      tradingCacheLayer.shutdown(),
      cacheMonitoringService.shutdown(),
      cacheInvalidationService.shutdown()
    ]);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await Promise.all([
      enhancedCacheManager.disconnect(),
      tradingCacheLayer.shutdown(),
      cacheMonitoringService.shutdown(),
      cacheInvalidationService.shutdown()
    ]);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
app.listen(port, () => {
  console.log(`Cache service running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API documentation: http://localhost:${port}/api/`);
});

export default app;
