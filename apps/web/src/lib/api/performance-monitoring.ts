/**
 * API Performance Monitoring System
 * Comprehensive performance tracking, bottleneck detection, and optimization recommendations
 */

import { NextRequest, NextResponse } from 'next/server';

import { getLogger } from '@/lib/logging';

// Performance metric types
export interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  method: string;
  responseTime: number;
  cpuUsage?: number;
  memoryUsage?: number;
  dbQueryTime?: number;
  dbQueryCount?: number;
  cacheHitRate?: number;
  requestSize: number;
  responseSize: number;
  statusCode: number;
  userId?: string;
  organizationId?: string;
  traceId: string;
}

export interface PerformanceThreshold {
  endpoint: string;
  method?: string;
  responseTimeMs: number;
  cpuUsagePercent?: number;
  memoryUsageMB?: number;
  dbQueryTimeMs?: number;
  severity: 'warning' | 'critical';
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  threshold: PerformanceThreshold;
  actualValue: number;
  severity: 'warning' | 'critical';
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

export interface PerformanceAnalysis {
  endpoint: string;
  method: string;
  metrics: {
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestCount: number;
    errorRate: number;
    throughput: number; // requests per second
  };
  trends: {
    responseTimeTrend: 'improving' | 'degrading' | 'stable';
    throughputTrend: 'increasing' | 'decreasing' | 'stable';
    errorRateTrend: 'improving' | 'degrading' | 'stable';
  };
  bottlenecks: string[];
  recommendations: string[];
}

// Performance data store interface
export interface PerformanceStore {
  recordMetric(metric: PerformanceMetric): Promise<void>;
  getMetrics(filters: PerformanceFilter): Promise<PerformanceMetric[]>;
  getAnalysis(endpoint: string, method?: string): Promise<PerformanceAnalysis>;
  cleanup(olderThan: number): Promise<void>;
}

export interface PerformanceFilter {
  startTime?: number;
  endTime?: number;
  endpoint?: string;
  method?: string;
  minResponseTime?: number;
  maxResponseTime?: number;
  statusCode?: number;
  limit?: number;
}

// In-memory performance store
export class MemoryPerformanceStore implements PerformanceStore {
  private metrics: PerformanceMetric[] = [];
  private maxSize = 50000; // Keep last 50k metrics

  async recordMetric(metric: PerformanceMetric): Promise<void> {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  async getMetrics(filters: PerformanceFilter): Promise<PerformanceMetric[]> {
    let filtered = this.metrics;

    if (filters.startTime) {
      filtered = filtered.filter(m => m.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      filtered = filtered.filter(m => m.timestamp <= filters.endTime!);
    }
    if (filters.endpoint) {
      filtered = filtered.filter(m => m.endpoint === filters.endpoint);
    }
    if (filters.method) {
      filtered = filtered.filter(m => m.method === filters.method);
    }
    if (filters.minResponseTime) {
      filtered = filtered.filter(
        m => m.responseTime >= filters.minResponseTime!
      );
    }
    if (filters.maxResponseTime) {
      filtered = filtered.filter(
        m => m.responseTime <= filters.maxResponseTime!
      );
    }
    if (filters.statusCode) {
      filtered = filtered.filter(m => m.statusCode === filters.statusCode);
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  async getAnalysis(
    endpoint: string,
    method?: string
  ): Promise<PerformanceAnalysis> {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const filters: PerformanceFilter = {
      endpoint,
      startTime: last24Hours,
      endTime: now,
    };

    if (method) {
      filters.method = method;
    }

    const metrics = await this.getMetrics(filters);

    if (metrics.length === 0) {
      return {
        endpoint,
        method: method || 'ALL',
        metrics: {
          averageResponseTime: 0,
          p50ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestCount: 0,
          errorRate: 0,
          throughput: 0,
        },
        trends: {
          responseTimeTrend: 'stable',
          throughputTrend: 'stable',
          errorRateTrend: 'stable',
        },
        bottlenecks: [],
        recommendations: [],
      };
    }

    // Calculate metrics
    const responseTimes = metrics
      .map(m => m.responseTime)
      .sort((a, b) => a - b);
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const durationHours = (now - last24Hours) / (1000 * 60 * 60);

    const analysis: PerformanceAnalysis = {
      endpoint,
      method: method || 'ALL',
      metrics: {
        averageResponseTime:
          responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
        p50ResponseTime: this.percentile(responseTimes, 50),
        p95ResponseTime: this.percentile(responseTimes, 95),
        p99ResponseTime: this.percentile(responseTimes, 99),
        requestCount: metrics.length,
        errorRate: (errorCount / metrics.length) * 100,
        throughput: metrics.length / durationHours,
      },
      trends: this.calculateTrends(metrics),
      bottlenecks: this.identifyBottlenecks(metrics),
      recommendations: this.generateRecommendations(metrics),
    };

    return analysis;
  }

  async cleanup(olderThan: number): Promise<void> {
    this.metrics = this.metrics.filter(m => m.timestamp > olderThan);
  }

  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private calculateTrends(
    metrics: PerformanceMetric[]
  ): PerformanceAnalysis['trends'] {
    if (metrics.length < 10) {
      return {
        responseTimeTrend: 'stable',
        throughputTrend: 'stable',
        errorRateTrend: 'stable',
      };
    }

    // Split metrics into two halves for trend analysis
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const firstHalfAvgResponseTime =
      firstHalf.reduce((sum, m) => sum + m.responseTime, 0) / firstHalf.length;
    const secondHalfAvgResponseTime =
      secondHalf.reduce((sum, m) => sum + m.responseTime, 0) /
      secondHalf.length;

    const firstHalfErrorRate =
      (firstHalf.filter(m => m.statusCode >= 400).length / firstHalf.length) *
      100;
    const secondHalfErrorRate =
      (secondHalf.filter(m => m.statusCode >= 400).length / secondHalf.length) *
      100;

    const responseTimeTrend =
      secondHalfAvgResponseTime > firstHalfAvgResponseTime * 1.1
        ? 'degrading'
        : secondHalfAvgResponseTime < firstHalfAvgResponseTime * 0.9
          ? 'improving'
          : 'stable';

    const errorRateTrend =
      secondHalfErrorRate > firstHalfErrorRate * 1.1
        ? 'degrading'
        : secondHalfErrorRate < firstHalfErrorRate * 0.9
          ? 'improving'
          : 'stable';

    return {
      responseTimeTrend,
      throughputTrend: 'stable', // Simplified for now
      errorRateTrend,
    };
  }

  private identifyBottlenecks(metrics: PerformanceMetric[]): string[] {
    const bottlenecks: string[] = [];

    const avgResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgDbQueryTime =
      metrics
        .filter(m => m.dbQueryTime !== undefined)
        .reduce((sum, m) => sum + (m.dbQueryTime || 0), 0) / metrics.length;

    if (avgResponseTime > 2000) {
      bottlenecks.push('High average response time (>2s)');
    }

    if (avgDbQueryTime > 1000) {
      bottlenecks.push('Slow database queries (>1s average)');
    }

    const highMemoryUsage = metrics.some(m => (m.memoryUsage || 0) > 512);
    if (highMemoryUsage) {
      bottlenecks.push('High memory usage detected');
    }

    const lowCacheHitRate = metrics
      .filter(m => m.cacheHitRate !== undefined)
      .some(m => (m.cacheHitRate || 0) < 50);
    if (lowCacheHitRate) {
      bottlenecks.push('Low cache hit rate (<50%)');
    }

    return bottlenecks;
  }

  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    const avgResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgDbQueryCount =
      metrics
        .filter(m => m.dbQueryCount !== undefined)
        .reduce((sum, m) => sum + (m.dbQueryCount || 0), 0) / metrics.length;

    if (avgResponseTime > 1000) {
      recommendations.push(
        'Consider implementing caching for frequently accessed data'
      );
      recommendations.push('Optimize database queries and add proper indexing');
    }

    if (avgDbQueryCount > 10) {
      recommendations.push('Reduce N+1 query problems by using eager loading');
      recommendations.push('Consider database query batching');
    }

    const errorRate =
      (metrics.filter(m => m.statusCode >= 400).length / metrics.length) * 100;
    if (errorRate > 5) {
      recommendations.push('Investigate and fix high error rate');
      recommendations.push('Implement better error handling and validation');
    }

    const largeBodies = metrics.some(m => m.responseSize > 1024 * 1024); // 1MB
    if (largeBodies) {
      recommendations.push('Consider response compression for large payloads');
      recommendations.push('Implement pagination for large data sets');
    }

    return recommendations;
  }
}

// Performance monitoring middleware
export class PerformanceMonitor {
  private store: PerformanceStore;
  private thresholds: PerformanceThreshold[];
  private alerts: PerformanceAlert[];
  private logger: any;

  constructor(
    store: PerformanceStore,
    thresholds: PerformanceThreshold[] = []
  ) {
    this.store = store;
    this.thresholds = thresholds;
    this.alerts = [];
    this.logger = getLogger();
  }

  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold);
  }

  createMiddleware() {
    return async (
      request: NextRequest,
      handler: () => Promise<NextResponse>
    ): Promise<NextResponse> => {
      const startTime = Date.now();
      const traceId = this.generateTraceId();

      // Add trace ID to request context
      (request as any).traceId = traceId;

      let response: NextResponse;
      // let error: string | undefined;

      try {
        response = await handler();
      } catch {
        // error = err instanceof Error ? err.message : 'Unknown error';
        response = NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const metric: PerformanceMetric = {
        timestamp: startTime,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        responseTime,
        requestSize: this.getRequestSize(request),
        responseSize: this.getResponseSize(response),
        statusCode: response.status,
        userId: (request as any).userId,
        organizationId: (request as any).organizationId,
        traceId,
      };

      // Record metric asynchronously
      this.store.recordMetric(metric).catch(err => {
        this.logger.error('Failed to record performance metric', {
          error: err.message,
        });
      });

      // Check thresholds and generate alerts
      this.checkThresholds(metric).catch(err => {
        this.logger.error('Failed to check performance thresholds', {
          error: err.message,
        });
      });

      // Add performance headers
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Trace-ID', traceId);

      return response;
    };
  }

  private async checkThresholds(metric: PerformanceMetric): Promise<void> {
    for (const threshold of this.thresholds) {
      if (threshold.endpoint !== metric.endpoint) continue;
      if (threshold.method && threshold.method !== metric.method) continue;

      let violated = false;
      let actualValue = 0;
      let message = '';

      if (metric.responseTime > threshold.responseTimeMs) {
        violated = true;
        actualValue = metric.responseTime;
        message = `Response time ${metric.responseTime}ms exceeded threshold ${threshold.responseTimeMs}ms`;
      }

      if (violated) {
        const alert: PerformanceAlert = {
          id: `${threshold.endpoint}-${metric.method}-${Date.now()}`,
          timestamp: metric.timestamp,
          endpoint: metric.endpoint,
          method: metric.method,
          threshold,
          actualValue,
          severity: threshold.severity,
          message,
          resolved: false,
        };

        this.alerts.push(alert);

        this.logger.warn('Performance threshold violated', {
          alertId: alert.id,
          endpoint: alert.endpoint,
          method: alert.method,
          severity: alert.severity,
          message: alert.message,
        });
      }
    }
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.logger.info('Performance alert resolved', { alertId });
    }
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRequestSize(request: NextRequest): number {
    const contentLength = request.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  private getResponseSize(response: NextResponse): number {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    return 0;
  }
}

// Global instances
export const performanceStore = new MemoryPerformanceStore();
export const performanceMonitor = new PerformanceMonitor(performanceStore);

// Default performance thresholds
export const defaultPerformanceThresholds: PerformanceThreshold[] = [
  {
    endpoint: '/api/v1/projects',
    responseTimeMs: 2000,
    severity: 'warning',
  },
  {
    endpoint: '/api/v1/projects',
    responseTimeMs: 5000,
    severity: 'critical',
  },
  {
    endpoint: '/api/v1/tasks',
    responseTimeMs: 1500,
    severity: 'warning',
  },
  {
    endpoint: '/api/v2/graphql',
    responseTimeMs: 3000,
    severity: 'warning',
  },
];

// Initialize default thresholds
defaultPerformanceThresholds.forEach(threshold =>
  performanceMonitor.addThreshold(threshold)
);
