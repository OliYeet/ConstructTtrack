/**
 * API Monitoring and Metrics System
 * Comprehensive monitoring, metrics collection, and alerting for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

import { getLogger } from '@/lib/logging';

// Metrics types
export interface ApiMetric {
  timestamp: number;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userId?: string;
  organizationId?: string;
  userAgent?: string;
  ip?: string;
  error?: string;
}

export interface MetricsSummary {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  statusCodeDistribution: Record<string, number>;
  endpointStats: Record<
    string,
    {
      count: number;
      averageResponseTime: number;
      errorCount: number;
    }
  >;
  timeRange: {
    start: number;
    end: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: 'response_time' | 'error_rate' | 'request_count' | 'status_code';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  timeWindow: number; // minutes
  enabled: boolean;
  endpoints?: string[];
  notificationChannels: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

// Metrics storage interface
export interface MetricsStore {
  recordMetric(metric: ApiMetric): Promise<void>;
  getMetrics(filters: MetricsFilter): Promise<ApiMetric[]>;
  getSummary(filters: MetricsFilter): Promise<MetricsSummary>;
  cleanup(olderThan: number): Promise<void>;
}

export interface MetricsFilter {
  startTime?: number;
  endTime?: number;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  organizationId?: string;
  limit?: number;
}

// In-memory metrics store (for development/testing)
export class MemoryMetricsStore implements MetricsStore {
  private metrics: ApiMetric[] = [];
  private maxSize = 10000; // Keep last 10k metrics

  async recordMetric(metric: ApiMetric): Promise<void> {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  async getMetrics(filters: MetricsFilter): Promise<ApiMetric[]> {
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
    if (filters.statusCode) {
      filtered = filtered.filter(m => m.statusCode === filters.statusCode);
    }
    if (filters.userId) {
      filtered = filtered.filter(m => m.userId === filters.userId);
    }
    if (filters.organizationId) {
      filtered = filtered.filter(
        m => m.organizationId === filters.organizationId
      );
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  async getSummary(filters: MetricsFilter): Promise<MetricsSummary> {
    const metrics = await this.getMetrics(filters);

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        statusCodeDistribution: {},
        endpointStats: {},
        timeRange: { start: 0, end: 0 },
      };
    }

    const totalRequests = metrics.length;
    const averageResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;

    const timeRange = {
      start: Math.min(...metrics.map(m => m.timestamp)),
      end: Math.max(...metrics.map(m => m.timestamp)),
    };
    const durationMinutes = (timeRange.end - timeRange.start) / (1000 * 60);
    const requestsPerMinute =
      durationMinutes > 0 ? totalRequests / durationMinutes : 0;

    // Status code distribution
    const statusCodeDistribution: Record<string, number> = {};
    metrics.forEach(m => {
      const code = m.statusCode.toString();
      statusCodeDistribution[code] = (statusCodeDistribution[code] || 0) + 1;
    });

    // Endpoint statistics
    const endpointStats: Record<string, any> = {};
    metrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { count: 0, totalResponseTime: 0, errorCount: 0 };
      }
      endpointStats[key].count++;
      endpointStats[key].totalResponseTime += m.responseTime;
      if (m.statusCode >= 400) {
        endpointStats[key].errorCount++;
      }
    });

    // Calculate averages
    Object.keys(endpointStats).forEach(key => {
      const stats = endpointStats[key];
      stats.averageResponseTime = stats.totalResponseTime / stats.count;
      delete stats.totalResponseTime;
    });

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      requestsPerMinute,
      statusCodeDistribution,
      endpointStats,
      timeRange,
    };
  }

  async cleanup(olderThan: number): Promise<void> {
    this.metrics = this.metrics.filter(m => m.timestamp > olderThan);
  }
}

// Alert manager
export class AlertManager {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private logger: any;

  constructor() {
    this.logger = getLogger();
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    this.logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.logger.info('Alert rule removed', { ruleId });
  }

  async checkAlerts(metricsStore: MetricsStore): Promise<Alert[]> {
    const newAlerts: Alert[] = [];
    const now = Date.now();

    for (const rule of this.rules.filter(r => r.enabled)) {
      try {
        const shouldAlert = await this.evaluateRule(rule, metricsStore, now);

        if (shouldAlert) {
          const alert: Alert = {
            id: `${rule.id}-${now}`,
            ruleId: rule.id,
            ruleName: rule.name,
            message: this.generateAlertMessage(rule, shouldAlert),
            severity: this.determineSeverity(rule, shouldAlert),
            timestamp: now,
            resolved: false,
            metadata: shouldAlert,
          };

          newAlerts.push(alert);
          this.alerts.push(alert);

          this.logger.warn('Alert triggered', {
            alertId: alert.id,
            ruleName: rule.name,
            severity: alert.severity,
            message: alert.message,
          });
        }
      } catch (error) {
        this.logger.error('Error evaluating alert rule', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return newAlerts;
  }

  private async evaluateRule(
    rule: AlertRule,
    metricsStore: MetricsStore,
    now: number
  ): Promise<any> {
    const timeWindowMs = rule.timeWindow * 60 * 1000;
    const startTime = now - timeWindowMs;

    const filters: MetricsFilter = {
      startTime,
      endTime: now,
    };

    if (rule.endpoints && rule.endpoints.length > 0) {
      // For simplicity, check first endpoint (could be enhanced to check all)
      filters.endpoint = rule.endpoints[0];
    }

    const metrics = await metricsStore.getMetrics(filters);

    if (metrics.length === 0) return false;

    switch (rule.condition) {
      case 'response_time': {
        const avgResponseTime =
          metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
        return this.compareValue(avgResponseTime, rule.threshold, rule.operator)
          ? { value: avgResponseTime, threshold: rule.threshold }
          : false;
      }

      case 'error_rate': {
        const errorCount = metrics.filter(m => m.statusCode >= 400).length;
        const errorRate = (errorCount / metrics.length) * 100;
        return this.compareValue(errorRate, rule.threshold, rule.operator)
          ? { value: errorRate, threshold: rule.threshold }
          : false;
      }

      case 'request_count': {
        const requestCount = metrics.length;
        return this.compareValue(requestCount, rule.threshold, rule.operator)
          ? { value: requestCount, threshold: rule.threshold }
          : false;
      }

      case 'status_code': {
        const statusCodeCount = metrics.filter(
          m => m.statusCode === rule.threshold
        ).length;
        return statusCodeCount > 0
          ? { value: statusCodeCount, statusCode: rule.threshold }
          : false;
      }

      default:
        return false;
    }
  }

  private compareValue(
    value: number,
    threshold: number,
    operator: string
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private generateAlertMessage(rule: AlertRule, data: any): string {
    switch (rule.condition) {
      case 'response_time':
        return `Average response time (${data.value.toFixed(2)}ms) exceeded threshold (${data.threshold}ms)`;
      case 'error_rate':
        return `Error rate (${data.value.toFixed(2)}%) exceeded threshold (${data.threshold}%)`;
      case 'request_count':
        return `Request count (${data.value}) exceeded threshold (${data.threshold})`;
      case 'status_code':
        return `Status code ${data.statusCode} occurred ${data.value} times`;
      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  private determineSeverity(rule: AlertRule, data: any): Alert['severity'] {
    // Simple severity determination based on how much threshold is exceeded
    const ratio = data.value / data.threshold;

    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.logger.info('Alert resolved', { alertId });
    }
  }
}

// Metrics collector middleware
export class MetricsCollector {
  private store: MetricsStore;
  private alertManager: AlertManager;
  private logger: any;

  constructor(store: MetricsStore, alertManager: AlertManager) {
    this.store = store;
    this.alertManager = alertManager;
    this.logger = getLogger();
  }

  createMiddleware() {
    return async (
      request: NextRequest,
      handler: () => Promise<NextResponse>
    ): Promise<NextResponse> => {
      const startTime = Date.now();
      const requestSize = this.getRequestSize(request);

      let response: NextResponse;
      let error: string | undefined;

      try {
        response = await handler();
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
        response = NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const responseSize = this.getResponseSize(response);

      const metric: ApiMetric = {
        timestamp: startTime,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode: response.status,
        responseTime,
        requestSize,
        responseSize,
        userId: (request as any).userId,
        organizationId: (request as any).organizationId,
        userAgent: request.headers.get('user-agent') || undefined,
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        error,
      };

      // Record metric asynchronously
      this.store.recordMetric(metric).catch(err => {
        this.logger.error('Failed to record metric', { error: err.message });
      });

      // Check alerts periodically (every 100 requests to avoid overhead)
      if (Math.random() < 0.01) {
        this.alertManager.checkAlerts(this.store).catch(err => {
          this.logger.error('Failed to check alerts', { error: err.message });
        });
      }

      return response;
    };
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

    // If no content-length header, return 0 as we can't reliably measure
    // without consuming the response body
    return 0;
  }
}

// Global instances
export const metricsStore = new MemoryMetricsStore();
export const alertManager = new AlertManager();
export const metricsCollector = new MetricsCollector(
  metricsStore,
  alertManager
);

// Default alert rules
export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-response-time',
    name: 'High Response Time',
    condition: 'response_time',
    threshold: 5000, // 5 seconds
    operator: 'gt',
    timeWindow: 5,
    enabled: true,
    notificationChannels: ['email', 'slack'],
  },
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    condition: 'error_rate',
    threshold: 10, // 10%
    operator: 'gt',
    timeWindow: 5,
    enabled: true,
    notificationChannels: ['email', 'slack'],
  },
  {
    id: 'too-many-requests',
    name: 'Too Many Requests',
    condition: 'request_count',
    threshold: 1000,
    operator: 'gt',
    timeWindow: 1,
    enabled: true,
    notificationChannels: ['slack'],
  },
];

// Initialize default alert rules
defaultAlertRules.forEach(rule => alertManager.addRule(rule));
