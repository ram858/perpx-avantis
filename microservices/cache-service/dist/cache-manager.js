"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheManager = exports.CacheManager = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = require("crypto");
class CacheManager {
    constructor() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        this.cacheConfigs = {
            user_session: { ttl: 86400, prefix: 'session:', serialize: true },
            user_profile: { ttl: 3600, prefix: 'user:', serialize: true },
            trading_session: { ttl: 86400, prefix: 'trading:', serialize: true },
            market_data: { ttl: 30, prefix: 'market:', serialize: true },
            portfolio: { ttl: 300, prefix: 'portfolio:', serialize: true },
            api_response: { ttl: 600, prefix: 'api:', serialize: true },
            rate_limit: { ttl: 3600, prefix: 'rate:', serialize: false },
            websocket_connection: { ttl: 86400, prefix: 'ws:', serialize: true },
        };
        this.redis = new ioredis_1.default({
            host: process.env['REDIS_HOST'] || 'localhost',
            port: parseInt(process.env['REDIS_PORT'] || '6379'),
            password: process.env['REDIS_PASSWORD'] || '',
            lazyConnect: true,
            family: 4,
            keepAlive: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
            enableReadyCheck: false,
        });
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
    async get(key, configType) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return null;
            }
            const fullKey = this.buildKey(key, config);
            const value = await this.redis.get(fullKey);
            if (value === null) {
                this.stats.misses++;
                return null;
            }
            this.stats.hits++;
            return config.serialize ? JSON.parse(value) : value;
        }
        catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            this.stats.errors++;
            return null;
        }
    }
    async set(key, value, configType, customTtl) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return false;
            }
            const fullKey = this.buildKey(key, config);
            const ttl = customTtl || config.ttl;
            const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
            await this.redis.setex(fullKey, ttl, serializedValue);
            this.stats.sets++;
            return true;
        }
        catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async delete(key, configType) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return false;
            }
            const fullKey = this.buildKey(key, config);
            const result = await this.redis.del(fullKey);
            this.stats.deletes++;
            return result > 0;
        }
        catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async exists(key, configType) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return false;
            }
            const fullKey = this.buildKey(key, config);
            const result = await this.redis.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache exists error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async mset(keyValuePairs, customTtl) {
        try {
            const pipeline = this.redis.pipeline();
            for (const { key, value, configType } of keyValuePairs) {
                const config = this.cacheConfigs[configType];
                if (!config)
                    continue;
                const fullKey = this.buildKey(key, config);
                const ttl = customTtl || config.ttl;
                const serializedValue = config.serialize ? JSON.stringify(value) : String(value);
                pipeline.setex(fullKey, ttl, serializedValue);
            }
            await pipeline.exec();
            this.stats.sets += keyValuePairs.length;
            return true;
        }
        catch (error) {
            console.error('Cache mset error:', error);
            this.stats.errors++;
            return false;
        }
    }
    async mget(keys) {
        try {
            const fullKeys = keys.map(({ key, configType }) => {
                const config = this.cacheConfigs[configType];
                if (!config)
                    return '';
                return this.buildKey(key, config);
            }).filter(key => key !== '');
            const values = await this.redis.mget(...fullKeys);
            return values.map((value, index) => {
                if (value === null) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                const config = this.cacheConfigs[keys[index]?.configType || ''];
                if (!config)
                    return null;
                return config.serialize ? JSON.parse(value) : value;
            });
        }
        catch (error) {
            console.error('Cache mget error:', error);
            this.stats.errors++;
            return keys.map(() => null);
        }
    }
    async increment(key, configType, amount = 1) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return 0;
            }
            const fullKey = this.buildKey(key, config);
            const result = await this.redis.incrby(fullKey, amount);
            return result;
        }
        catch (error) {
            console.error(`Cache increment error for key ${key}:`, error);
            this.stats.errors++;
            return 0;
        }
    }
    async expire(key, configType, ttl) {
        try {
            const config = this.cacheConfigs[configType];
            if (!config) {
                console.error(`Unknown cache config type: ${configType}`);
                return false;
            }
            const fullKey = this.buildKey(key, config);
            const result = await this.redis.expire(fullKey, ttl);
            return result === 1;
        }
        catch (error) {
            console.error(`Cache expire error for key ${key}:`, error);
            this.stats.errors++;
            return false;
        }
    }
    async keys(pattern) {
        try {
            return await this.redis.keys(pattern);
        }
        catch (error) {
            console.error(`Cache keys error for pattern ${pattern}:`, error);
            this.stats.errors++;
            return [];
        }
    }
    async flushall() {
        try {
            await this.redis.flushall();
            return true;
        }
        catch (error) {
            console.error('Cache flushall error:', error);
            this.stats.errors++;
            return false;
        }
    }
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
        return {
            ...this.stats,
            hitRate: parseFloat(hitRate.toFixed(2))
        };
    }
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
    }
    buildKey(key, config) {
        if (key.length > 100) {
            const hash = (0, crypto_1.createHash)('md5').update(key).digest('hex');
            return `${config.prefix}${hash}`;
        }
        return `${config.prefix}${key}`;
    }
    async cacheUserSession(userId, sessionData) {
        return this.set(userId.toString(), sessionData, 'user_session');
    }
    async getUserSession(userId) {
        return this.get(userId.toString(), 'user_session');
    }
    async cacheTradingSession(sessionId, sessionData) {
        return this.set(sessionId, sessionData, 'trading_session');
    }
    async getTradingSession(sessionId) {
        return this.get(sessionId, 'trading_session');
    }
    async cacheMarketData(symbol, data) {
        return this.set(symbol, data, 'market_data');
    }
    async getMarketData(symbol) {
        return this.get(symbol, 'market_data');
    }
    async cachePortfolio(userId, portfolioData) {
        return this.set(userId.toString(), portfolioData, 'portfolio');
    }
    async getPortfolio(userId) {
        return this.get(userId.toString(), 'portfolio');
    }
    async checkRateLimit(identifier, limit, window) {
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
    async healthCheck() {
        const start = Date.now();
        try {
            await this.redis.ping();
            const latency = Date.now() - start;
            return { status: 'healthy', latency };
        }
        catch (error) {
            return { status: 'unhealthy', latency: Date.now() - start };
        }
    }
    async disconnect() {
        try {
            await this.redis.disconnect();
            console.log('Cache manager disconnected');
        }
        catch (error) {
            console.error('Error disconnecting cache manager:', error);
        }
    }
}
exports.CacheManager = CacheManager;
exports.cacheManager = new CacheManager();
//# sourceMappingURL=cache-manager.js.map