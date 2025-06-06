/**
 * Base Metric Collector Interface
 *
 * Defines the standard interface for all metric collectors in the enhanced
 * real-time monitoring system. Provides pluggable architecture for different
 * types of metric collection (resource, aggregate, export, etc.).
 */

import { EventEmitter } from 'events';

// Base metric interface
export interface BaseMetric {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  tags: Record<string, string>;
  metadata?: Record<string, unknown>;
}

// Resource metrics (CPU, memory, disk, network)
export interface ResourceMetric extends BaseMetric {
  type: 'resource';
  resourceType: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  unit: string;
  details: {
    usage?: number; // Percentage usage
    total?: number; // Total available
    used?: number; // Currently used
    free?: number; // Currently free
    processes?: Array<{
      pid: number;
      name: string;
      usage: number;
    }>;
  };
}

// Aggregate metrics (hourly, daily, weekly rollups)
export interface AggregateMetric extends BaseMetric {
  type: 'aggregate';
  aggregationType: 'hourly' | 'daily' | 'weekly';
  period: {
    start: number;
    end: number;
  };
  metrics: {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  sourceMetrics: string[]; // IDs of source metrics
}

// Export metrics (for Prometheus, OpenTelemetry, etc.)
export interface ExportMetric extends BaseMetric {
  type: 'export';
  exportFormat: 'prometheus' | 'opentelemetry' | 'json';
  destination: string;
  payload: string | object;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

// Health metrics (system health indicators)
export interface HealthMetric extends BaseMetric {
  type: 'health';
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100 health score
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    duration?: number;
  }>;
}

// Union type for all metric types
export type CollectorMetric =
  | ResourceMetric
  | AggregateMetric
  | ExportMetric
  | HealthMetric;

// Collector configuration interface
export interface CollectorConfig {
  enabled: boolean;
  interval: number; // Collection interval in milliseconds
  batchSize?: number; // Number of metrics to batch
  retryAttempts?: number; // Number of retry attempts on failure
  retryDelay?: number; // Delay between retries in milliseconds
  tags?: Record<string, string>; // Default tags for all metrics
  metadata?: Record<string, unknown>; // Default metadata
}

// Collector status
export interface CollectorStatus {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  lastCollection: number | null;
  nextCollection: number | null;
  metricsCollected: number;
  errors: number;
  lastError?: {
    timestamp: number;
    message: string;
    stack?: string;
  };
}

// Base metric collector abstract class
export abstract class BaseMetricCollector extends EventEmitter {
  protected config: CollectorConfig;
  protected status: CollectorStatus;
  private timer: NodeJS.Timeout | null = null;
  private isCollecting = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    config: CollectorConfig
  ) {
    super();
    this.config = { ...config };
    this.status = {
      id,
      name,
      enabled: config.enabled,
      running: false,
      lastCollection: null,
      nextCollection: null,
      metricsCollected: 0,
      errors: 0,
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract collect(): Promise<CollectorMetric[]>;
  abstract validateConfig(): { valid: boolean; errors: string[] };

  // Start the collector
  start(): void {
    if (this.status.running || !this.config.enabled) {
      return;
    }

    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(
        `Invalid collector configuration: ${validation.errors.join(', ')}`
      );
    }

    this.status.running = true;
    this.scheduleNextCollection();
    this.emit('started', { collector: this.id });
  }

  // Stop the collector
  stop(): void {
    if (!this.status.running) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.status.running = false;
    this.status.nextCollection = null;
    this.emit('stopped', { collector: this.id });
  }

  // Update collector configuration
  updateConfig(updates: Partial<CollectorConfig>): void {
    const wasRunning = this.status.running;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...updates };
    this.status.enabled = this.config.enabled;

    if (wasRunning && this.config.enabled) {
      this.start();
    }

    this.emit('configUpdated', { collector: this.id, config: this.config });
  }

  // Get collector status
  getStatus(): CollectorStatus {
    return { ...this.status };
  }

  // Get collector configuration
  getConfig(): CollectorConfig {
    return { ...this.config };
  }

  // Schedule the next collection
  private scheduleNextCollection(): void {
    if (!this.status.running || this.isCollecting) {
      return;
    }

    const nextTime = Date.now() + this.config.interval;
    this.status.nextCollection = nextTime;

    this.timer = setTimeout(async () => {
      await this.performCollection();
      this.scheduleNextCollection();
    }, this.config.interval);
  }

  // Perform the actual collection with error handling
  private async performCollection(): Promise<void> {
    if (this.isCollecting || !this.status.running) {
      return;
    }

    this.isCollecting = true;
    const startTime = Date.now();

    try {
      const metrics = await this.collect();

      this.status.lastCollection = startTime;
      this.status.metricsCollected += metrics.length;

      // Add default tags and metadata to metrics
      const enrichedMetrics = metrics.map(metric => ({
        ...metric,
        tags: { ...this.config.tags, ...metric.tags },
        metadata: { ...this.config.metadata, ...metric.metadata },
      }));

      this.emit('metrics', { collector: this.id, metrics: enrichedMetrics });
      this.emit('collected', {
        collector: this.id,
        count: metrics.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.status.errors++;
      this.status.lastError = {
        timestamp: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      this.emit('error', {
        collector: this.id,
        error: this.status.lastError,
      });

      // Implement retry logic if configured
      if (this.config.retryAttempts && this.config.retryAttempts > 0) {
        await this.retryCollection();
      }
    } finally {
      this.isCollecting = false;
    }
  }

  // Retry collection logic
  private async retryCollection(): Promise<void> {
    const maxRetries = this.config.retryAttempts || 0;
    const retryDelay = this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));

      try {
        const metrics = await this.collect();

        this.status.metricsCollected += metrics.length;
        this.emit('metrics', { collector: this.id, metrics });
        this.emit('retrySuccess', { collector: this.id, attempt });
        return;
      } catch (error) {
        this.emit('retryFailed', {
          collector: this.id,
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Utility method to create metric ID
  protected createMetricId(): string {
    return `${this.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Utility method to create base metric
  protected createBaseMetric(
    type: string,
    additionalTags: Record<string, string> = {}
  ): BaseMetric {
    return {
      id: this.createMetricId(),
      timestamp: Date.now(),
      type,
      source: this.id,
      tags: {
        collector: this.id,
        ...additionalTags,
      },
    };
  }
}

// Collector registry for managing multiple collectors
export class CollectorRegistry extends EventEmitter {
  private collectors = new Map<string, BaseMetricCollector>();

  // Register a collector
  register(collector: BaseMetricCollector): void {
    if (this.collectors.has(collector.id)) {
      throw new Error(
        `Collector with ID '${collector.id}' is already registered`
      );
    }

    this.collectors.set(collector.id, collector);

    // Forward collector events
    collector.on('metrics', data => this.emit('metrics', data));
    collector.on('error', data => this.emit('error', data));
    collector.on('started', data => this.emit('collectorStarted', data));
    collector.on('stopped', data => this.emit('collectorStopped', data));

    this.emit('collectorRegistered', { collector: collector.id });
  }

  // Unregister a collector
  unregister(collectorId: string): void {
    const collector = this.collectors.get(collectorId);
    if (!collector) {
      return;
    }

    collector.stop();
    collector.removeAllListeners();
    this.collectors.delete(collectorId);

    this.emit('collectorUnregistered', { collector: collectorId });
  }

  // Get a collector by ID
  get(collectorId: string): BaseMetricCollector | undefined {
    return this.collectors.get(collectorId);
  }

  // Get all collectors
  getAll(): BaseMetricCollector[] {
    return Array.from(this.collectors.values());
  }

  // Start all collectors
  startAll(): void {
    for (const collector of this.collectors.values()) {
      if (collector.getConfig().enabled) {
        collector.start();
      }
    }
  }

  // Stop all collectors
  stopAll(): void {
    for (const collector of this.collectors.values()) {
      collector.stop();
    }
  }

  // Get status of all collectors
  getStatus(): CollectorStatus[] {
    return Array.from(this.collectors.values()).map(c => c.getStatus());
  }
}

// Export singleton registry
export const collectorRegistry = new CollectorRegistry();
