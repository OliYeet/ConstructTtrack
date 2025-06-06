/**
 * Metric Persistence Layer
 *
 * Handles long-term storage of metrics to Supabase for historical analysis,
 * trend monitoring, and capacity planning.
 */

import { getLogger } from '../../logging';
import { CollectorMetric } from '../metric-collectors/base-collector';
import { getMonitoringConfig } from '../realtime-config';

// Storage interface for different providers
export interface MetricStorageProvider {
  store(metrics: CollectorMetric[]): Promise<void>;
  retrieve(query: MetricQuery): Promise<CollectorMetric[]>;
  cleanup(retentionPeriod: number): Promise<number>;
}

// Query interface for retrieving metrics
export interface MetricQuery {
  startTime: number;
  endTime: number;
  metricTypes?: string[];
  sources?: string[];
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
}

// Supabase storage provider
export class SupabaseMetricStorage implements MetricStorageProvider {
  private tableName = 'realtime_metrics';

  async store(metrics: CollectorMetric[]): Promise<void> {
    const logger = getLogger();

    try {
      // Transform metrics for storage
      const storageMetrics = metrics.map(metric => ({
        id: metric.id,
        timestamp: new Date(metric.timestamp).toISOString(),
        type: metric.type,
        source: metric.source,
        tags: metric.tags,
        metadata: metric.metadata,
        // Type-specific fields
        value: this.extractValue(metric),
        unit: this.extractUnit(metric),
        resource_type: metric.type === 'resource' ? metric.resourceType : null,
        export_format: metric.type === 'export' ? metric.exportFormat : null,
        aggregation_type:
          metric.type === 'aggregate' ? metric.aggregationType : null,
      }));

      // In a real implementation, you would use Supabase client here
      logger.debug('Storing metrics to Supabase', {
        metadata: { count: storageMetrics.length, table: this.tableName },
      });

      // TODO: Implement actual Supabase storage
      // For now, throw an error to make the issue visible
      throw new Error(
        'Supabase metric storage not yet implemented - metrics will be lost'
      );
    } catch (error) {
      logger.error('Failed to store metrics to Supabase', {
        error: error instanceof Error ? error.message : String(error),
        metricsCount: metrics.length,
      });
      throw error;
    }
  }

  async retrieve(query: MetricQuery): Promise<CollectorMetric[]> {
    const logger = getLogger();

    try {
      logger.debug('Retrieving metrics from Supabase', {
        metadata: { query, table: this.tableName },
      });

      // Placeholder for actual Supabase retrieval
      // const { data, error } = await supabase
      //   .from(this.tableName)
      //   .select('*')
      //   .gte('timestamp', new Date(query.startTime).toISOString())
      //   .lte('timestamp', new Date(query.endTime).toISOString())
      //   .limit(query.limit || 1000);

      logger.warn(
        'Supabase retrieval not implemented - returning empty results'
      );
      throw new Error('Supabase metric retrieval not yet implemented');
    } catch (error) {
      logger.error('Failed to retrieve metrics from Supabase', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  async cleanup(retentionPeriod: number): Promise<number> {
    const logger = getLogger();
    const cutoffTime = new Date(Date.now() - retentionPeriod).toISOString();

    try {
      logger.info('Cleaning up old metrics from Supabase', {
        metadata: { cutoffTime, table: this.tableName },
      });

      // Placeholder for actual Supabase cleanup
      // const { count } = await supabase
      //   .from(this.tableName)
      //   .delete()
      //   .lt('timestamp', cutoffTime);

      throw new Error('Supabase metric cleanup not yet implemented');
    } catch (error) {
      logger.error('Failed to cleanup old metrics from Supabase', {
        error: error instanceof Error ? error.message : String(error),
        cutoffTime,
      });
      throw error;
    }
  }

  private extractValue(metric: CollectorMetric): number {
    switch (metric.type) {
      case 'resource':
        return metric.value;
      case 'aggregate':
        return metric.metrics.avg;
      default:
        return 0;
    }
  }

  private extractUnit(metric: CollectorMetric): string {
    switch (metric.type) {
      case 'resource':
        return metric.unit;
      case 'aggregate':
        return 'avg';
      default:
        return 'count';
    }
  }
}

// In-memory storage provider (for testing/development)
export class MemoryMetricStorage implements MetricStorageProvider {
  private metrics: CollectorMetric[] = [];
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  async store(metrics: CollectorMetric[]): Promise<void> {
    this.metrics.push(...metrics);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  async retrieve(query: MetricQuery): Promise<CollectorMetric[]> {
    return this.metrics
      .filter(metric => {
        // Filter by time range
        if (
          metric.timestamp < query.startTime ||
          metric.timestamp > query.endTime
        ) {
          return false;
        }

        // Filter by metric types
        if (query.metricTypes && !query.metricTypes.includes(metric.type)) {
          return false;
        }

        // Filter by sources
        if (query.sources && !query.sources.includes(metric.source)) {
          return false;
        }

        // Filter by tags
        if (query.tags) {
          const metricTags = metric.tags || {};
          for (const [key, value] of Object.entries(query.tags)) {
            if (metricTags[key] !== value) {
              return false;
            }
          }
        }

        return true;
      })
      .slice(query.offset || 0, (query.offset || 0) + (query.limit || 1000));
  }

  async cleanup(retentionPeriod: number): Promise<number> {
    const cutoffTime = Date.now() - retentionPeriod;
    const initialCount = this.metrics.length;

    this.metrics = this.metrics.filter(
      metric => metric.timestamp >= cutoffTime
    );

    return initialCount - this.metrics.length;
  }

  getStoredCount(): number {
    return this.metrics.length;
  }
}

// Metric persistence manager
export class MetricPersistenceManager {
  private storage: MetricStorageProvider;
  private buffer: CollectorMetric[] = [];
  private config = getMonitoringConfig();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(storage?: MetricStorageProvider) {
    this.storage = storage || this.createStorageProvider();
    this.startPeriodicFlush();
  }

  // Add metrics to the buffer
  addMetrics(metrics: CollectorMetric[]): void {
    if (!this.config.storage.enabled) {
      return;
    }

    this.buffer.push(...metrics);

    // Flush if buffer is full
    if (this.buffer.length >= this.config.storage.batchSize) {
      this.flush();
    }
  }

  // Manually flush the buffer
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToStore = this.buffer.splice(0, this.config.storage.batchSize);

    try {
      await this.storage.store(metricsToStore);
    } catch (error) {
      const logger = getLogger();
      logger.error('Failed to flush metrics to storage', {
        error: error instanceof Error ? error.message : String(error),
        metricsCount: metricsToStore.length,
      });

      // Re-add metrics to buffer for retry (at the beginning)
      this.buffer.unshift(...metricsToStore);
    }
  }

  // Retrieve metrics from storage
  async getMetrics(query: MetricQuery): Promise<CollectorMetric[]> {
    return this.storage.retrieve(query);
  }

  // Cleanup old metrics
  async cleanup(): Promise<number> {
    return this.storage.cleanup(this.config.storage.retentionPeriod);
  }

  // Shutdown the persistence manager
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining metrics
    await this.flush();
  }

  private createStorageProvider(): MetricStorageProvider {
    switch (this.config.storage.provider) {
      case 'supabase':
        return new SupabaseMetricStorage();
      case 'memory':
        return new MemoryMetricStorage();
      default:
        return new MemoryMetricStorage();
    }
  }

  private startPeriodicFlush(): void {
    if (this.config.storage.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.storage.flushInterval);
    }
  }
}

// Export singleton instance
export const metricPersistence = new MetricPersistenceManager();
