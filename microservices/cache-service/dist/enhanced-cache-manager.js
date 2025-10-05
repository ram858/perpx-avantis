"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedCacheManager = exports.EnhancedCacheManager = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = require("crypto");
const events_1 = require("events");
class EnhancedCacheManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.l1Cache = new Map();
        this.writeBehindQueue = [];
        this.stats = {
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
        this.cacheConfigs = {
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
        this.L1_MAX_SIZE = 10000;
        this.L1_CLEANUP_INTERVAL = 300000;
        this.initializeRedisCluster();
        this.startL1Cleanup();
        this.startWriteBehindProcessor();
    }
    initializeRedisCluster() {
        const sentinels = [
            { host: 'redis-sentinel-1', port: 26379 },
            { host: 'redis-sentinel-2', port: 26380 },
            { host: 'redis-sentinel-3', port: 26381 }
        ];
        this.l2Redis = new ioredis_1.default({
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
    async get(key, configType) {
        const config = this.cacheConfigs[configType];
        if (!config) {
            throw new Error(`Unknown cache config type: ${configType}`);
        }
        const fullKey = this.buildKey(key, config);
        try {
            if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
                const l1Result = await this.getFromL1(fullKey);
                if (l1Result !== null) {
                    this.stats.l1Hits++;
                    this.stats.hits++;
                    return l1Result;
                }
            }
            if (config.level === 'L2' || config.level === 'L3') {
                const l2Result = await this.getFromL2(fullKey, config);
                if (l2Result !== null) {
                    this.stats.l2Hits++;
                    this.stats.hits++;
                    if (config.level === 'L2') {
                        await this.setInL1(fullKey, l2Result, config.ttl);
                    }
                    return l2Result;
                }
            }
            if (config.level === 'L3') {
                const l3Result = await this.getFromL3(fullKey, config);
                if (l3Result !== null) {
                    this.stats.l3Hits++;
                    this.stats.hits++;
                    await this.setInL2(fullKey, l3Result, config);
                    await this.setInL1(fullKey, l3Result, config.ttl);
                    return l3Result;
                }
            }
            this.stats.misses++;
            return null;
        }
        catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            this.stats.errors++;
            return null;
        }
    }
    async set(key, value, configType, customTtl) {
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
        }
        catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async cacheAsideSet(key, value, config, ttl) {
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
    async writeThroughSet(key, value, config, ttl) {
        const promises = [];
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
    async writeBehindSet(key, value, config, ttl) {
        if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
            await this.setInL1(key, value, ttl);
        }
        this.writeBehindQueue.push({
            key,
            value,
            configType: config.prefix,
            timestamp: Date.now()
        });
        this.stats.sets++;
        return true;
    }
    async getFromL1(key) {
        const entry = this.l1Cache.get(key);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > entry.ttl * 1000) {
            this.l1Cache.delete(key);
            return null;
        }
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        return entry.value;
    }
    async setInL1(key, value, ttl) {
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
    evictLRU() {
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
    async getFromL2(key, config) {
        try {
            const value = await this.l2Redis.get(key);
            if (value === null)
                return null;
            return config.serialize ? JSON.parse(value) : value;
        }
        catch (error) {
            console.error('L2 cache get error:', error);
            return null;
        }
    }
    async setInL2(key, value, config) {
        try {
            const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
            await this.l2Redis.setex(key, config.ttl, serializedValue);
        }
        catch (error) {
            console.error('L2 cache set error:', error);
        }
    }
    async getFromL3(_key, _config) {
        return null;
    }
    async setInL3(_key, _value, _config) {
    }
    async invalidate(key, configType) {
        const config = this.cacheConfigs[configType];
        if (!config)
            return false;
        const fullKey = this.buildKey(key, config);
        const promises = [];
        if (config.level === 'L1' || config.level === 'L2' || config.level === 'L3') {
            this.l1Cache.delete(fullKey);
        }
        if (config.level === 'L2' || config.level === 'L3') {
            promises.push(this.l2Redis.del(fullKey));
        }
        if (config.level === 'L3') {
        }
        await Promise.all(promises);
        this.stats.deletes++;
        return true;
    }
    async invalidatePattern(pattern) {
        try {
            const keys = await this.l2Redis.keys(pattern);
            if (keys.length === 0)
                return 0;
            const pipeline = this.l2Redis.pipeline();
            keys.forEach(key => pipeline.del(key));
            await pipeline.exec();
            for (const key of keys) {
                this.l1Cache.delete(key);
            }
            this.stats.deletes += keys.length;
            return keys.length;
        }
        catch (error) {
            console.error('Pattern invalidation error:', error);
            return 0;
        }
    }
    async warmCache(key, configType, dataLoader) {
        const cached = await this.get(key, configType);
        if (cached !== null)
            return cached;
        try {
            const data = await dataLoader();
            await this.set(key, data, configType);
            return data;
        }
        catch (error) {
            console.error('Cache warming error:', error);
            return null;
        }
    }
    startWriteBehindProcessor() {
        setInterval(async () => {
            if (this.writeBehindQueue.length === 0)
                return;
            const batch = this.writeBehindQueue.splice(0, 100);
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
            }
            catch (error) {
                console.error('Write-behind processing error:', error);
                this.writeBehindQueue.unshift(...batch);
            }
        }, 1000);
    }
    startL1Cleanup() {
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
    buildKey(key, config) {
        if (key.length > 100) {
            const hash = (0, crypto_1.createHash)('md5').update(key).digest('hex');
            return `${config.prefix}${hash}`;
        }
        return `${config.prefix}${key}`;
    }
    getStats() {
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
    async healthCheck() {
        const start = Date.now();
        const levels = {};
        try {
            levels.l1 = { status: 'healthy', size: this.l1Cache.size };
            const redisStart = Date.now();
            await this.l2Redis.ping();
            levels.l2 = {
                status: 'healthy',
                latency: Date.now() - redisStart
            };
            levels.l3 = { status: 'healthy', latency: 0 };
            const latency = Date.now() - start;
            return { status: 'healthy', latency, levels };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                latency: Date.now() - start,
                levels,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async keys(pattern) {
        try {
            return await this.l2Redis.keys(pattern);
        }
        catch (error) {
            console.error(`Cache keys error for pattern ${pattern}:`, error);
            this.stats.errors++;
            return [];
        }
    }
    async exists(key, configType) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config)
                return false;
            const fullKey = this.buildKey(key, config);
            const result = await this.l2Redis.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache exists error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async disconnect() {
        try {
            if (this.writeBehindQueue.length > 0) {
                console.log(`Processing ${this.writeBehindQueue.length} remaining write-behind items...`);
                await this.startWriteBehindProcessor();
            }
            await this.l2Redis.disconnect();
            this.l1Cache.clear();
            console.log('Enhanced cache manager disconnected');
        }
        catch (error) {
            console.error('Error disconnecting enhanced cache manager:', error);
        }
    }
}
exports.EnhancedCacheManager = EnhancedCacheManager;
exports.enhancedCacheManager = new EnhancedCacheManager();
//# sourceMappingURL=enhanced-cache-manager.js.map