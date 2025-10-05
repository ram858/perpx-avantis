import { enhancedCacheManager } from './enhanced-cache-manager';
import { EventEmitter } from 'events';

// Trading-specific types
interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  bid: number;
  ask: number;
  spread: number;
}

interface OrderBook {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: number;
}

interface TradingSession {
  sessionId: string;
  userId: number;
  status: 'active' | 'paused' | 'stopped';
  startTime: number;
  currentPnl: number;
  totalTrades: number;
  openPositions: number;
  riskMetrics: {
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  };
}

interface Portfolio {
  userId: number;
  totalValue: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
  }>;
  cash: number;
  margin: number;
  lastUpdated: number;
}

interface TradingMetrics {
  sessionId: string;
  totalVolume: number;
  totalFees: number;
  avgTradeSize: number;
  maxPositionSize: number;
  volatility: number;
  lastCalculated: number;
}

export class TradingCacheLayer extends EventEmitter {
  private marketDataCache = new Map<string, MarketData>();
  private orderBookCache = new Map<string, OrderBook>();
  private sessionCache = new Map<string, TradingSession>();
  private portfolioCache = new Map<number, Portfolio>();
  private metricsCache = new Map<string, TradingMetrics>();

  // Cache TTL configurations for trading data
  private readonly CACHE_TTL = {
    MARKET_DATA: 1, // 1 second for real-time data
    ORDER_BOOK: 2, // 2 seconds
    TRADING_SESSION: 60, // 1 minute
    PORTFOLIO: 30, // 30 seconds
    METRICS: 300, // 5 minutes
    USER_PROFILE: 3600, // 1 hour
    API_RESPONSE: 600, // 10 minutes
  };

  // Real-time data update intervals
  private readonly UPDATE_INTERVALS = {
    MARKET_DATA: 1000, // 1 second
    ORDER_BOOK: 2000, // 2 seconds
    PORTFOLIO: 5000, // 5 seconds
  };

  private updateTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.startRealTimeUpdates();
  }

  /**
   * Market Data Caching
   */
  async cacheMarketData(symbol: string, data: MarketData): Promise<boolean> {
    try {
      // Update in-memory cache
      this.marketDataCache.set(symbol, data);

      // Update L2 cache (Redis) with short TTL
      await enhancedCacheManager.set(
        symbol,
        data,
        'market_data',
        this.CACHE_TTL.MARKET_DATA
      );

      this.emit('marketDataUpdated', { symbol, data });
      return true;
    } catch (error) {
      console.error('Error caching market data:', error);
      return false;
    }
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Check in-memory cache first
      const cached = this.marketDataCache.get(symbol);
      if (cached && this.isDataFresh(cached.timestamp, this.CACHE_TTL.MARKET_DATA)) {
        return cached;
      }

      // Check L2 cache
      const l2Data = await enhancedCacheManager.get<MarketData>(symbol, 'market_data');
      if (l2Data) {
        this.marketDataCache.set(symbol, l2Data);
        return l2Data;
      }

      return null;
    } catch (error) {
      console.error('Error getting market data:', error);
      return null;
    }
  }

  /**
   * Order Book Caching
   */
  async cacheOrderBook(symbol: string, orderBook: OrderBook): Promise<boolean> {
    try {
      this.orderBookCache.set(symbol, orderBook);
      
      await enhancedCacheManager.set(
        `orderbook:${symbol}`,
        orderBook,
        'market_data',
        this.CACHE_TTL.ORDER_BOOK
      );

      this.emit('orderBookUpdated', { symbol, orderBook });
      return true;
    } catch (error) {
      console.error('Error caching order book:', error);
      return false;
    }
  }

  async getOrderBook(symbol: string): Promise<OrderBook | null> {
    try {
      const cached = this.orderBookCache.get(symbol);
      if (cached && this.isDataFresh(cached.timestamp, this.CACHE_TTL.ORDER_BOOK)) {
        return cached;
      }

      const l2Data = await enhancedCacheManager.get<OrderBook>(`orderbook:${symbol}`, 'market_data');
      if (l2Data) {
        this.orderBookCache.set(symbol, l2Data);
        return l2Data;
      }

      return null;
    } catch (error) {
      console.error('Error getting order book:', error);
      return null;
    }
  }

  /**
   * Trading Session Caching
   */
  async cacheTradingSession(session: TradingSession): Promise<boolean> {
    try {
      this.sessionCache.set(session.sessionId, session);
      
      await enhancedCacheManager.set(
        session.sessionId,
        session,
        'trading_session',
        this.CACHE_TTL.TRADING_SESSION
      );

      this.emit('sessionUpdated', { sessionId: session.sessionId, session });
      return true;
    } catch (error) {
      console.error('Error caching trading session:', error);
      return false;
    }
  }

  async getTradingSession(sessionId: string): Promise<TradingSession | null> {
    try {
      const cached = this.sessionCache.get(sessionId);
      if (cached) {
        return cached;
      }

      const l2Data = await enhancedCacheManager.get<TradingSession>(sessionId, 'trading_session');
      if (l2Data) {
        this.sessionCache.set(sessionId, l2Data);
        return l2Data;
      }

      return null;
    } catch (error) {
      console.error('Error getting trading session:', error);
      return null;
    }
  }

  /**
   * Portfolio Caching
   */
  async cachePortfolio(portfolio: Portfolio): Promise<boolean> {
    try {
      this.portfolioCache.set(portfolio.userId, portfolio);
      
      await enhancedCacheManager.set(
        portfolio.userId.toString(),
        portfolio,
        'portfolio',
        this.CACHE_TTL.PORTFOLIO
      );

      this.emit('portfolioUpdated', { userId: portfolio.userId, portfolio });
      return true;
    } catch (error) {
      console.error('Error caching portfolio:', error);
      return false;
    }
  }

  async getPortfolio(userId: number): Promise<Portfolio | null> {
    try {
      const cached = this.portfolioCache.get(userId);
      if (cached && this.isDataFresh(cached.lastUpdated, this.CACHE_TTL.PORTFOLIO)) {
        return cached;
      }

      const l2Data = await enhancedCacheManager.get<Portfolio>(userId.toString(), 'portfolio');
      if (l2Data) {
        this.portfolioCache.set(userId, l2Data);
        return l2Data;
      }

      return null;
    } catch (error) {
      console.error('Error getting portfolio:', error);
      return null;
    }
  }

  /**
   * Trading Metrics Caching
   */
  async cacheTradingMetrics(metrics: TradingMetrics): Promise<boolean> {
    try {
      this.metricsCache.set(metrics.sessionId, metrics);
      
      await enhancedCacheManager.set(
        `metrics:${metrics.sessionId}`,
        metrics,
        'api_response',
        this.CACHE_TTL.METRICS
      );

      this.emit('metricsUpdated', { sessionId: metrics.sessionId, metrics });
      return true;
    } catch (error) {
      console.error('Error caching trading metrics:', error);
      return false;
    }
  }

  async getTradingMetrics(sessionId: string): Promise<TradingMetrics | null> {
    try {
      const cached = this.metricsCache.get(sessionId);
      if (cached && this.isDataFresh(cached.lastCalculated, this.CACHE_TTL.METRICS)) {
        return cached;
      }

      const l2Data = await enhancedCacheManager.get<TradingMetrics>(`metrics:${sessionId}`, 'api_response');
      if (l2Data) {
        this.metricsCache.set(sessionId, l2Data);
        return l2Data;
      }

      return null;
    } catch (error) {
      console.error('Error getting trading metrics:', error);
      return null;
    }
  }

  /**
   * Batch Operations for High-Frequency Trading
   */
  async cacheMarketDataBatch(marketDataArray: MarketData[]): Promise<boolean> {
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

      // Use individual set operations instead of mset
      for (const item of pipeline) {
        await enhancedCacheManager.set(item.key, item.value, item.configType, this.CACHE_TTL.MARKET_DATA);
      }
      this.emit('marketDataBatchUpdated', { count: marketDataArray.length });
      return true;
    } catch (error) {
      console.error('Error caching market data batch:', error);
      return false;
    }
  }

  async getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>> {
    const result = new Map<string, MarketData>();
    
    try {
      for (const symbol of symbols) {
        const data = await this.getMarketData(symbol);
        if (data) {
          result.set(symbol, data);
        }
      }
    } catch (error) {
      console.error('Error getting market data batch:', error);
    }

    return result;
  }

  /**
   * Cache Invalidation for Trading
   */
  async invalidateSessionData(sessionId: string): Promise<boolean> {
    try {
      // Remove from in-memory caches
      this.sessionCache.delete(sessionId);
      this.metricsCache.delete(sessionId);

      // Invalidate from L2 cache
      await enhancedCacheManager.invalidate(sessionId, 'trading_session');
      await enhancedCacheManager.invalidate(`metrics:${sessionId}`, 'api_response');

      this.emit('sessionDataInvalidated', { sessionId });
      return true;
    } catch (error) {
      console.error('Error invalidating session data:', error);
      return false;
    }
  }

  async invalidateUserData(userId: number): Promise<boolean> {
    try {
      // Remove from in-memory caches
      this.portfolioCache.delete(userId);

      // Invalidate from L2 cache
      await enhancedCacheManager.invalidate(userId.toString(), 'portfolio');
      await enhancedCacheManager.invalidatePattern(`user:${userId}:*`);

      this.emit('userDataInvalidated', { userId });
      return true;
    } catch (error) {
      console.error('Error invalidating user data:', error);
      return false;
    }
  }

  /**
   * Real-time Data Updates
   */
  private startRealTimeUpdates(): void {
    // Market data updates
    this.updateTimers.set('marketData', setInterval(async () => {
      await this.updateMarketData();
    }, this.UPDATE_INTERVALS.MARKET_DATA));

    // Order book updates
    this.updateTimers.set('orderBook', setInterval(async () => {
      await this.updateOrderBooks();
    }, this.UPDATE_INTERVALS.ORDER_BOOK));

    // Portfolio updates
    this.updateTimers.set('portfolio', setInterval(async () => {
      await this.updatePortfolios();
    }, this.UPDATE_INTERVALS.PORTFOLIO));
  }

  private async updateMarketData(): Promise<void> {
    // This would typically fetch from external market data providers
    // For now, we'll just emit an event for external handlers
    this.emit('marketDataUpdateRequired');
  }

  private async updateOrderBooks(): Promise<void> {
    this.emit('orderBookUpdateRequired');
  }

  private async updatePortfolios(): Promise<void> {
    this.emit('portfolioUpdateRequired');
  }

  /**
   * Cache Warming for Trading
   */
  async warmTradingCache(sessionId: string, userId: number): Promise<boolean> {
    try {
      // Warm session data
      await enhancedCacheManager.warmCache(
        sessionId,
        'trading_session',
        async () => {
          // This would typically fetch from database
          return null;
        }
      );

      // Warm portfolio data
      await enhancedCacheManager.warmCache(
        userId.toString(),
        'portfolio',
        async () => {
          // This would typically fetch from database
          return null;
        }
      );

      this.emit('tradingCacheWarmed', { sessionId, userId });
      return true;
    } catch (error) {
      console.error('Error warming trading cache:', error);
      return false;
    }
  }

  /**
   * Performance Monitoring
   */
  getTradingCacheStats(): {
    marketDataSize: number;
    orderBookSize: number;
    sessionSize: number;
    portfolioSize: number;
    metricsSize: number;
    totalMemoryUsage: number;
  } {
    return {
      marketDataSize: this.marketDataCache.size,
      orderBookSize: this.orderBookCache.size,
      sessionSize: this.sessionCache.size,
      portfolioSize: this.portfolioCache.size,
      metricsSize: this.metricsCache.size,
      totalMemoryUsage: this.calculateMemoryUsage()
    };
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimate memory usage for each cache
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

  /**
   * Utility Methods
   */
  private isDataFresh(timestamp: number, ttlSeconds: number): boolean {
    return (Date.now() - timestamp) < (ttlSeconds * 1000);
  }

  /**
   * Cleanup and Shutdown
   */
  async shutdown(): Promise<void> {
    try {
      // Clear all timers
      for (const timer of this.updateTimers.values()) {
        clearInterval(timer);
      }
      this.updateTimers.clear();

      // Clear all caches
      this.marketDataCache.clear();
      this.orderBookCache.clear();
      this.sessionCache.clear();
      this.portfolioCache.clear();
      this.metricsCache.clear();

      console.log('Trading cache layer shutdown complete');
    } catch (error) {
      console.error('Error during trading cache layer shutdown:', error);
    }
  }
}

// Export singleton instance
export const tradingCacheLayer = new TradingCacheLayer();
