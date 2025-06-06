/**
 * Aggregate Metric Collector
 *
 * Collects and aggregates metrics over time periods (hourly, daily, weekly)
 * for trend analysis, capacity planning, and dashboard visualization.
 */

import {
  BaseMetricCollector,
  CollectorConfig,
  AggregateMetric,
  CollectorMetric,
} from './base-collector';

// Aggregate collector specific configuration
export interface AggregateCollectorConfig extends CollectorConfig {
  aggregationTypes: {
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
  };
  sourceMetrics: {
    latency: boolean;
    throughput: boolean;
    errors: boolean;
    connections: boolean;
    resources: boolean;
  };
  retentionPeriods: {
    hourly: number; // Hours to keep hourly aggregates
    daily: number; // Days to keep daily aggregates
    weekly: number; // Weeks to keep weekly aggregates
  };
  storage: {
    enabled: boolean;
    batchSize: number;
  };
}

// Time period definitions
export type TimePeriod = 'hourly' | 'daily' | 'weekly';

// Aggregation window
interface AggregationWindow {
  type: TimePeriod;
  start: number;
  end: number;
  metrics: number[];
}

// Statistical calculations
interface Statistics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export class AggregateCollector extends BaseMetricCollector {
  private aggregateConfig: AggregateCollectorConfig;
  private metricBuffer = new Map<string, number[]>(); // Buffer for raw metrics
  private lastAggregation = new Map<TimePeriod, number>(); // Last aggregation timestamps

  constructor(config: AggregateCollectorConfig) {
    super('aggregate-collector', 'Time-Series Aggregate Collector', config);
    this.aggregateConfig = config;
    this.initializeLastAggregationTimes();
  }

  async collect(): Promise<AggregateMetric[]> {
    const metrics: AggregateMetric[] = [];
    const now = Date.now();

    try {
      // Process hourly aggregations
      if (this.aggregateConfig.aggregationTypes.hourly) {
        const hourlyMetrics = await this.processAggregation('hourly', now);
        metrics.push(...hourlyMetrics);
      }

      // Process daily aggregations
      if (this.aggregateConfig.aggregationTypes.daily) {
        const dailyMetrics = await this.processAggregation('daily', now);
        metrics.push(...dailyMetrics);
      }

      // Process weekly aggregations
      if (this.aggregateConfig.aggregationTypes.weekly) {
        const weeklyMetrics = await this.processAggregation('weekly', now);
        metrics.push(...weeklyMetrics);
      }

      // Clean up old metrics from buffer
      this.cleanupMetricBuffer();
    } catch (error) {
      throw new Error(
        `Aggregation collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.interval < 60000) {
      errors.push(
        'Aggregate collection interval must be at least 60000ms (1 minute)'
      );
    }

    if (
      !this.aggregateConfig.aggregationTypes.hourly &&
      !this.aggregateConfig.aggregationTypes.daily &&
      !this.aggregateConfig.aggregationTypes.weekly
    ) {
      errors.push('At least one aggregation type must be enabled');
    }

    if (
      !this.aggregateConfig.sourceMetrics.latency &&
      !this.aggregateConfig.sourceMetrics.throughput &&
      !this.aggregateConfig.sourceMetrics.errors &&
      !this.aggregateConfig.sourceMetrics.connections &&
      !this.aggregateConfig.sourceMetrics.resources
    ) {
      errors.push('At least one source metric type must be enabled');
    }

    // Validate retention periods
    if (this.aggregateConfig.retentionPeriods.hourly < 1) {
      errors.push('Hourly retention period must be at least 1 hour');
    }
    if (this.aggregateConfig.retentionPeriods.daily < 1) {
      errors.push('Daily retention period must be at least 1 day');
    }
    if (this.aggregateConfig.retentionPeriods.weekly < 1) {
      errors.push('Weekly retention period must be at least 1 week');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Add metrics to the buffer for aggregation
  addMetricsToBuffer(metrics: CollectorMetric[]): void {
    for (const metric of metrics) {
      if (this.shouldIncludeMetric(metric)) {
        const key = this.getMetricKey(metric);
        const value = this.extractMetricValue(metric);

        if (value !== null) {
          if (!this.metricBuffer.has(key)) {
            this.metricBuffer.set(key, []);
          }
          const buffer = this.metricBuffer.get(key);
          if (buffer) {
            buffer.push(value);
          }
        }
      }
    }
  }

  private initializeLastAggregationTimes(): void {
    const now = Date.now();
    this.lastAggregation.set('hourly', this.getHourStart(now));
    this.lastAggregation.set('daily', this.getDayStart(now));
    this.lastAggregation.set('weekly', this.getWeekStart(now));
  }

  private async processAggregation(
    type: TimePeriod,
    now: number
  ): Promise<AggregateMetric[]> {
    const metrics: AggregateMetric[] = [];
    const lastAggregation = this.lastAggregation.get(type) || 0;
    const windowStart = this.getWindowStart(type, now);

    // Check if it's time for a new aggregation
    if (windowStart <= lastAggregation) {
      return metrics;
    }

    const windowEnd = this.getWindowEnd(type, windowStart);
    const window: AggregationWindow = {
      type,
      start: windowStart,
      end: windowEnd,
      metrics: [],
    };

    // Process each metric type
    for (const [metricKey, values] of this.metricBuffer.entries()) {
      if (values.length === 0) continue;

      const filteredValues = this.filterValuesByTimeWindow(values);
      if (filteredValues.length === 0) continue;

      const stats = this.calculateStatistics(filteredValues);
      const sourceMetricIds = this.getSourceMetricIds(metricKey, window);

      const aggregateMetric: AggregateMetric = {
        ...this.createBaseMetric('aggregate', {
          aggregationType: type,
          metricType: this.getMetricTypeFromKey(metricKey),
        }),
        type: 'aggregate',
        aggregationType: type,
        period: {
          start: windowStart,
          end: windowEnd,
        },
        metrics: {
          count: stats.count,
          sum: stats.sum,
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
          p50: stats.p50,
          p90: stats.p90,
          p95: stats.p95,
          p99: stats.p99,
        },
        sourceMetrics: sourceMetricIds,
        metadata: {
          metricKey,
          windowDurationMs: windowEnd - windowStart,
          standardDeviation: stats.stdDev,
        },
      };

      metrics.push(aggregateMetric);
    }

    // Update last aggregation time
    this.lastAggregation.set(type, windowStart);

    return metrics;
  }

  private shouldIncludeMetric(metric: CollectorMetric): boolean {
    // Check if this metric type should be included in aggregation
    switch (metric.type) {
      case 'resource':
        return this.aggregateConfig.sourceMetrics.resources;
      default:
        return false;
    }
  }

  private getMetricKey(metric: CollectorMetric): string {
    // Create a unique key for grouping similar metrics
    const tags = Object.entries(metric.tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `${metric.type}:${metric.source}:${tags}`;
  }

  private extractMetricValue(metric: CollectorMetric): number | null {
    // Extract numeric value from different metric types
    switch (metric.type) {
      case 'resource':
        return metric.value;
      default:
        return null;
    }
  }

  private getMetricTypeFromKey(key: string): string {
    return key.split(':')[0];
  }

  private filterValuesByTimeWindow(values: number[]): number[] {
    // For now, return all values since we don't have timestamps per value
    // In a more sophisticated implementation, you'd filter by timestamp
    return values;
  }

  private getSourceMetricIds(
    metricKey: string,
    window: AggregationWindow
  ): string[] {
    // Generate source metric IDs for traceability
    // In a real implementation, you'd track actual metric IDs
    return [`${metricKey}_${window.start}_${window.end}`];
  }

  private calculateStatistics(values: number[]): Statistics {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    // Calculate percentiles
    const p50 = this.percentile(sorted, 0.5);
    const p90 = this.percentile(sorted, 0.9);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    // Calculate standard deviation
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      sum,
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50,
      p90,
      p95,
      p99,
      stdDev,
    };
  }

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private getWindowStart(type: TimePeriod, timestamp: number): number {
    switch (type) {
      case 'hourly':
        return this.getHourStart(timestamp);
      case 'daily':
        return this.getDayStart(timestamp);
      case 'weekly':
        return this.getWeekStart(timestamp);
    }
  }

  private getWindowEnd(type: TimePeriod, windowStart: number): number {
    switch (type) {
      case 'hourly':
        return windowStart + 60 * 60 * 1000; // 1 hour
      case 'daily':
        return windowStart + 24 * 60 * 60 * 1000; // 1 day
      case 'weekly':
        return windowStart + 7 * 24 * 60 * 60 * 1000; // 1 week
    }
  }

  private getHourStart(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0);
    return date.getTime();
  }

  private getDayStart(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private getWeekStart(timestamp: number): number {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private cleanupMetricBuffer(): void {
    // In a real implementation, you'd track timestamps per metric value
    // For now, we'll just limit buffer size
    for (const [key, values] of this.metricBuffer.entries()) {
      if (values.length > 1000) {
        // Keep last 1000 values
        this.metricBuffer.set(key, values.slice(-1000));
      }
    }
  }
}

// Default aggregate collector configuration
export const defaultAggregateCollectorConfig: AggregateCollectorConfig = {
  enabled: true,
  interval: 300000, // 5 minutes
  batchSize: 50,
  retryAttempts: 3,
  retryDelay: 2000,
  aggregationTypes: {
    hourly: true,
    daily: true,
    weekly: false, // Disabled by default
  },
  sourceMetrics: {
    latency: true,
    throughput: true,
    errors: true,
    connections: true,
    resources: true,
  },
  retentionPeriods: {
    hourly: 168, // 7 days
    daily: 90, // 90 days
    weekly: 52, // 52 weeks
  },
  storage: {
    enabled: true,
    batchSize: 100,
  },
  tags: {
    component: 'aggregate-monitoring',
  },
};
