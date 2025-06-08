/**
 * TimescaleDB Persistence Adapter
 * Handles metric persistence to TimescaleDB on Supabase
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { RealtimeMetricEvent } from '../collectors/base';
import { realtimeConfig } from '../config/realtime-config';

// Metric persistence interface
export interface MetricPersistenceAdapter {
  flush(metrics: RealtimeMetricEvent[]): Promise<void>;
  query(options: QueryOptions): Promise<MetricQueryResult[]>;
  cleanup(olderThan: Date): Promise<number>;
}

// Query options
export interface QueryOptions {
  metricNames?: string[];
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  groupBy?: string[];
  interval?: string; // e.g., '1 hour', '5 minutes'
}

// Query result
export interface MetricQueryResult {
  time: string;
  metric_name: string;
  tags: Record<string, unknown>;
  value: number;
  aggregated_value?: number;
  count?: number;
}

// Batch insert data structure
interface MetricBatch {
  metrics: RealtimeMetricEvent[];
  retryCount: number;
  createdAt: Date;
}

export class TimescaleAdapter implements MetricPersistenceAdapter {
  private pendingBatches: MetricBatch[] = [];
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    // Start background processing
    this.startBackgroundProcessing();
  }

  // Flush metrics to TimescaleDB
  public async flush(metrics: RealtimeMetricEvent[]): Promise<void> {
    if (metrics.length === 0) {
      return;
    }

    // Create batch
    const batch: MetricBatch = {
      metrics: [...metrics],
      retryCount: 0,
      createdAt: new Date(),
    };

    // Add to pending batches
    this.pendingBatches.push(batch);

    // Process immediately if not already processing
    if (!this.isProcessing) {
      await this.processPendingBatches();
    }
  }

  // Query metrics from TimescaleDB
  public async query(options: QueryOptions): Promise<MetricQueryResult[]> {
    try {
      const { supabase } = await import('@constructtrack/supabase/client');

      let query = supabase
        .from('realtime_metrics')
        .select('time, metric_name, tags, value');

      // Apply filters
      if (options.metricNames && options.metricNames.length > 0) {
        query = query.in('metric_name', options.metricNames);
      }

      if (options.startTime) {
        query = query.gte('time', options.startTime.toISOString());
      }

      if (options.endTime) {
        query = query.lte('time', options.endTime.toISOString());
      }

      if (options.tags) {
        for (const [key, value] of Object.entries(options.tags)) {
          query = query.contains('tags', { [key]: value });
        }
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Order by time
      query = query.order('time', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Query failed: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to query metrics:', error);
      throw error;
    }
  }

  // Cleanup old metrics
  public async cleanup(olderThan: Date): Promise<number> {
    try {
      const { supabase } = await import('@constructtrack/supabase/client');

      const { count, error } = await supabase
        .from('realtime_metrics')
        .delete()
        .lt('time', olderThan.toISOString());

      if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to cleanup metrics:', error);
      throw error;
    }
  }

  // Start background processing
  private startBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process batches every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processPendingBatches().catch(error => {
        // eslint-disable-next-line no-console
        console.error('Background processing failed:', error);
      });
    }, 30000);
  }

  // Stop background processing
  public stopBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  // Process pending batches
  private async processPendingBatches(): Promise<void> {
    if (this.isProcessing || this.pendingBatches.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batchesToProcess = this.pendingBatches.splice(0, 10); // Process up to 10 batches at once

      for (const batch of batchesToProcess) {
        try {
          await this.processBatch(batch);
        } catch (error) {
          await this.handleBatchError(batch, error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single batch
  private async processBatch(batch: MetricBatch): Promise<void> {
    const { metrics } = batch;
    const batchSize = realtimeConfig.storage.batchSize;

    // Split into smaller chunks if needed
    for (let i = 0; i < metrics.length; i += batchSize) {
      const chunk = metrics.slice(i, i + batchSize);
      await this.insertMetrics(chunk);
    }
  }

  // Insert metrics into TimescaleDB
  private async insertMetrics(metrics: RealtimeMetricEvent[]): Promise<void> {
    try {
      const { supabase } = await import('@constructtrack/supabase/client');

      // Transform metrics to database format
      const rows = metrics.map(metric => ({
        time: metric.timestamp,
        metric_name: metric.name,
        tags: metric.tags,
        value: metric.value,
      }));

      const { error } = await supabase.from('realtime_metrics').insert(rows);

      if (error) {
        throw new Error(`Insert failed: ${error.message}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to insert metrics:', error);
      throw error;
    }
  }

  // Handle batch processing errors
  private async handleBatchError(
    batch: MetricBatch,
    error: unknown
  ): Promise<void> {
    const maxRetries = realtimeConfig.storage.maxRetries;

    if (batch.retryCount < maxRetries) {
      // Retry the batch
      batch.retryCount++;
      this.pendingBatches.push(batch);

      // eslint-disable-next-line no-console
      console.warn(
        `Batch processing failed, retrying (${batch.retryCount}/${maxRetries}):`,
        error
      );
    } else {
      // Max retries reached, log and discard
      // eslint-disable-next-line no-console
      console.error(
        `Batch processing failed after ${maxRetries} retries, discarding:`,
        error
      );
    }
  }

  // Get adapter statistics
  public getStats(): {
    pendingBatches: number;
    totalPendingMetrics: number;
    isProcessing: boolean;
    oldestBatchAge?: number;
  } {
    const totalPendingMetrics = this.pendingBatches.reduce(
      (sum, batch) => sum + batch.metrics.length,
      0
    );

    const oldestBatch = this.pendingBatches[0];
    const oldestBatchAge = oldestBatch
      ? Date.now() - oldestBatch.createdAt.getTime()
      : undefined;

    return {
      pendingBatches: this.pendingBatches.length,
      totalPendingMetrics,
      isProcessing: this.isProcessing,
      oldestBatchAge,
    };
  }

  // Force flush all pending batches
  public async forceFlush(): Promise<void> {
    await this.processPendingBatches();
  }

  // Cleanup and shutdown
  public async shutdown(): Promise<void> {
    this.stopBackgroundProcessing();
    await this.forceFlush();
  }
}

// In-memory adapter for testing/development
export class InMemoryAdapter implements MetricPersistenceAdapter {
  private metrics: RealtimeMetricEvent[] = [];
  private maxSize = 10000;

  public async flush(metrics: RealtimeMetricEvent[]): Promise<void> {
    this.metrics.push(...metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  public async query(options: QueryOptions): Promise<MetricQueryResult[]> {
    let filtered = [...this.metrics];

    // Apply filters
    if (options.metricNames && options.metricNames.length > 0) {
      filtered = filtered.filter(m => options.metricNames?.includes(m.name));
    }

    if (options.startTime) {
      filtered = filtered.filter(
        m => new Date(m.timestamp) >= options.startTime
      );
    }

    if (options.endTime) {
      filtered = filtered.filter(m => new Date(m.timestamp) <= options.endTime);
    }

    if (options.tags) {
      filtered = filtered.filter(m => {
        return Object.entries(options.tags || {}).every(
          ([key, value]) => m.tags[key] === value
        );
      });
    }

    // Sort by time (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    // Transform to query result format
    return filtered.map(metric => ({
      time: metric.timestamp,
      metric_name: metric.name,
      tags: metric.tags,
      value: metric.value,
    }));
  }

  public async cleanup(olderThan: Date): Promise<number> {
    const initialLength = this.metrics.length;
    this.metrics = this.metrics.filter(m => new Date(m.timestamp) >= olderThan);
    return initialLength - this.metrics.length;
  }

  public getMetrics(): RealtimeMetricEvent[] {
    return [...this.metrics];
  }

  public clear(): void {
    this.metrics = [];
  }
}

// Factory function to create appropriate adapter
export function createPersistenceAdapter(): MetricPersistenceAdapter {
  const storageType = realtimeConfig.storage.type;

  switch (storageType) {
    case 'supabase':
      return new TimescaleAdapter();
    case 'inmemory':
      return new InMemoryAdapter();
    case 'custom':
      // Could be extended to support custom adapters
      throw new Error('Custom persistence adapter not implemented');
    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}

// Global adapter instance
export const persistenceAdapter = createPersistenceAdapter();
