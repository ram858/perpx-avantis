export interface OHLCV {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    timestamp: number[];
}
export interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number[];
}
declare const RATE_LIMITS: {
    hyperliquid: {
        requests: number;
        maxRequests: number;
        windowMs: number;
        lastReset: number;
    };
    coingecko: {
        requests: number;
        maxRequests: number;
        windowMs: number;
        lastReset: number;
    };
    binance: {
        requests: number;
        maxRequests: number;
        windowMs: number;
        lastReset: number;
    };
};
export declare const tokenSymbolToBinancePair: Record<string, string>;
/**
 * Fetch OHLCV data with fallback sources
 */
export declare function fetchOHLCVWithFallback(symbol: string, interval: string, limit?: number): Promise<OHLCV>;
/**
 * Get cached OHLCV data or fetch if not cached
 */
export declare function getCachedOHLCV(symbol: string, interval: string, limit?: number): Promise<OHLCV>;
/**
 * Fetch multiple timeframes of OHLCV with caching
 */
export declare function getMultiTimeframeOHLCV(symbol: string, intervals?: string[], limit?: number): Promise<Record<string, OHLCV>>;
/**
 * Fetch latest single candle with fallback sources
 */
export declare function fetchSingleCandle(symbol: string, interval?: string): Promise<Candle | null>;
/**
 * Clear cached OHLCV data
 */
export declare function clearOHLCVCache(): void;
/**
 * Get rate limit status
 */
export declare function getRateLimitStatus(): Record<string, any>;
/**
 * Reset rate limit counters
 */
export declare function resetRateLimits(): void;
/**
 * Force reset rate limits for a specific source
 */
export declare function resetRateLimitForSource(source: keyof typeof RATE_LIMITS): void;
export {};
//# sourceMappingURL=binanceHistorical.d.ts.map