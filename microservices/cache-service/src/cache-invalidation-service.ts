import { EventEmitter } from 'events';
import { enhancedCacheManager } from './enhanced-cache-manager';
import { tradingCacheLayer } from './trading-cache-layer';

// Invalidation strategies
export enum InvalidationStrategy {
  IMMEDIATE = 'immediate',
  LAZY = 'lazy',
  TIME_BASED = 'time_based',
  DEPENDENCY_BASED = 'dependency_based',
  PATTERN_BASED = 'pattern_based'
}

// Invalidation rules
interface InvalidationRule {
  id: string;
  pattern: string;
  strategy: InvalidationStrategy;
  ttl?: number; // For time-based invalidation
  dependencies?: string[]; // For dependency-based invalidation
  priority: number; // Higher number = higher priority
  enabled: boolean;
}

// Invalidation event
interface InvalidationEvent {
  ruleId: string;
  pattern: string;
  strategy: InvalidationStrategy;
  timestamp: number;
  affectedKeys: string[];
  success: boolean;
  error?: string;
}

export class CacheInvalidationService extends EventEmitter {
  private rules: Map<string, InvalidationRule> = new Map();
  private invalidationQueue: Array<{ rule: InvalidationRule; context: any }> = [];
  private isProcessing = false;
  private stats = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    failedInvalidations: 0,
    rulesProcessed: 0,
    averageProcessingTime: 0
  };

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startQueueProcessor();
  }

  /**
   * Initialize default invalidation rules for trading system
   */
  private initializeDefaultRules(): void {
    const defaultRules: InvalidationRule[] = [
      // User session invalidation
      {
        id: 'user_session_invalidation',
        pattern: 'session:*',
        strategy: InvalidationStrategy.IMMEDIATE,
        priority: 10,
        enabled: true
      },
      
      // Trading session invalidation
      {
        id: 'trading_session_invalidation',
        pattern: 'trading:*',
        strategy: InvalidationStrategy.IMMEDIATE,
        priority: 10,
        enabled: true
      },
      
      // Market data invalidation (time-based)
      {
        id: 'market_data_invalidation',
        pattern: 'market:*',
        strategy: InvalidationStrategy.TIME_BASED,
        ttl: 30, // 30 seconds
        priority: 5,
        enabled: true
      },
      
      // Portfolio invalidation (dependency-based)
      {
        id: 'portfolio_invalidation',
        pattern: 'portfolio:*',
        strategy: InvalidationStrategy.DEPENDENCY_BASED,
        dependencies: ['user_session', 'trading_session'],
        priority: 8,
        enabled: true
      },
      
      // API response invalidation (lazy)
      {
        id: 'api_response_invalidation',
        pattern: 'api:*',
        strategy: InvalidationStrategy.LAZY,
        priority: 3,
        enabled: true
      },
      
      // User profile invalidation
      {
        id: 'user_profile_invalidation',
        pattern: 'user:*',
        strategy: InvalidationStrategy.DEPENDENCY_BASED,
        dependencies: ['user_session'],
        priority: 7,
        enabled: true
      },
      
      // WebSocket connection invalidation
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

  /**
   * Add invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', { ruleId: rule.id, rule });
  }

  /**
   * Remove invalidation rule
   */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.emit('ruleRemoved', { ruleId });
    }
    return deleted;
  }

  /**
   * Update invalidation rule
   */
  updateRule(ruleId: string, updates: Partial<InvalidationRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.emit('ruleUpdated', { ruleId, rule: updatedRule });
    return true;
  }

  /**
   * Trigger cache invalidation
   */
  async invalidate(pattern: string, context?: any): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];
    const matchingRules = this.getMatchingRules(pattern);

    for (const rule of matchingRules) {
      if (!rule.enabled) continue;

      const event: InvalidationEvent = {
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
      } catch (error) {
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

  /**
   * Immediate invalidation strategy
   */
  private async immediateInvalidation(
    rule: InvalidationRule, 
    context: any, 
    event: InvalidationEvent
  ): Promise<void> {
    const startTime = Date.now();
    
    // Invalidate from enhanced cache manager
      const affectedKeys = await enhancedCacheManager.invalidatePattern(rule.pattern);
      event.affectedKeys = Array.isArray(affectedKeys) ? affectedKeys.map(key => key.toString()) : [affectedKeys.toString()];

    // Invalidate from trading cache layer
    if (rule.pattern.includes('trading:') || rule.pattern.includes('session:')) {
      await tradingCacheLayer.invalidateSessionData(context?.sessionId || '');
    }
    
    if (rule.pattern.includes('portfolio:') || rule.pattern.includes('user:')) {
      await tradingCacheLayer.invalidateUserData(context?.userId || 0);
    }

    this.updateProcessingTime(Date.now() - startTime);
  }

  /**
   * Lazy invalidation strategy (queued for later processing)
   */
  private lazyInvalidation(
    rule: InvalidationRule, 
    context: any, 
    event: InvalidationEvent
  ): void {
    this.invalidationQueue.push({ rule, context });
    event.affectedKeys = ['queued'];
    this.emit('invalidationQueued', { ruleId: rule.id, context });
  }

  /**
   * Time-based invalidation strategy
   */
  private timeBasedInvalidation(
    rule: InvalidationRule, 
    context: any, 
    event: InvalidationEvent
  ): void {
    if (!rule.ttl) {
      throw new Error('TTL required for time-based invalidation');
    }

    // Schedule invalidation after TTL
    setTimeout(async () => {
      try {
        await this.immediateInvalidation(rule, context, event);
      } catch (error) {
        console.error('Scheduled invalidation failed:', error);
      }
    }, rule.ttl * 1000);

    event.affectedKeys = ['scheduled'];
    this.emit('invalidationScheduled', { ruleId: rule.id, ttl: rule.ttl });
  }

  /**
   * Dependency-based invalidation strategy
   */
  private async dependencyBasedInvalidation(
    rule: InvalidationRule, 
    context: any, 
    event: InvalidationEvent
  ): Promise<void> {
    if (!rule.dependencies || rule.dependencies.length === 0) {
      throw new Error('Dependencies required for dependency-based invalidation');
    }

    // Check if any dependencies have been invalidated
    const shouldInvalidate = await this.checkDependencies(rule.dependencies, context);
    
    if (shouldInvalidate) {
      await this.immediateInvalidation(rule, context, event);
    } else {
      event.affectedKeys = ['dependency_check_passed'];
    }
  }

  /**
   * Pattern-based invalidation strategy
   */
  private async patternBasedInvalidation(
    rule: InvalidationRule, 
    _context: any, 
    event: InvalidationEvent
  ): Promise<void> {
    // Use regex pattern matching for more complex invalidation
    const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'));
    const keys = await enhancedCacheManager.keys('*');
    const matchingKeys = keys.filter((key: string) => regex.test(key));
    
    for (const key of matchingKeys) {
      await enhancedCacheManager.invalidate(key, 'api_response');
    }
    
    event.affectedKeys = matchingKeys;
  }

  /**
   * Check dependencies for dependency-based invalidation
   */
  private async checkDependencies(dependencies: string[], _context: any): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you would check if dependencies have been modified
    // or invalidated recently
    
    for (const dep of dependencies) {
      // Check if dependency exists in cache
      const exists = await enhancedCacheManager.exists(dep, 'user_session');
      if (!exists) {
        return true; // Dependency not found, trigger invalidation
      }
    }
    
    return false;
  }

  /**
   * Get rules matching a pattern
   */
  private getMatchingRules(pattern: string): InvalidationRule[] {
    const matchingRules: InvalidationRule[] = [];
    
    for (const rule of this.rules.values()) {
      if (this.patternMatches(rule.pattern, pattern)) {
        matchingRules.push(rule);
      }
    }
    
    // Sort by priority (higher first)
    return matchingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if pattern matches
   */
  private patternMatches(rulePattern: string, inputPattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = rulePattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(inputPattern);
  }

  /**
   * Queue processor for lazy invalidation
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.invalidationQueue.length === 0) return;
      
      this.isProcessing = true;
      
      try {
        const batch = this.invalidationQueue.splice(0, 10); // Process 10 items at a time
        
        for (const { rule, context } of batch) {
          const event: InvalidationEvent = {
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
          } catch (error) {
            event.error = error instanceof Error ? error.message : 'Unknown error';
            this.stats.failedInvalidations++;
          }

          this.stats.totalInvalidations++;
          this.emit('lazyInvalidationProcessed', { event });
        }
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Process every second
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingTime(processingTime: number): void {
    this.stats.rulesProcessed++;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.rulesProcessed - 1) + processingTime) / 
      this.stats.rulesProcessed;
  }

  /**
   * Get invalidation statistics
   */
  getStats(): typeof this.stats & { 
    successRate: number; 
    queueSize: number; 
    activeRules: number;
  } {
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

  /**
   * Get all rules
   */
  getAllRules(): InvalidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules.clear();
    this.emit('rulesCleared');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; stats: any }> {
    const stats = this.getStats();
    const status = stats.successRate > 90 ? 'healthy' : 'degraded';
    
    return { status, stats };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    try {
      // Process remaining queue items
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
          } catch (error) {
            console.error('Error processing final invalidation:', error);
          }
        }
      }

      console.log('Cache invalidation service shutdown complete');
    } catch (error) {
      console.error('Error during cache invalidation service shutdown:', error);
    }
  }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();
