import { EventEmitter } from 'events';
interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
    evictions: number;
    l1Hits: number;
    l2Hits: number;
    l3Hits: number;
}
export declare class EnhancedCacheManager extends EventEmitter {
    private l1Cache;
    private l2Redis;
    private writeBehindQueue;
    private stats;
    private readonly cacheConfigs;
    private readonly L1_MAX_SIZE;
    private readonly L1_CLEANUP_INTERVAL;
    constructor();
    private initializeRedisCluster;
    get<T>(key: string, configType: string): Promise<T | null>;
    set<T>(key: string, value: T, configType: string, customTtl?: number): Promise<boolean>;
    private cacheAsideSet;
    private writeThroughSet;
    private writeBehindSet;
    private getFromL1;
    private setInL1;
    private evictLRU;
    private getFromL2;
    private setInL2;
    private getFromL3;
    private setInL3;
    invalidate(key: string, configType: string): Promise<boolean>;
    invalidatePattern(pattern: string): Promise<number>;
    warmCache<T>(key: string, configType: string, dataLoader: () => Promise<T>): Promise<T | null>;
    private startWriteBehindProcessor;
    private startL1Cleanup;
    private buildKey;
    getStats(): CacheStats & {
        hitRate: number;
        l1HitRate: number;
        l2HitRate: number;
        l3HitRate: number;
        l1Size: number;
        writeBehindQueueSize: number;
    };
    healthCheck(): Promise<{
        status: string;
        latency: number;
        levels: any;
        error?: string;
    }>;
    keys(pattern: string): Promise<string[]>;
    exists(key: string, configType: string): Promise<boolean>;
    disconnect(): Promise<void>;
}
export declare const enhancedCacheManager: EnhancedCacheManager;
export {};
//# sourceMappingURL=enhanced-cache-manager.d.ts.map