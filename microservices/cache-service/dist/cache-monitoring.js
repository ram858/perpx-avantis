"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheMonitoringService = exports.CacheMonitoringService = void 0;
const events_1 = require("events");
const enhanced_cache_manager_1 = require("./enhanced-cache-manager");
const trading_cache_layer_1 = require("./trading-cache-layer");
class CacheMonitoringService extends events_1.EventEmitter {
    constructor() {
        super();
        this.metrics = [];
        this.alerts = [];
        this.alertRules = new Map();
        this.isMonitoring = false;
        this.maxMetricsHistory = 1000;
        this.THRESHOLDS = {
            HIT_RATE_LOW: 80,
            HIT_RATE_CRITICAL: 60,
            LATENCY_HIGH: 100,
            LATENCY_CRITICAL: 500,
            ERROR_RATE_HIGH: 5,
            ERROR_RATE_CRITICAL: 10,
            MEMORY_USAGE_HIGH: 80,
            MEMORY_USAGE_CRITICAL: 95,
            EVICTION_RATE_HIGH: 10,
        };
        this.initializeDefaultAlertRules();
        this.startMonitoring();
    }
    initializeDefaultAlertRules() {
        const defaultRules = [
            {
                id: 'hit_rate_low',
                metric: 'hitRate',
                operator: 'lt',
                threshold: this.THRESHOLDS.HIT_RATE_LOW,
                severity: 'medium',
                enabled: true,
                cooldown: 300
            },
            {
                id: 'hit_rate_critical',
                metric: 'hitRate',
                operator: 'lt',
                threshold: this.THRESHOLDS.HIT_RATE_CRITICAL,
                severity: 'critical',
                enabled: true,
                cooldown: 60
            },
            {
                id: 'latency_high',
                metric: 'averageLatency',
                operator: 'gt',
                threshold: this.THRESHOLDS.LATENCY_HIGH,
                severity: 'medium',
                enabled: true,
                cooldown: 300
            },
            {
                id: 'latency_critical',
                metric: 'averageLatency',
                operator: 'gt',
                threshold: this.THRESHOLDS.LATENCY_CRITICAL,
                severity: 'critical',
                enabled: true,
                cooldown: 60
            },
            {
                id: 'error_rate_high',
                metric: 'errorRate',
                operator: 'gt',
                threshold: this.THRESHOLDS.ERROR_RATE_HIGH,
                severity: 'high',
                enabled: true,
                cooldown: 180
            },
            {
                id: 'memory_usage_high',
                metric: 'memoryUsage',
                operator: 'gt',
                threshold: this.THRESHOLDS.MEMORY_USAGE_HIGH,
                severity: 'high',
                enabled: true,
                cooldown: 300
            },
            {
                id: 'eviction_rate_high',
                metric: 'evictionRate',
                operator: 'gt',
                threshold: this.THRESHOLDS.EVICTION_RATE_HIGH,
                severity: 'medium',
                enabled: true,
                cooldown: 300
            }
        ];
        defaultRules.forEach(rule => {
            this.alertRules.set(rule.id, rule);
        });
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
            }
            catch (error) {
                console.error('Error collecting cache metrics:', error);
            }
        }, 10000);
        console.log('Cache monitoring started');
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.isMonitoring = false;
        console.log('Cache monitoring stopped');
    }
    async collectMetrics() {
        try {
            const timestamp = Date.now();
            const enhancedStats = enhanced_cache_manager_1.enhancedCacheManager.getStats();
            const tradingStats = trading_cache_layer_1.tradingCacheLayer.getTradingCacheStats();
            const l1Metrics = {
                hits: enhancedStats.l1Hits,
                misses: enhancedStats.misses - enhancedStats.l2Hits - enhancedStats.l3Hits,
                hitRate: enhancedStats.l1HitRate,
                latency: 0,
                memoryUsage: tradingStats.totalMemoryUsage,
                size: enhancedStats.l1Size
            };
            const l2Metrics = {
                hits: enhancedStats.l2Hits,
                misses: enhancedStats.misses - enhancedStats.l3Hits,
                hitRate: enhancedStats.l2HitRate,
                latency: 0,
                memoryUsage: 0,
                size: 0
            };
            const l3Metrics = {
                hits: enhancedStats.l3Hits,
                misses: 0,
                hitRate: enhancedStats.l3HitRate,
                latency: 0,
                memoryUsage: 0,
                size: 0
            };
            const totalRequests = enhancedStats.hits + enhancedStats.misses;
            const hitRate = totalRequests > 0 ? (enhancedStats.hits / totalRequests) * 100 : 0;
            const missRate = 100 - hitRate;
            const errorRate = totalRequests > 0 ? (enhancedStats.errors / totalRequests) * 100 : 0;
            const evictionRate = (enhancedStats.evictions / 60) * 6;
            const metrics = {
                timestamp,
                hitRate: parseFloat(hitRate.toFixed(2)),
                missRate: parseFloat(missRate.toFixed(2)),
                totalRequests,
                averageLatency: enhancedStats.hitRate,
                memoryUsage: tradingStats.totalMemoryUsage,
                errorRate: parseFloat(errorRate.toFixed(2)),
                evictionRate: parseFloat(evictionRate.toFixed(2)),
                levels: {
                    l1: l1Metrics,
                    l2: l2Metrics,
                    l3: l3Metrics
                }
            };
            this.metrics.push(metrics);
            if (this.metrics.length > this.maxMetricsHistory) {
                this.metrics = this.metrics.slice(-this.maxMetricsHistory);
            }
            await this.checkAlerts(metrics);
            this.emit('metricsCollected', { metrics });
        }
        catch (error) {
            console.error('Error collecting metrics:', error);
            this.emit('metricsError', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    async checkAlerts(metrics) {
        for (const rule of this.alertRules.values()) {
            if (!rule.enabled)
                continue;
            if (rule.lastTriggered &&
                Date.now() - rule.lastTriggered < rule.cooldown * 1000) {
                continue;
            }
            const value = this.getMetricValue(metrics, rule.metric);
            if (value === undefined)
                continue;
            const shouldAlert = this.evaluateCondition(value, rule.operator, rule.threshold);
            if (shouldAlert) {
                await this.createAlert(rule, value, metrics);
                rule.lastTriggered = Date.now();
            }
        }
    }
    getMetricValue(metrics, metric) {
        const metricPath = metric.split('.');
        let value = metrics;
        for (const path of metricPath) {
            if (value && typeof value === 'object' && path in value) {
                value = value[path];
            }
            else {
                return undefined;
            }
        }
        return typeof value === 'number' ? value : undefined;
    }
    evaluateCondition(value, operator, threshold) {
        switch (operator) {
            case 'gt': return value > threshold;
            case 'lt': return value < threshold;
            case 'eq': return value === threshold;
            case 'gte': return value >= threshold;
            case 'lte': return value <= threshold;
            default: return false;
        }
    }
    async createAlert(rule, value, metrics) {
        const alert = {
            id: `${rule.id}_${Date.now()}`,
            ruleId: rule.id,
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            severity: rule.severity,
            timestamp: Date.now(),
            message: this.generateAlertMessage(rule, value, metrics),
            resolved: false
        };
        this.alerts.push(alert);
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(-1000);
        }
        this.emit('alertCreated', { alert });
        await this.sendNotification(alert);
    }
    generateAlertMessage(rule, value, _metrics) {
        const operatorText = {
            'gt': 'greater than',
            'lt': 'less than',
            'eq': 'equal to',
            'gte': 'greater than or equal to',
            'lte': 'less than or equal to'
        };
        return `Cache ${rule.metric} is ${operatorText[rule.operator]} ${rule.threshold} (current: ${value.toFixed(2)})`;
    }
    async sendNotification(alert) {
        console.log(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
        this.emit('notificationRequired', { alert });
    }
    addAlertRule(rule) {
        this.alertRules.set(rule.id, rule);
        this.emit('alertRuleAdded', { rule });
    }
    removeAlertRule(ruleId) {
        const deleted = this.alertRules.delete(ruleId);
        if (deleted) {
            this.emit('alertRuleRemoved', { ruleId });
        }
        return deleted;
    }
    getCurrentMetrics() {
        return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    }
    getMetricsHistory(limit) {
        if (limit) {
            return this.metrics.slice(-limit);
        }
        return [...this.metrics];
    }
    getActiveAlerts() {
        return this.alerts.filter(alert => !alert.resolved);
    }
    getAllAlerts(limit) {
        if (limit) {
            return this.alerts.slice(-limit);
        }
        return [...this.alerts];
    }
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            this.emit('alertResolved', { alert });
            return true;
        }
        return false;
    }
    generateReport(period, startTime, endTime) {
        const periodMetrics = this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
        const periodAlerts = this.alerts.filter(a => a.timestamp >= startTime && a.timestamp <= endTime);
        const avgMetrics = periodMetrics.length > 0
            ? this.calculateAverageMetrics(periodMetrics)
            : this.getCurrentMetrics() || this.getEmptyMetrics();
        const recommendations = this.generateRecommendations(avgMetrics, periodAlerts);
        return {
            period,
            startTime,
            endTime,
            metrics: avgMetrics,
            alerts: periodAlerts,
            recommendations
        };
    }
    calculateAverageMetrics(metrics) {
        if (metrics.length === 0)
            return this.getEmptyMetrics();
        const sum = metrics.reduce((acc, curr) => ({
            timestamp: 0,
            hitRate: acc.hitRate + curr.hitRate,
            missRate: acc.missRate + curr.missRate,
            totalRequests: acc.totalRequests + curr.totalRequests,
            averageLatency: acc.averageLatency + curr.averageLatency,
            memoryUsage: acc.memoryUsage + curr.memoryUsage,
            errorRate: acc.errorRate + curr.errorRate,
            evictionRate: acc.evictionRate + curr.evictionRate,
            levels: {
                l1: {
                    hits: acc.levels.l1.hits + curr.levels.l1.hits,
                    misses: acc.levels.l1.misses + curr.levels.l1.misses,
                    hitRate: acc.levels.l1.hitRate + curr.levels.l1.hitRate,
                    latency: acc.levels.l1.latency + curr.levels.l1.latency,
                    memoryUsage: acc.levels.l1.memoryUsage + curr.levels.l1.memoryUsage,
                    size: acc.levels.l1.size + curr.levels.l1.size
                },
                l2: {
                    hits: acc.levels.l2.hits + curr.levels.l2.hits,
                    misses: acc.levels.l2.misses + curr.levels.l2.misses,
                    hitRate: acc.levels.l2.hitRate + curr.levels.l2.hitRate,
                    latency: acc.levels.l2.latency + curr.levels.l2.latency,
                    memoryUsage: acc.levels.l2.memoryUsage + curr.levels.l2.memoryUsage,
                    size: acc.levels.l2.size + curr.levels.l2.size
                },
                l3: {
                    hits: acc.levels.l3.hits + curr.levels.l3.hits,
                    misses: acc.levels.l3.misses + curr.levels.l3.misses,
                    hitRate: acc.levels.l3.hitRate + curr.levels.l3.hitRate,
                    latency: acc.levels.l3.latency + curr.levels.l3.latency,
                    memoryUsage: acc.levels.l3.memoryUsage + curr.levels.l3.memoryUsage,
                    size: acc.levels.l3.size + curr.levels.l3.size
                }
            }
        }), this.getEmptyMetrics());
        const count = metrics.length;
        return {
            timestamp: Date.now(),
            hitRate: parseFloat((sum.hitRate / count).toFixed(2)),
            missRate: parseFloat((sum.missRate / count).toFixed(2)),
            totalRequests: Math.round(sum.totalRequests / count),
            averageLatency: parseFloat((sum.averageLatency / count).toFixed(2)),
            memoryUsage: Math.round(sum.memoryUsage / count),
            errorRate: parseFloat((sum.errorRate / count).toFixed(2)),
            evictionRate: parseFloat((sum.evictionRate / count).toFixed(2)),
            levels: {
                l1: {
                    hits: Math.round(sum.levels.l1.hits / count),
                    misses: Math.round(sum.levels.l1.misses / count),
                    hitRate: parseFloat((sum.levels.l1.hitRate / count).toFixed(2)),
                    latency: parseFloat((sum.levels.l1.latency / count).toFixed(2)),
                    memoryUsage: Math.round(sum.levels.l1.memoryUsage / count),
                    size: Math.round(sum.levels.l1.size / count)
                },
                l2: {
                    hits: Math.round(sum.levels.l2.hits / count),
                    misses: Math.round(sum.levels.l2.misses / count),
                    hitRate: parseFloat((sum.levels.l2.hitRate / count).toFixed(2)),
                    latency: parseFloat((sum.levels.l2.latency / count).toFixed(2)),
                    memoryUsage: Math.round(sum.levels.l2.memoryUsage / count),
                    size: Math.round(sum.levels.l2.size / count)
                },
                l3: {
                    hits: Math.round(sum.levels.l3.hits / count),
                    misses: Math.round(sum.levels.l3.misses / count),
                    hitRate: parseFloat((sum.levels.l3.hitRate / count).toFixed(2)),
                    latency: parseFloat((sum.levels.l3.latency / count).toFixed(2)),
                    memoryUsage: Math.round(sum.levels.l3.memoryUsage / count),
                    size: Math.round(sum.levels.l3.size / count)
                }
            }
        };
    }
    generateRecommendations(metrics, _alerts) {
        const recommendations = [];
        if (metrics.hitRate < 80) {
            recommendations.push('Consider increasing cache TTL or implementing cache warming strategies');
        }
        if (metrics.averageLatency > 100) {
            recommendations.push('High latency detected. Consider optimizing cache operations or increasing Redis memory');
        }
        if (metrics.errorRate > 5) {
            recommendations.push('High error rate detected. Check Redis connectivity and configuration');
        }
        if (metrics.evictionRate > 10) {
            recommendations.push('High eviction rate detected. Consider increasing cache size or optimizing data access patterns');
        }
        if (metrics.levels.l1.hitRate < 50) {
            recommendations.push('L1 cache hit rate is low. Consider optimizing application-level caching');
        }
        if (metrics.levels.l2.hitRate < 70) {
            recommendations.push('L2 cache hit rate is low. Consider reviewing Redis configuration and data patterns');
        }
        return recommendations;
    }
    getEmptyMetrics() {
        return {
            timestamp: Date.now(),
            hitRate: 0,
            missRate: 0,
            totalRequests: 0,
            averageLatency: 0,
            memoryUsage: 0,
            errorRate: 0,
            evictionRate: 0,
            levels: {
                l1: { hits: 0, misses: 0, hitRate: 0, latency: 0, memoryUsage: 0, size: 0 },
                l2: { hits: 0, misses: 0, hitRate: 0, latency: 0, memoryUsage: 0, size: 0 },
                l3: { hits: 0, misses: 0, hitRate: 0, latency: 0, memoryUsage: 0, size: 0 }
            }
        };
    }
    async healthCheck() {
        const currentMetrics = this.getCurrentMetrics();
        const activeAlerts = this.getActiveAlerts();
        const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
        const status = criticalAlerts.length > 0 ? 'critical' :
            activeAlerts.length > 5 ? 'warning' : 'healthy';
        return {
            status,
            metrics: currentMetrics,
            alerts: {
                total: activeAlerts.length,
                critical: criticalAlerts.length,
                recent: activeAlerts.slice(-5)
            }
        };
    }
    async shutdown() {
        this.stopMonitoring();
        console.log('Cache monitoring service shutdown complete');
    }
}
exports.CacheMonitoringService = CacheMonitoringService;
exports.cacheMonitoringService = new CacheMonitoringService();
//# sourceMappingURL=cache-monitoring.js.map