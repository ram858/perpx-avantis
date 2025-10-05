"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingCacheLayer = exports.TradingCacheLayer = void 0;
const enhanced_cache_manager_1 = require("./enhanced-cache-manager");
const events_1 = require("events");
class TradingCacheLayer extends events_1.EventEmitter {
    constructor() {
        super();
        this.marketDataCache = new Map();
        this.orderBookCache = new Map();
        this.sessionCache = new Map();
        this.portfolioCache = new Map();
        this.metricsCache = new Map();
        this.CACHE_TTL = {
            MARKET_DATA: 1,
            ORDER_BOOK: 2,
            TRADING_SESSION: 60,
            PORTFOLIO: 30,
            METRICS: 300,
            USER_PROFILE: 3600,
            API_RESPONSE: 600,
        };
        this.UPDATE_INTERVALS = {
            MARKET_DATA: 1000,
            ORDER_BOOK: 2000,
            PORTFOLIO: 5000,
        };
        this.updateTimers = new Map();
        this.startRealTimeUpdates();
    }
    async cacheMarketData(symbol, data) {
        try {
            this.marketDataCache.set(symbol, data);
            await enhanced_cache_manager_1.enhancedCacheManager.set(symbol, data, 'market_data', this.CACHE_TTL.MARKET_DATA);
            this.emit('marketDataUpdated', { symbol, data });
            return true;
        }
        catch (error) {
            console.error('Error caching market data:', error);
            return false;
        }
    }
    async getMarketData(symbol) {
        try {
            const cached = this.marketDataCache.get(symbol);
            if (cached && this.isDataFresh(cached.timestamp, this.CACHE_TTL.MARKET_DATA)) {
                return cached;
            }
            const l2Data = await enhanced_cache_manager_1.enhancedCacheManager.get(symbol, 'market_data');
            if (l2Data) {
                this.marketDataCache.set(symbol, l2Data);
                return l2Data;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting market data:', error);
            return null;
        }
    }
    async cacheOrderBook(symbol, orderBook) {
        try {
            this.orderBookCache.set(symbol, orderBook);
            await enhanced_cache_manager_1.enhancedCacheManager.set(`orderbook:${symbol}`, orderBook, 'market_data', this.CACHE_TTL.ORDER_BOOK);
            this.emit('orderBookUpdated', { symbol, orderBook });
            return true;
        }
        catch (error) {
            console.error('Error caching order book:', error);
            return false;
        }
    }
    async getOrderBook(symbol) {
        try {
            const cached = this.orderBookCache.get(symbol);
            if (cached && this.isDataFresh(cached.timestamp, this.CACHE_TTL.ORDER_BOOK)) {
                return cached;
            }
            const l2Data = await enhanced_cache_manager_1.enhancedCacheManager.get(`orderbook:${symbol}`, 'market_data');
            if (l2Data) {
                this.orderBookCache.set(symbol, l2Data);
                return l2Data;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting order book:', error);
            return null;
        }
    }
    async cacheTradingSession(session) {
        try {
            this.sessionCache.set(session.sessionId, session);
            await enhanced_cache_manager_1.enhancedCacheManager.set(session.sessionId, session, 'trading_session', this.CACHE_TTL.TRADING_SESSION);
            this.emit('sessionUpdated', { sessionId: session.sessionId, session });
            return true;
        }
        catch (error) {
            console.error('Error caching trading session:', error);
            return false;
        }
    }
    async getTradingSession(sessionId) {
        try {
            const cached = this.sessionCache.get(sessionId);
            if (cached) {
                return cached;
            }
            const l2Data = await enhanced_cache_manager_1.enhancedCacheManager.get(sessionId, 'trading_session');
            if (l2Data) {
                this.sessionCache.set(sessionId, l2Data);
                return l2Data;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting trading session:', error);
            return null;
        }
    }
    async cachePortfolio(portfolio) {
        try {
            this.portfolioCache.set(portfolio.userId, portfolio);
            await enhanced_cache_manager_1.enhancedCacheManager.set(portfolio.userId.toString(), portfolio, 'portfolio', this.CACHE_TTL.PORTFOLIO);
            this.emit('portfolioUpdated', { userId: portfolio.userId, portfolio });
            return true;
        }
        catch (error) {
            console.error('Error caching portfolio:', error);
            return false;
        }
    }
    async getPortfolio(userId) {
        try {
            const cached = this.portfolioCache.get(userId);
            if (cached && this.isDataFresh(cached.lastUpdated, this.CACHE_TTL.PORTFOLIO)) {
                return cached;
            }
            const l2Data = await enhanced_cache_manager_1.enhancedCacheManager.get(userId.toString(), 'portfolio');
            if (l2Data) {
                this.portfolioCache.set(userId, l2Data);
                return l2Data;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting portfolio:', error);
            return null;
        }
    }
    async cacheTradingMetrics(metrics) {
        try {
            this.metricsCache.set(metrics.sessionId, metrics);
            await enhanced_cache_manager_1.enhancedCacheManager.set(`metrics:${metrics.sessionId}`, metrics, 'api_response', this.CACHE_TTL.METRICS);
            this.emit('metricsUpdated', { sessionId: metrics.sessionId, metrics });
            return true;
        }
        catch (error) {
            console.error('Error caching trading metrics:', error);
            return false;
        }
    }
    async getTradingMetrics(sessionId) {
        try {
            const cached = this.metricsCache.get(sessionId);
            if (cached && this.isDataFresh(cached.lastCalculated, this.CACHE_TTL.METRICS)) {
                return cached;
            }
            const l2Data = await enhanced_cache_manager_1.enhancedCacheManager.get(`metrics:${sessionId}`, 'api_response');
            if (l2Data) {
                this.metricsCache.set(sessionId, l2Data);
                return l2Data;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting trading metrics:', error);
            return null;
        }
    }
    async cacheMarketDataBatch(marketDataArray) {
        try {
            const pipeline = [];
            for (const data of marketDataArray) {
                this.marketDataCache.set(data.symbol, data);
                pipeline.push({
                    key: data.symbol,
                    value: data,
                    configType: 'market_data'
                });
            }
            for (const item of pipeline) {
                await enhanced_cache_manager_1.enhancedCacheManager.set(item.key, item.value, item.configType, this.CACHE_TTL.MARKET_DATA);
            }
            this.emit('marketDataBatchUpdated', { count: marketDataArray.length });
            return true;
        }
        catch (error) {
            console.error('Error caching market data batch:', error);
            return false;
        }
    }
    async getMarketDataBatch(symbols) {
        const result = new Map();
        try {
            for (const symbol of symbols) {
                const data = await this.getMarketData(symbol);
                if (data) {
                    result.set(symbol, data);
                }
            }
        }
        catch (error) {
            console.error('Error getting market data batch:', error);
        }
        return result;
    }
    async invalidateSessionData(sessionId) {
        try {
            this.sessionCache.delete(sessionId);
            this.metricsCache.delete(sessionId);
            await enhanced_cache_manager_1.enhancedCacheManager.invalidate(sessionId, 'trading_session');
            await enhanced_cache_manager_1.enhancedCacheManager.invalidate(`metrics:${sessionId}`, 'api_response');
            this.emit('sessionDataInvalidated', { sessionId });
            return true;
        }
        catch (error) {
            console.error('Error invalidating session data:', error);
            return false;
        }
    }
    async invalidateUserData(userId) {
        try {
            this.portfolioCache.delete(userId);
            await enhanced_cache_manager_1.enhancedCacheManager.invalidate(userId.toString(), 'portfolio');
            await enhanced_cache_manager_1.enhancedCacheManager.invalidatePattern(`user:${userId}:*`);
            this.emit('userDataInvalidated', { userId });
            return true;
        }
        catch (error) {
            console.error('Error invalidating user data:', error);
            return false;
        }
    }
    startRealTimeUpdates() {
        this.updateTimers.set('marketData', setInterval(async () => {
            await this.updateMarketData();
        }, this.UPDATE_INTERVALS.MARKET_DATA));
        this.updateTimers.set('orderBook', setInterval(async () => {
            await this.updateOrderBooks();
        }, this.UPDATE_INTERVALS.ORDER_BOOK));
        this.updateTimers.set('portfolio', setInterval(async () => {
            await this.updatePortfolios();
        }, this.UPDATE_INTERVALS.PORTFOLIO));
    }
    async updateMarketData() {
        this.emit('marketDataUpdateRequired');
    }
    async updateOrderBooks() {
        this.emit('orderBookUpdateRequired');
    }
    async updatePortfolios() {
        this.emit('portfolioUpdateRequired');
    }
    async warmTradingCache(sessionId, userId) {
        try {
            await enhanced_cache_manager_1.enhancedCacheManager.warmCache(sessionId, 'trading_session', async () => {
                return null;
            });
            await enhanced_cache_manager_1.enhancedCacheManager.warmCache(userId.toString(), 'portfolio', async () => {
                return null;
            });
            this.emit('tradingCacheWarmed', { sessionId, userId });
            return true;
        }
        catch (error) {
            console.error('Error warming trading cache:', error);
            return false;
        }
    }
    getTradingCacheStats() {
        return {
            marketDataSize: this.marketDataCache.size,
            orderBookSize: this.orderBookCache.size,
            sessionSize: this.sessionCache.size,
            portfolioSize: this.portfolioCache.size,
            metricsSize: this.metricsCache.size,
            totalMemoryUsage: this.calculateMemoryUsage()
        };
    }
    calculateMemoryUsage() {
        let totalSize = 0;
        for (const [key, value] of this.marketDataCache.entries()) {
            totalSize += key.length + JSON.stringify(value).length;
        }
        for (const [key, value] of this.orderBookCache.entries()) {
            totalSize += key.length + JSON.stringify(value).length;
        }
        for (const [key, value] of this.sessionCache.entries()) {
            totalSize += key.length + JSON.stringify(value).length;
        }
        for (const [key, value] of this.portfolioCache.entries()) {
            totalSize += key.toString().length + JSON.stringify(value).length;
        }
        for (const [key, value] of this.metricsCache.entries()) {
            totalSize += key.length + JSON.stringify(value).length;
        }
        return totalSize;
    }
    isDataFresh(timestamp, ttlSeconds) {
        return (Date.now() - timestamp) < (ttlSeconds * 1000);
    }
    async shutdown() {
        try {
            for (const timer of this.updateTimers.values()) {
                clearInterval(timer);
            }
            this.updateTimers.clear();
            this.marketDataCache.clear();
            this.orderBookCache.clear();
            this.sessionCache.clear();
            this.portfolioCache.clear();
            this.metricsCache.clear();
            console.log('Trading cache layer shutdown complete');
        }
        catch (error) {
            console.error('Error during trading cache layer shutdown:', error);
        }
    }
}
exports.TradingCacheLayer = TradingCacheLayer;
exports.tradingCacheLayer = new TradingCacheLayer();
//# sourceMappingURL=trading-cache-layer.js.map