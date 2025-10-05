import Redis, { Cluster } from 'ioredis';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// Types and Interfaces
interface CacheConfig {
  ttl: number;
  prefix: string;
  serialize?: boolean;
  level: 'L1' | 'L2' | 'L3';
  strategy: 'cache-aside' | 'write-through' | 'write-behind';
  invalidation?: {
    pattern?: string;
    dependencies?: string[];
  };
}

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

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface WriteBehindQueue {
  key: string;
  value: any;
  configType: string;
  timestamp: number;
}

export class EnhancedCacheManager extends EventEmitter {
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private l2Redis!: Redis | Cluster;
  // private _l3CDN: any; // CDN client placeholder
  private writeBehindQueue: WriteBehindQueue[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    evictions: 0,
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0
  };

  // Enhanced cache configurations
  private readonly cacheConfigs: Record<string, CacheConfig> = {
    // L1 Cache (Application Memory)
    user_session: { 
      ttl: 86400, 
      prefix: 'session:', 
      serialize: true, 
      level: 'L1',
      strategy: 'cache-aside',
      invalidation: { pattern: 'session:*' }
    },
    trading_session: { 
      ttl: 86400, 
      prefix: 'trading:', 
      serialize: true, 
      level: 'L1',
      strategy: 'write-through',
      invalidation: { pattern: 'trading:*' }
    },
    
    // L2 Cache (Redis)
    market_data: { 
      ttl: 30, 
      prefix: 'market:', 
      serialize: true, 
      level: 'L2',
      strategy: 'cache-aside',
      invalidation: { pattern: 'market:*' }
    },
    portfolio: { 
      ttl: 300, 
      prefix: 'portfolio:', 
      serialize: true, 
      level: 'L2',
      strategy: 'write-behind',
      invalidation: { pattern: 'portfolio:*' }
    },
    api_response: { 
      ttl: 600, 
      prefix: 'api:', 
      serialize: true, 
      level: 'L2',
      strategy: 'cache-aside'
    },
    
    // L3 Cache (CDN)
    static_assets: { 
      ttl: 86400, 
      prefix: 'cdn:', 
      serialize: false, 
      level: 'L3',
      strategy: 'write-through'
    },
    user_profile: { 
      ttl: 3600, 
      prefix: 'user:', 
      serialize: true, 
      level: 'L2',
      strategy: 'write-behind',
      invalidation: { dependencies: ['user_session'] }
    }
  };

  // L1 Cache configuration
  private readonly L1_MAX_SIZE = 10000;
  private readonly L1_CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor() {
    super();
    this.initializeRedisCluster();
    this.startL1Cleanup();
    this.startWriteBehindProcessor();
  }

  private initializeRedisCluster() {
    const sentinels = [
      { host: 'redis-sentinel-1', port: 26379 },
      { host: 'redis-sentinel-2', port: 26380 },
      { host: 'redis-sentinel-3', port: 26381 }
    ];

    this.l2Redis = new Redis({
      sentinels,
      name: 'prepx-master-1',
      password: process.env['REDIS_PASSWORD'] || '',
      lazyConnect: true,
      enableReadyCheck: false,
    });

    this.l2Redis.on('connect', () => {
      console.log('Redis Cluster connected');
      this.emit('redis-connected');
    });

    this.l2Redis.on('error', (error) => {
      console.error('Redis Cluster error:', error);
      this.stats.errors++;
      this.emit('redis-error', error);
    });
  }

  /**
   * Multi-level cache get operation
   */
  async get<T>(key: string, configType: string): Promise<T | null> {
    const config = this.cacheConfigs[configType];
    if (!config) {
      throw new Error(`Unknown cache config type: ${configType}`);
    }

    const fullKey = this.buildKey(key, config);

    try {
      // L1 Cache (Application Memory)
      if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
        const l1Result = await this.getFromL1<T>(fullKey);
        if (l1Result !== null) {
          this.stats.l1Hits++;
          this.stats.hits++;
          return l1Result;
        }
      }

      // L2 Cache (Redis)
      if (config.level === 'L2' || config.level === 'L3') {
        const l2Result = await this.getFromL2<T>(fullKey, config);
        if (l2Result !== null) {
          this.stats.l2Hits++;
          this.stats.hits++;
          
          // Populate L1 cache
          if (config.level === 'L2') {
            await this.setInL1(fullKey, l2Result, config.ttl);
          }
          
          return l2Result;
        }
      }

      // L3 Cache (CDN) - Placeholder implementation
      if (config.level === 'L3') {
        const l3Result = await this.getFromL3<T>(fullKey, config);
        if (l3Result !== null) {
          this.stats.l3Hits++;
          this.stats.hits++;
          
          // Populate L2 and L1 caches
          await this.setInL2(fullKey, l3Result, config);
          await this.setInL1(fullKey, l3Result, config.ttl);
          
          return l3Result;
        }
      }

      this.stats.misses++;
      return null;

    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Multi-level cache set operation
   */
  async set<T>(key: string, value: T, configType: string, customTtl?: number): Promise<boolean> {
    const config = this.cacheConfigs[configType];
    if (!config) {
      throw new Error(`Unknown cache config type: ${configType}`);
    }

    const fullKey = this.buildKey(key, config);
    const ttl = customTtl || config.ttl;

    try {
      switch (config.strategy) {
        case 'cache-aside':
          return await this.cacheAsideSet(fullKey, value, config, ttl);
        
        case 'write-through':
          return await this.writeThroughSet(fullKey, value, config, ttl);
        
        case 'write-behind':
          return await this.writeBehindSet(fullKey, value, config, ttl);
        
        default:
          throw new Error(`Unknown cache strategy: ${config.strategy}`);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Cache-aside pattern implementation
   */
  private async cacheAsideSet<T>(key: string, value: T, config: CacheConfig, ttl: number): Promise<boolean> {
    // Set in appropriate cache levels
    if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
      await this.setInL1(key, value, ttl);
    }
    
    if (config.level === 'L2' || config.level === 'L3') {
      await this.setInL2(key, value, config);
    }
    
    if (config.level === 'L3') {
      await this.setInL3(key, value, config);
    }

    this.stats.sets++;
    return true;
  }

  /**
   * Write-through pattern implementation
   */
  private async writeThroughSet<T>(key: string, value: T, config: CacheConfig, ttl: number): Promise<boolean> {
    // Write to all cache levels synchronously
    const promises: Promise<any>[] = [];

    if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
      promises.push(this.setInL1(key, value, ttl));
    }
    
    if (config.level === 'L2' || config.level === 'L3') {
      promises.push(this.setInL2(key, value, config));
    }
    
    if (config.level === 'L3') {
      promises.push(this.setInL3(key, value, config));
    }

    await Promise.all(promises);
    this.stats.sets++;
    return true;
  }

  /**
   * Write-behind pattern implementation
   */
  private async writeBehindSet<T>(key: string, value: T, config: CacheConfig, ttl: number): Promise<boolean> {
    // Immediate write to L1 cache
    if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
      await this.setInL1(key, value, ttl);
    }

    // Queue for background write to L2/L3
    this.writeBehindQueue.push({
      key,
      value,
      configType: config.prefix,
      timestamp: Date.now()
    });

    this.stats.sets++;
    return true;
  }

  /**
   * L1 Cache operations (Application Memory)
   */
  private async getFromL1<T>(key: string): Promise<T | null> {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.l1Cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.value as T;
  }

  private async setInL1<T>(key: string, value: T, ttl: number): Promise<void> {
    // LRU eviction if cache is full
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      this.evictLRU();
    }

    this.l1Cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    });
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * L2 Cache operations (Redis)
   */
  private async getFromL2<T>(key: string, config: CacheConfig): Promise<T | null> {
    try {
      const value = await this.l2Redis.get(key);
      if (value === null) return null;

      return config.serialize ? JSON.parse(value) : value as T;
    } catch (error) {
      console.error('L2 cache get error:', error);
      return null;
    }
  }

  private async setInL2<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    try {
      const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
      await this.l2Redis.setex(key, config.ttl, serializedValue);
    } catch (error) {
      console.error('L2 cache set error:', error);
    }
  }

  /**
   * L3 Cache operations (CDN) - Placeholder implementation
   */
  private async getFromL3<T>(_key: string, _config: CacheConfig): Promise<T | null> {
    // Placeholder for CDN implementation
    // In real implementation, this would call CDN API
    return null;
  }

  private async setInL3<T>(_key: string, _value: T, _config: CacheConfig): Promise<void> {
    // Placeholder for CDN implementation
    // In real implementation, this would call CDN API
  }

  /**
   * Cache invalidation mechanisms
   */
  async invalidate(key: string, configType: string): Promise<boolean> {
    const config = this.cacheConfigs[configType];
    if (!config) return false;

    const fullKey = this.buildKey(key, config);
    const promises: Promise<any>[] = [];

    // Invalidate from all levels
    if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
      this.l1Cache.delete(fullKey);
    }

    if (config.level === 'L2' || config.level === 'L3') {
      promises.push(this.l2Redis.del(fullKey));
    }

    if (config.level === 'L3') {
      // CDN invalidation placeholder
    }

    await Promise.all(promises);
    this.stats.deletes++;
    return true;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.l2Redis.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.l2Redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();

      // Also clear from L1 cache
      for (const key of keys) {
        this.l1Cache.delete(key);
      }

      this.stats.deletes += keys.length;
      return keys.length;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Cache warming
   */
  async warmCache<T>(key: string, configType: string, dataLoader: () => Promise<T>): Promise<T | null> {
    const cached = await this.get<T>(key, configType);
    if (cached !== null) return cached;

    try {
      const data = await dataLoader();
      await this.set(key, data, configType);
      return data;
    } catch (error) {
      console.error('Cache warming error:', error);
      return null;
    }
  }

  /**
   * Write-behind processor
   */
  private startWriteBehindProcessor(): void {
    setInterval(async () => {
      if (this.writeBehindQueue.length === 0) return;

      const batch = this.writeBehindQueue.splice(0, 100); // Process 100 items at a time
      const pipeline = this.l2Redis.pipeline();

      for (const item of batch) {
        const config = this.cacheConfigs[item.configType];
        if (config) {
          const serializedValue = config.serialize ? JSON.stringify(item.value) : String(item.value);
          pipeline.setex(item.key, config.ttl, serializedValue);
        }
      }

      try {
        await pipeline.exec();
      } catch (error) {
        console.error('Write-behind processing error:', error);
        // Re-queue failed items
        this.writeBehindQueue.unshift(...batch);
      }
    }, 1000); // Process every second
  }

  /**
   * L1 Cache cleanup
   */
  private startL1Cleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Cache.entries()) {
        if (now - entry.timestamp > entry.ttl * 1000) {
          this.l1Cache.delete(key);
          this.stats.evictions++;
        }
      }
    }, this.L1_CLEANUP_INTERVAL);
  }

  /**
   * Memory optimization utilities
   */
  private buildKey(key: string, config: CacheConfig): string {
    // Hash long keys to avoid Redis key length limits
    if (key.length > 100) {
      const hash = createHash('md5').update(key).digest('hex');
      return `${config.prefix}${hash}`;
    }
    
    return `${config.prefix}${key}`;
  }

  /**
   * Statistics and monitoring
   */
  getStats(): CacheStats & { 
    hitRate: number; 
    l1HitRate: number; 
    l2HitRate: number; 
    l3HitRate: number;
    l1Size: number;
    writeBehindQueueSize: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    const l1HitRate = total > 0 ? (this.stats.l1Hits / total) * 100 : 0;
    const l2HitRate = total > 0 ? (this.stats.l2Hits / total) * 100 : 0;
    const l3HitRate = total > 0 ? (this.stats.l3Hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2)),
      l1HitRate: parseFloat(l1HitRate.toFixed(2)),
      l2HitRate: parseFloat(l2HitRate.toFixed(2)),
      l3HitRate: parseFloat(l3HitRate.toFixed(2)),
      l1Size: this.l1Cache.size,
      writeBehindQueueSize: this.writeBehindQueue.length
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency: number; levels: any; error?: string }> {
    const start = Date.now();
    const levels: any = {};

    try {
      // Check L1 cache
      levels.l1 = { status: 'healthy', size: this.l1Cache.size };

      // Check L2 cache (Redis)
      const redisStart = Date.now();
      await this.l2Redis.ping();
      levels.l2 = { 
        status: 'healthy', 
        latency: Date.now() - redisStart 
      };

      // Check L3 cache (CDN) - placeholder
      levels.l3 = { status: 'healthy', latency: 0 };

      const latency = Date.now() - start;
      return { status: 'healthy', latency, levels };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        latency: Date.now() - start, 
        levels,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.l2Redis.keys(pattern);
    } catch (error) {
      console.error(`Cache keys error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, configType: string): Promise<boolean> {
    try {
      const config = this.cacheConfigs[configType];
      if (!config) return false;
      
      const fullKey = this.buildKey(key, config);
      const result = await this.l2Redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      // Process remaining write-behind queue
      if (this.writeBehindQueue.length > 0) {
        console.log(`Processing ${this.writeBehindQueue.length} remaining write-behind items...`);
        await this.startWriteBehindProcessor();
      }

      await this.l2Redis.disconnect();
      this.l1Cache.clear();
      console.log('Enhanced cache manager disconnected');
    } catch (error) {
      console.error('Error disconnecting enhanced cache manager:', error);
    }
  }
}

// Export singleton instance
export const enhancedCacheManager = new EnhancedCacheManager();
