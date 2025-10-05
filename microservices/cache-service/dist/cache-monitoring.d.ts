import { EventEmitter } from 'events';
interface CacheMetrics {
    timestamp: number;
    hitRate: number;
    missRate: number;
    totalRequests: number;
    averageLatency: number;
    memoryUsage: number;
    errorRate: number;
    evictionRate: number;
    levels: {
        l1: LevelMetrics;
        l2: LevelMetrics;
        l3: LevelMetrics;
    };
}
interface LevelMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    latency: number;
    memoryUsage: number;
    size: number;
}
interface AlertRule {
    id: string;
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    cooldown: number;
    lastTriggered?: number;
}
interface Alert {
    id: string;
    ruleId: string;
    metric: string;
    value: number;
    threshold: number;
    severity: string;
    timestamp: number;
    message: string;
    resolved: boolean;
}
interface PerformanceReport {
    period: string;
    startTime: number;
    endTime: number;
    metrics: CacheMetrics;
    alerts: Alert[];
    recommendations: string[];
}
export declare class CacheMonitoringService extends EventEmitter {
    private metrics;
    private alerts;
    private alertRules;
    private isMonitoring;
    private monitoringInterval?;
    private maxMetricsHistory;
    private readonly THRESHOLDS;
    constructor();
    private initializeDefaultAlertRules;
    private startMonitoring;
    stopMonitoring(): void;
    private collectMetrics;
    private checkAlerts;
    private getMetricValue;
    private evaluateCondition;
    private createAlert;
    private generateAlertMessage;
    private sendNotification;
    addAlertRule(rule: AlertRule): void;
    removeAlertRule(ruleId: string): boolean;
    getCurrentMetrics(): CacheMetrics | null;
    getMetricsHistory(limit?: number): CacheMetrics[];
    getActiveAlerts(): Alert[];
    getAllAlerts(limit?: number): Alert[];
    resolveAlert(alertId: string): boolean;
    generateReport(period: string, startTime: number, endTime: number): PerformanceReport;
    private calculateAverageMetrics;
    private generateRecommendations;
    private getEmptyMetrics;
    healthCheck(): Promise<{
        status: string;
        metrics: any;
        alerts: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const cacheMonitoringService: CacheMonitoringService;
export {};
//# sourceMappingURL=cache-monitoring.d.ts.map