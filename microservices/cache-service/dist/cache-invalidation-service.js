"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheInvalidationService = exports.CacheInvalidationService = exports.InvalidationStrategy = void 0;
const events_1 = require("events");
const enhanced_cache_manager_1 = require("./enhanced-cache-manager");
const trading_cache_layer_1 = require("./trading-cache-layer");
var InvalidationStrategy;
(function (InvalidationStrategy) {
    InvalidationStrategy["IMMEDIATE"] = "immediate";
    InvalidationStrategy["LAZY"] = "lazy";
    InvalidationStrategy["TIME_BASED"] = "time_based";
    InvalidationStrategy["DEPENDENCY_BASED"] = "dependency_based";
    InvalidationStrategy["PATTERN_BASED"] = "pattern_based";
})(InvalidationStrategy || (exports.InvalidationStrategy = InvalidationStrategy = {}));
class CacheInvalidationService extends events_1.EventEmitter {
    constructor() {
        super();
        this.rules = new Map();
        this.invalidationQueue = [];
        this.isProcessing = false;
        this.stats = {
            totalInvalidations: 0,
            successfulInvalidations: 0,
            failedInvalidations: 0,
            rulesProcessed: 0,
            averageProcessingTime: 0
        };
        this.initializeDefaultRules();
        this.startQueueProcessor();
    }
    initializeDefaultRules() {
        const defaultRules = [
            {
                id: 'user_session_invalidation',
                pattern: 'session:*',
                strategy: InvalidationStrategy.IMMEDIATE,
                priority: 10,
                enabled: true
            },
            {
                id: 'trading_session_invalidation',
                pattern: 'trading:*',
                strategy: InvalidationStrategy.IMMEDIATE,
                priority: 10,
                enabled: true
            },
            {
                id: 'market_data_invalidation',
                pattern: 'market:*',
                strategy: InvalidationStrategy.TIME_BASED,
                ttl: 30,
                priority: 5,
                enabled: true
            },
            {
                id: 'portfolio_invalidation',
                pattern: 'portfolio:*',
                strategy: InvalidationStrategy.DEPENDENCY_BASED,
                dependencies: ['user_session', 'trading_session'],
                priority: 8,
                enabled: true
            },
            {
                id: 'api_response_invalidation',
                pattern: 'api:*',
                strategy: InvalidationStrategy.LAZY,
                priority: 3,
                enabled: true
            },
            {
                id: 'user_profile_invalidation',
                pattern: 'user:*',
                strategy: InvalidationStrategy.DEPENDENCY_BASED,
                dependencies: ['user_session'],
                priority: 7,
                enabled: true
            },
            {
                id: 'websocket_invalidation',
                pattern: 'ws:*',
                strategy: InvalidationStrategy.IMMEDIATE,
                priority: 9,
                enabled: true
            }
        ];
        defaultRules.forEach(rule => {
            this.addRule(rule);
        });
    }
    addRule(rule) {
        this.rules.set(rule.id, rule);
        this.emit('ruleAdded', { ruleId: rule.id, rule });
    }
    removeRule(ruleId) {
        const deleted = this.rules.delete(ruleId);
        if (deleted) {
            this.emit('ruleRemoved', { ruleId });
        }
        return deleted;
    }
    updateRule(ruleId, updates) {
        const rule = this.rules.get(ruleId);
        if (!rule)
            return false;
        const updatedRule = { ...rule, ...updates };
        this.rules.set(ruleId, updatedRule);
        this.emit('ruleUpdated', { ruleId, rule: updatedRule });
        return true;
    }
    async invalidate(pattern, context) {
        const events = [];
        const matchingRules = this.getMatchingRules(pattern);
        for (const rule of matchingRules) {
            if (!rule.enabled)
                continue;
            const event = {
                ruleId: rule.id,
                pattern: rule.pattern,
                strategy: rule.strategy,
                timestamp: Date.now(),
                affectedKeys: [],
                success: false
            };
            try {
                switch (rule.strategy) {
                    case InvalidationStrategy.IMMEDIATE:
                        await this.immediateInvalidation(rule, context, event);
                        break;
                    case InvalidationStrategy.LAZY:
                        this.lazyInvalidation(rule, context, event);
                        break;
                    case InvalidationStrategy.TIME_BASED:
                        this.timeBasedInvalidation(rule, context, event);
                        break;
                    case InvalidationStrategy.DEPENDENCY_BASED:
                        await this.dependencyBasedInvalidation(rule, context, event);
                        break;
                    case InvalidationStrategy.PATTERN_BASED:
                        await this.patternBasedInvalidation(rule, context, event);
                        break;
                }
                event.success = true;
                this.stats.successfulInvalidations++;
            }
            catch (error) {
                event.error = error instanceof Error ? error.message : 'Unknown error';
                this.stats.failedInvalidations++;
                console.error(`Invalidation error for rule ${rule.id}:`, error);
            }
            events.push(event);
            this.stats.totalInvalidations++;
        }
        this.emit('invalidationCompleted', { events, pattern });
        return events;
    }
    async immediateInvalidation(rule, context, event) {
        const startTime = Date.now();
        const affectedKeys = await enhanced_cache_manager_1.enhancedCacheManager.invalidatePattern(rule.pattern);
        event.affectedKeys = Array.isArray(affectedKeys) ? affectedKeys.map(key => key.toString()) : [affectedKeys.toString()];
        if (rule.pattern.includes('trading:') || rule.pattern.includes('session:')) {
            await trading_cache_layer_1.tradingCacheLayer.invalidateSessionData(context?.sessionId || '');
        }
        if (rule.pattern.includes('portfolio:') || rule.pattern.includes('user:')) {
            await trading_cache_layer_1.tradingCacheLayer.invalidateUserData(context?.userId || 0);
        }
        this.updateProcessingTime(Date.now() - startTime);
    }
    lazyInvalidation(rule, context, event) {
        this.invalidationQueue.push({ rule, context });
        event.affectedKeys = ['queued'];
        this.emit('invalidationQueued', { ruleId: rule.id, context });
    }
    timeBasedInvalidation(rule, context, event) {
        if (!rule.ttl) {
            throw new Error('TTL required for time-based invalidation');
        }
        setTimeout(async () => {
            try {
                await this.immediateInvalidation(rule, context, event);
            }
            catch (error) {
                console.error('Scheduled invalidation failed:', error);
            }
        }, rule.ttl * 1000);
        event.affectedKeys = ['scheduled'];
        this.emit('invalidationScheduled', { ruleId: rule.id, ttl: rule.ttl });
    }
    async dependencyBasedInvalidation(rule, context, event) {
        if (!rule.dependencies || rule.dependencies.length === 0) {
            throw new Error('Dependencies required for dependency-based invalidation');
        }
        const shouldInvalidate = await this.checkDependencies(rule.dependencies, context);
        if (shouldInvalidate) {
            await this.immediateInvalidation(rule, context, event);
        }
        else {
            event.affectedKeys = ['dependency_check_passed'];
        }
    }
    async patternBasedInvalidation(rule, _context, event) {
        const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'));
        const keys = await enhanced_cache_manager_1.enhancedCacheManager.keys('*');
        const matchingKeys = keys.filter((key) => regex.test(key));
        for (const key of matchingKeys) {
            await enhanced_cache_manager_1.enhancedCacheManager.invalidate(key, 'api_response');
        }
        event.affectedKeys = matchingKeys;
    }
    async checkDependencies(dependencies, _context) {
        for (const dep of dependencies) {
            const exists = await enhanced_cache_manager_1.enhancedCacheManager.exists(dep, 'user_session');
            if (!exists) {
                return true;
            }
        }
        return false;
    }
    getMatchingRules(pattern) {
        const matchingRules = [];
        for (const rule of this.rules.values()) {
            if (this.patternMatches(rule.pattern, pattern)) {
                matchingRules.push(rule);
            }
        }
        return matchingRules.sort((a, b) => b.priority - a.priority);
    }
    patternMatches(rulePattern, inputPattern) {
        const regexPattern = rulePattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(inputPattern);
    }
    startQueueProcessor() {
        setInterval(async () => {
            if (this.isProcessing || this.invalidationQueue.length === 0)
                return;
            this.isProcessing = true;
            try {
                const batch = this.invalidationQueue.splice(0, 10);
                for (const { rule, context } of batch) {
                    const event = {
                        ruleId: rule.id,
                        pattern: rule.pattern,
                        strategy: rule.strategy,
                        timestamp: Date.now(),
                        affectedKeys: [],
                        success: false
                    };
                    try {
                        await this.immediateInvalidation(rule, context, event);
                        event.success = true;
                        this.stats.successfulInvalidations++;
                    }
                    catch (error) {
                        event.error = error instanceof Error ? error.message : 'Unknown error';
                        this.stats.failedInvalidations++;
                    }
                    this.stats.totalInvalidations++;
                    this.emit('lazyInvalidationProcessed', { event });
                }
            }
            finally {
                this.isProcessing = false;
            }
        }, 1000);
    }
    updateProcessingTime(processingTime) {
        this.stats.rulesProcessed++;
        this.stats.averageProcessingTime =
            (this.stats.averageProcessingTime * (this.stats.rulesProcessed - 1) + processingTime) /
                this.stats.rulesProcessed;
    }
    getStats() {
        const successRate = this.stats.totalInvalidations > 0
            ? (this.stats.successfulInvalidations / this.stats.totalInvalidations) * 100
            : 0;
        return {
            ...this.stats,
            successRate: parseFloat(successRate.toFixed(2)),
            queueSize: this.invalidationQueue.length,
            activeRules: Array.from(this.rules.values()).filter(rule => rule.enabled).length
        };
    }
    getAllRules() {
        return Array.from(this.rules.values());
    }
    clearRules() {
        this.rules.clear();
        this.emit('rulesCleared');
    }
    async healthCheck() {
        const stats = this.getStats();
        const status = stats.successRate > 90 ? 'healthy' : 'degraded';
        return { status, stats };
    }
    async shutdown() {
        try {
            while (this.invalidationQueue.length > 0) {
                const batch = this.invalidationQueue.splice(0, 10);
                for (const { rule, context } of batch) {
                    try {
                        await this.immediateInvalidation(rule, context, {
                            ruleId: rule.id,
                            pattern: rule.pattern,
                            strategy: rule.strategy,
                            timestamp: Date.now(),
                            affectedKeys: [],
                            success: false
                        });
                    }
                    catch (error) {
                        console.error('Error processing final invalidation:', error);
                    }
                }
            }
            console.log('Cache invalidation service shutdown complete');
        }
        catch (error) {
            console.error('Error during cache invalidation service shutdown:', error);
        }
    }
}
exports.CacheInvalidationService = CacheInvalidationService;
exports.cacheInvalidationService = new CacheInvalidationService();
//# sourceMappingURL=cache-invalidation-service.js.map