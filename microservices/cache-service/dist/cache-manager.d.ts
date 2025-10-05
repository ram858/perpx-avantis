interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
}
export declare class CacheManager {
    private redis;
    private stats;
    private readonly cacheConfigs;
    constructor();
    get<T>(key: string, configType: string): Promise<T | null>;
    set<T>(key: string, value: T, configType: string, customTtl?: number): Promise<boolean>;
    delete(key: string, configType: string): Promise<boolean>;
    exists(key: string, configType: string): Promise<boolean>;
    mset<T>(keyValuePairs: Array<{
        key: string;
        value: T;
        configType: string;
    }>, customTtl?: number): Promise<boolean>;
    mget<T>(keys: Array<{
        key: string;
        configType: string;
    }>): Promise<Array<T | null>>;
    increment(key: string, configType: string, amount?: number): Promise<number>;
    expire(key: string, configType: string, ttl: number): Promise<boolean>;
    keys(pattern: string): Promise<string[]>;
    flushall(): Promise<boolean>;
    getStats(): CacheStats & {
        hitRate: number;
    };
    resetStats(): void;
    private buildKey;
    cacheUserSession(userId: number, sessionData: any): Promise<boolean>;
    getUserSession(userId: number): Promise<any | null>;
    cacheTradingSession(sessionId: string, sessionData: any): Promise<boolean>;
    getTradingSession(sessionId: string): Promise<any | null>;
    cacheMarketData(symbol: string, data: any): Promise<boolean>;
    getMarketData(symbol: string): Promise<any | null>;
    cachePortfolio(userId: number, portfolioData: any): Promise<boolean>;
    getPortfolio(userId: number): Promise<any | null>;
    checkRateLimit(identifier: string, limit: number, window: number): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    healthCheck(): Promise<{
        status: string;
        latency: number;
    }>;
    disconnect(): Promise<void>;
}
export declare const cacheManager: CacheManager;
export {};
//# sourceMappingURL=cache-manager.d.ts.map