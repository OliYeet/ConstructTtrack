/**
 * Real-time Performance Profiler
 *
 * Provides detailed performance analysis for WebSocket Gateway operations
 * Tracks bottlenecks, latency patterns, and resource usage
 *
 * Part of LUM-584 Performance Optimization Phase 1
 */

import { logger } from '../utils/logger';

export interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface BottleneckAnalysis {
  operation: string;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceUsage {
  timestamp: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  connectionCount: number;
  messageRate: number;
}

export class PerformanceProfiler {
  private metrics: PerformanceMetric[] = [];
  private resourceSnapshots: ResourceUsage[] = [];
  private isProfilering = false;
  private profilingInterval: ReturnType<typeof globalThis.setInterval> | null =
    null;
  private readonly maxMetrics = 10000; // Keep last 10k metrics
  private readonly maxSnapshots = 1000; // Keep last 1k resource snapshots

  constructor(
    private readonly config = {
      enabled: true,
      profilingInterval: 5000, // 5 seconds
      metricRetentionMs: 300000, // 5 minutes
      bottleneckThreshold: 100, // ms
    }
  ) {}

  /**
   * Start performance profiling
   */
  start(): void {
    if (!this.config.enabled || this.isProfilering) {
      return;
    }

    this.isProfilering = true;

    // Start resource monitoring
    this.profilingInterval = globalThis.setInterval(() => {
      this.captureResourceSnapshot();
    }, this.config.profilingInterval);

    logger.info('Performance profiler started', {
      interval: this.config.profilingInterval,
      retention: this.config.metricRetentionMs,
    });
  }

  /**
   * Stop performance profiling
   */
  stop(): void {
    if (!this.isProfilering) {
      return;
    }

    this.isProfilering = false;

    if (this.profilingInterval) {
      globalThis.clearInterval(this.profilingInterval);
      this.profilingInterval = null;
    }

    logger.info('Performance profiler stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operation,
      duration,
      metadata,
    };

    this.metrics.push(metric);
    this.cleanup();

    // Log slow operations
    if (duration > this.config.bottleneckThreshold) {
      logger.warn('Slow operation detected', {
        operation,
        duration,
        metadata,
      });
    }
  }

  /**
   * Time an operation and record the metric
   */
  timeOperation<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    const start = globalThis.performance.now();
    try {
      const result = fn();
      const duration = globalThis.performance.now() - start;
      this.recordMetric(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = globalThis.performance.now() - start;
      this.recordMetric(operation, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Time an async operation and record the metric
   */
  async timeAsyncOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = globalThis.performance.now();
    try {
      const result = await fn();
      const duration = globalThis.performance.now() - start;
      this.recordMetric(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = globalThis.performance.now() - start;
      this.recordMetric(operation, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < 60000 // Last minute
    );

    return {
      totalMetrics: this.metrics.length,
      recentMetrics: recentMetrics.length,
      averageLatency:
        recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
            recentMetrics.length
          : 0,
    };
  }

  /**
   * Capture current resource usage snapshot
   */
  private captureResourceSnapshot(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const snapshot: ResourceUsage = {
      timestamp: Date.now(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      connectionCount: 0, // Will be updated by gateway
      messageRate: 0, // Will be calculated from recent metrics
    };

    this.resourceSnapshots.push(snapshot);

    // Cleanup old snapshots
    if (this.resourceSnapshots.length > this.maxSnapshots) {
      this.resourceSnapshots = this.resourceSnapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Cleanup old metrics
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.metricRetentionMs;

    // Remove old metrics
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoff);

    // Ensure we don't exceed max metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
}

// Global profiler instance
export const performanceProfiler = new PerformanceProfiler();
