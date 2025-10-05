"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const enhanced_cache_manager_1 = require("./enhanced-cache-manager");
const trading_cache_layer_1 = require("./trading-cache-layer");
const cache_invalidation_service_1 = require("./cache-invalidation-service");
const cache_monitoring_1 = require("./cache-monitoring");
const app = (0, express_1.default)();
const port = process.env['PORT'] || 3003;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.get('/health', async (_req, res) => {
    try {
        const [cacheHealth, monitoringHealth] = await Promise.all([
            enhanced_cache_manager_1.enhancedCacheManager.healthCheck(),
            cache_monitoring_1.cacheMonitoringService.healthCheck()
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
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/cache/stats', (_req, res) => {
    try {
        const stats = enhanced_cache_manager_1.enhancedCacheManager.getStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/cache/trading/stats', (_req, res) => {
    try {
        const stats = trading_cache_layer_1.tradingCacheLayer.getTradingCacheStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
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
        const value = await enhanced_cache_manager_1.enhancedCacheManager.get(key, configType);
        res.json({
            success: true,
            data: { key, value, found: value !== null },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
        const success = await enhanced_cache_manager_1.enhancedCacheManager.set(key, value, configType, customTtl);
        res.json({
            success,
            data: { key, set: success },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
        const success = await enhanced_cache_manager_1.enhancedCacheManager.invalidate(key, configType);
        res.json({
            success,
            data: { key, deleted: success },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
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
        const success = await trading_cache_layer_1.tradingCacheLayer.cacheMarketData(symbol, data);
        res.json({
            success,
            data: { symbol, cached: success },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/cache/trading/market-data/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await trading_cache_layer_1.tradingCacheLayer.getMarketData(symbol);
        res.json({
            success: true,
            data: { symbol, data, found: data !== null },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
        const success = await trading_cache_layer_1.tradingCacheLayer.cachePortfolio(portfolio);
        res.json({
            success,
            data: { userId: portfolio.userId, cached: success },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/cache/trading/portfolio/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const portfolio = await trading_cache_layer_1.tradingCacheLayer.getPortfolio(parseInt(userId));
        res.json({
            success: true,
            data: { userId: parseInt(userId), portfolio, found: portfolio !== null },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
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
        const events = await cache_invalidation_service_1.cacheInvalidationService.invalidate(pattern, context);
        res.json({
            success: true,
            data: { pattern, events },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/cache/invalidation/stats', (_req, res) => {
    try {
        const stats = cache_invalidation_service_1.cacheInvalidationService.getStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/monitoring/metrics', (_req, res) => {
    try {
        const metrics = cache_monitoring_1.cacheMonitoringService.getCurrentMetrics();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/monitoring/metrics/history', (req, res) => {
    try {
        const { limit } = req.query;
        const metrics = cache_monitoring_1.cacheMonitoringService.getMetricsHistory(limit ? parseInt(limit) : undefined);
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
            ? cache_monitoring_1.cacheMonitoringService.getActiveAlerts()
            : cache_monitoring_1.cacheMonitoringService.getAllAlerts();
        res.json({
            success: true,
            data: alerts,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.post('/api/monitoring/alerts/:alertId/resolve', (req, res) => {
    try {
        const { alertId } = req.params;
        const resolved = cache_monitoring_1.cacheMonitoringService.resolveAlert(alertId);
        res.json({
            success: resolved,
            data: { alertId, resolved },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
        const report = cache_monitoring_1.cacheMonitoringService.generateReport(period, parseInt(startTime), parseInt(endTime));
        res.json({
            success: true,
            data: report,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
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
        const dataLoaderFn = dataLoader || (() => Promise.resolve({ data: 'warmed' }));
        const data = await enhanced_cache_manager_1.enhancedCacheManager.warmCache(key, configType, dataLoaderFn);
        res.json({
            success: true,
            data: { key, data, warmed: data !== null },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.use((error, _req, res, _next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});
app.use('*', (_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    try {
        await Promise.all([
            enhanced_cache_manager_1.enhancedCacheManager.disconnect(),
            trading_cache_layer_1.tradingCacheLayer.shutdown(),
            cache_monitoring_1.cacheMonitoringService.shutdown(),
            cache_invalidation_service_1.cacheInvalidationService.shutdown()
        ]);
        process.exit(0);
    }
    catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    try {
        await Promise.all([
            enhanced_cache_manager_1.enhancedCacheManager.disconnect(),
            trading_cache_layer_1.tradingCacheLayer.shutdown(),
            cache_monitoring_1.cacheMonitoringService.shutdown(),
            cache_invalidation_service_1.cacheInvalidationService.shutdown()
        ]);
        process.exit(0);
    }
    catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});
app.listen(port, () => {
    console.log(`Cache service running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API documentation: http://localhost:${port}/api/`);
});
exports.default = app;
//# sourceMappingURL=app.js.map