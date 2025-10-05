import { EventEmitter } from 'events';
export declare enum InvalidationStrategy {
    IMMEDIATE = "immediate",
    LAZY = "lazy",
    TIME_BASED = "time_based",
    DEPENDENCY_BASED = "dependency_based",
    PATTERN_BASED = "pattern_based"
}
interface InvalidationRule {
    id: string;
    pattern: string;
    strategy: InvalidationStrategy;
    ttl?: number;
    dependencies?: string[];
    priority: number;
    enabled: boolean;
}
interface InvalidationEvent {
    ruleId: string;
    pattern: string;
    strategy: InvalidationStrategy;
    timestamp: number;
    affectedKeys: string[];
    success: boolean;
    error?: string;
}
export declare class CacheInvalidationService extends EventEmitter {
    private rules;
    private invalidationQueue;
    private isProcessing;
    private stats;
    constructor();
    private initializeDefaultRules;
    addRule(rule: InvalidationRule): void;
    removeRule(ruleId: string): boolean;
    updateRule(ruleId: string, updates: Partial<InvalidationRule>): boolean;
    invalidate(pattern: string, context?: any): Promise<InvalidationEvent[]>;
    private immediateInvalidation;
    private lazyInvalidation;
    private timeBasedInvalidation;
    private dependencyBasedInvalidation;
    private patternBasedInvalidation;
    private checkDependencies;
    private getMatchingRules;
    private patternMatches;
    private startQueueProcessor;
    private updateProcessingTime;
    getStats(): typeof this.stats & {
        successRate: number;
        queueSize: number;
        activeRules: number;
    };
    getAllRules(): InvalidationRule[];
    clearRules(): void;
    healthCheck(): Promise<{
        status: string;
        stats: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const cacheInvalidationService: CacheInvalidationService;
export {};
//# sourceMappingURL=cache-invalidation-service.d.ts.map