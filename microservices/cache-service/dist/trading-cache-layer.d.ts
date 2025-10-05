import { EventEmitter } from 'events';
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
    bids: Array<{
        price: number;
        quantity: number;
    }>;
    asks: Array<{
        price: number;
        quantity: number;
    }>;
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
export declare class TradingCacheLayer extends EventEmitter {
    private marketDataCache;
    private orderBookCache;
    private sessionCache;
    private portfolioCache;
    private metricsCache;
    private readonly CACHE_TTL;
    private readonly UPDATE_INTERVALS;
    private updateTimers;
    constructor();
    cacheMarketData(symbol: string, data: MarketData): Promise<boolean>;
    getMarketData(symbol: string): Promise<MarketData | null>;
    cacheOrderBook(symbol: string, orderBook: OrderBook): Promise<boolean>;
    getOrderBook(symbol: string): Promise<OrderBook | null>;
    cacheTradingSession(session: TradingSession): Promise<boolean>;
    getTradingSession(sessionId: string): Promise<TradingSession | null>;
    cachePortfolio(portfolio: Portfolio): Promise<boolean>;
    getPortfolio(userId: number): Promise<Portfolio | null>;
    cacheTradingMetrics(metrics: TradingMetrics): Promise<boolean>;
    getTradingMetrics(sessionId: string): Promise<TradingMetrics | null>;
    cacheMarketDataBatch(marketDataArray: MarketData[]): Promise<boolean>;
    getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>>;
    invalidateSessionData(sessionId: string): Promise<boolean>;
    invalidateUserData(userId: number): Promise<boolean>;
    private startRealTimeUpdates;
    private updateMarketData;
    private updateOrderBooks;
    private updatePortfolios;
    warmTradingCache(sessionId: string, userId: number): Promise<boolean>;
    getTradingCacheStats(): {
        marketDataSize: number;
        orderBookSize: number;
        sessionSize: number;
        portfolioSize: number;
        metricsSize: number;
        totalMemoryUsage: number;
    };
    private calculateMemoryUsage;
    private isDataFresh;
    shutdown(): Promise<void>;
}
export declare const tradingCacheLayer: TradingCacheLayer;
export {};
//# sourceMappingURL=trading-cache-layer.d.ts.map