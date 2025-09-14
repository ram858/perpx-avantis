import Redis from 'ioredis';
import { createHash } from 'crypto';

interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
  serialize?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheManager {
  private redis: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  // Cache configurations for different data types
  private readonly cacheConfigs = {
    user_session: { ttl: 86400, prefix: 'session:', serialize: true }, // 24 hours
    user_profile: { ttl: 3600, prefix: 'user:', serialize: true }, // 1 hour
    trading_session: { ttl: 86400, prefix: 'trading:', serialize: true }, // 24 hours
    market_data: { ttl: 30, prefix: 'market:', serialize: true }, // 30 seconds
    portfolio: { ttl: 300, prefix: 'portfolio:', serialize: true }, // 5 minutes
    api_response: { ttl: 600, prefix: 'api:', serialize: true }, // 10 minutes
    rate_limit: { ttl: 3600, prefix: 'rate:', serialize: false }, // 1 hour
    websocket_connection: { ttl: 86400, prefix: 'ws:', serialize: true }, // 24 hours
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Connection pool settings for high throughput
      family: 4,
      keepAlive: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Cluster settings if using Redis Cluster
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    // Handle connection events
    this.redis.on('connect', () => {
      console.log('Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
      this.stats.errors++;
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, configType: keyof typeof this.cacheConfigs): Promise<T | null> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      
      const value = await this.redis.get(fullKey);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return config.serialize ? JSON.parse(value) : value as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string, 
    value: T, 
    configType: keyof typeof this.cacheConfigs,
    customTtl?: number
  ): Promise<boolean> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      const ttl = customTtl || config.ttl;
      
      const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
      
      await this.redis.setex(fullKey, ttl, serializedValue);
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, configType: keyof typeof this.cacheConfigs): Promise<boolean> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      
      const result = await this.redis.del(fullKey);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, configType: keyof typeof this.cacheConfigs): Promise<boolean> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Set multiple values atomically
   */
  async mset<T>(
    keyValuePairs: Array<{ key: string; value: T; configType: keyof typeof this.cacheConfigs }>,
    customTtl?: number
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, value, configType } of keyValuePairs) {
        const config = this.cacheConfigs[configType];
        const fullKey = this.buildKey(key, config);
        const ttl = customTtl || config.ttl;
        const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
        
        pipeline.setex(fullKey, ttl, serializedValue);
      }
      
      await pipeline.exec();
      this.stats.sets += keyValuePairs.length;
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get multiple values
   */
  async mget<T>(
    keys: Array<{ key: string; configType: keyof typeof this.cacheConfigs }>
  ): Promise<Array<T | null>> {
    try {
      const fullKeys = keys.map(({ key, configType }) => {
        const config = this.cacheConfigs[configType];
        return this.buildKey(key, config);
      });
      
      const values = await this.redis.mget(...fullKeys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        const config = this.cacheConfigs[keys[index].configType];
        return config.serialize ? JSON.parse(value) : value as T;
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      this.stats.errors++;
      return keys.map(() => null);
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, configType: keyof typeof this.cacheConfigs, amount: number = 1): Promise<number> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      
      const result = await this.redis.incrby(fullKey, amount);
      return result;
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, configType: keyof typeof this.cacheConfigs, ttl: number): Promise<boolean> {
    try {
      const config = this.cacheConfigs[configType];
      const fullKey = this.buildKey(key, config);
      
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error(`Cache keys error for pattern ${pattern}:`, error);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  async flushall(): Promise<boolean> {
    try {
      await this.redis.flushall();
      return true;
    } catch (error) {
      console.error('Cache flushall error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2))
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Build full cache key with prefix
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
   * Cache user session data
   */
  async cacheUserSession(userId: number, sessionData: any): Promise<boolean> {
    return this.set(userId.toString(), sessionData, 'user_session');
  }

  /**
   * Get user session data
   */
  async getUserSession(userId: number): Promise<any | null> {
    return this.get(userId.toString(), 'user_session');
  }

  /**
   * Cache trading session data
   */
  async cacheTradingSession(sessionId: string, sessionData: any): Promise<boolean> {
    return this.set(sessionId, sessionData, 'trading_session');
  }

  /**
   * Get trading session data
   */
  async getTradingSession(sessionId: string): Promise<any | null> {
    return this.get(sessionId, 'trading_session');
  }

  /**
   * Cache market data
   */
  async cacheMarketData(symbol: string, data: any): Promise<boolean> {
    return this.set(symbol, data, 'market_data');
  }

  /**
   * Get market data
   */
  async getMarketData(symbol: string): Promise<any | null> {
    return this.get(symbol, 'market_data');
  }

  /**
   * Cache portfolio data
   */
  async cachePortfolio(userId: number, portfolioData: any): Promise<boolean> {
    return this.set(userId.toString(), portfolioData, 'portfolio');
  }

  /**
   * Get portfolio data
   */
  async getPortfolio(userId: number): Promise<any | null> {
    return this.get(userId.toString(), 'portfolio');
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(identifier: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redis.get(key);
    
    if (current === null) {
      await this.redis.setex(key, window, 1);
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + (window * 1000) };
    }
    
    const count = parseInt(current);
    if (count >= limit) {
      const ttl = await this.redis.ttl(key);
      return { allowed: false, remaining: 0, resetTime: Date.now() + (ttl * 1000) };
    }
    
    await this.redis.incr(key);
    return { allowed: true, remaining: limit - count - 1, resetTime: Date.now() + (window * 1000) };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', latency: Date.now() - start };
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      console.log('Cache manager disconnected');
    } catch (error) {
      console.error('Error disconnecting cache manager:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
