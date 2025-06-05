/**
 * Real-time Performance Monitor
 *
 * Monitors WebSocket connections, real-time event latency, and performance
 * metrics for ConstructTrack's fiber installation workflows.
 *
 * Key Features:
 * - End-to-end latency tracking (DB commit → client receive)
 * - P90/P99 percentile calculations
 * - Real-time alerting based on Charlie's thresholds
 * - WebSocket connection health monitoring
 * - Integration with existing performance monitoring
 */

import { getLogger } from '../logging';

import { performanceMonitor } from './performance-monitor';
import {
  RealtimeLatencyMetric,
  RealtimePerformanceStats,
  RealtimeMonitoringConfig,
  RealtimeAlert,
  RealtimeErrorMetric,
  WebSocketConnectionMetric,
  RealtimeSubscriptionMetric,
  PercentileStats,
  defaultRealtimeMonitoringConfig,
} from './realtime-metrics';

export class RealtimePerformanceMonitor {
  private config: RealtimeMonitoringConfig;
  private isMonitoring = false;
  private statsTimer?: NodeJS.Timeout;

  // Metric storage
  private latencyMetrics: RealtimeLatencyMetric[] = [];
  private connectionMetrics: Map<string, WebSocketConnectionMetric> = new Map();
  private subscriptionMetrics: Map<string, RealtimeSubscriptionMetric> =
    new Map();
  private errorMetrics: RealtimeErrorMetric[] = [];

  // Performance tracking
  private currentStats?: RealtimePerformanceStats;
  private activeAlerts: Map<string, RealtimeAlert> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();

  // Event listeners
  private eventListeners: Map<
    string,
    ((event: Record<string, unknown>) => void)[]
  > = new Map();

  constructor(config: Partial<RealtimeMonitoringConfig> = {}) {
    this.config = { ...defaultRealtimeMonitoringConfig, ...config };
  }

  // Start monitoring
  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start periodic stats calculation
    if (this.config.performanceStatsInterval > 0) {
      this.statsTimer = setInterval(() => {
        this.calculatePerformanceStats();
      }, this.config.performanceStatsInterval);
    }

    // Integrate with existing performance monitor
    performanceMonitor.recordMetric('realtime_monitor_started', 1, 'count', {
      component: 'realtime',
    });

    const logger = getLogger();
    logger.info('Real-time performance monitoring started', {
      metadata: { config: this.config },
    });
  }

  // Stop monitoring
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }

    const logger = getLogger();
    logger.info('Real-time performance monitoring stopped');
  }

  // Record latency metric for end-to-end tracking
  recordLatencyMetric(metric: Partial<RealtimeLatencyMetric>): string {
    if (!this.config.enabled || !this.config.enableLatencyTracking) {
      return '';
    }

    // Apply sampling rate
    if (Math.random() > this.config.samplingRate) {
      return '';
    }

    const eventId =
      metric.eventId ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const fullMetric: RealtimeLatencyMetric = {
      eventId,
      eventType: metric.eventType || 'WorkOrderUpdated',
      timestamps: {
        dbCommit: Date.now(),
        ...metric.timestamps,
      },
      latencies: {},
      metadata: {
        channel: 'unknown',
        messageSize: 0,
        ...metric.metadata,
      },
    };

    // Calculate latencies if timestamps are available
    this.calculateLatencies(fullMetric);

    this.latencyMetrics.push(fullMetric);
    this.cleanup();

    // Emit event
    this.emit('metric', { type: 'latency', metric: fullMetric });

    // Check thresholds
    this.checkLatencyThresholds(fullMetric);

    return eventId;
  }

  // Update latency metric with additional timestamps
  updateLatencyMetric(
    eventId: string,
    updates: Partial<RealtimeLatencyMetric>
  ): void {
    const metric = this.latencyMetrics.find(m => m.eventId === eventId);
    if (!metric) {
      return;
    }

    // Update timestamps
    if (updates.timestamps) {
      Object.assign(metric.timestamps, updates.timestamps);
    }

    // Update metadata
    if (updates.metadata) {
      Object.assign(metric.metadata, updates.metadata);
    }

    // Recalculate latencies
    this.calculateLatencies(metric);

    // Check thresholds again
    this.checkLatencyThresholds(metric);
  }

  // Record WebSocket connection metric
  recordConnectionMetric(metric: Partial<WebSocketConnectionMetric>): string {
    if (!this.config.enabled || !this.config.enableConnectionTracking) {
      return '';
    }

    const connectionId =
      metric.connectionId ||
      `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const existingMetric = this.connectionMetrics.get(connectionId);
    const fullMetric: WebSocketConnectionMetric = {
      connectionId,
      timestamps: {
        connectionStart: Date.now(),
        lastActivity: Date.now(),
        ...existingMetric?.timestamps,
        ...metric.timestamps,
      },
      metrics: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0,
        reconnectionAttempts: 0,
        ...existingMetric?.metrics,
        ...metric.metrics,
      },
      status: metric.status || 'connecting',
      userId: metric.userId || existingMetric?.userId,
      organizationId: metric.organizationId || existingMetric?.organizationId,
      lastError: metric.lastError || existingMetric?.lastError,
    };

    // Calculate connection time if established
    if (
      fullMetric.timestamps.connectionEstablished &&
      fullMetric.timestamps.connectionStart
    ) {
      fullMetric.metrics.connectionTime =
        fullMetric.timestamps.connectionEstablished -
        fullMetric.timestamps.connectionStart;
    }

    // Calculate total duration if disconnected
    if (
      fullMetric.timestamps.disconnected &&
      fullMetric.timestamps.connectionStart
    ) {
      fullMetric.metrics.totalDuration =
        fullMetric.timestamps.disconnected -
        fullMetric.timestamps.connectionStart;
    }

    this.connectionMetrics.set(connectionId, fullMetric);

    // Emit event
    this.emit('metric', { type: 'connection', metric: fullMetric });

    // Check connection thresholds
    this.checkConnectionThresholds(fullMetric);

    return connectionId;
  }

  // Record subscription metric
  recordSubscriptionMetric(
    metric: Partial<RealtimeSubscriptionMetric>
  ): string {
    if (!this.config.enabled || !this.config.enableSubscriptionTracking) {
      return '';
    }

    const subscriptionId =
      metric.subscriptionId ||
      `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const existingMetric = this.subscriptionMetrics.get(subscriptionId);
    const fullMetric: RealtimeSubscriptionMetric = {
      subscriptionId,
      channel: metric.channel || 'unknown',
      timestamps: {
        subscribed: Date.now(),
        ...existingMetric?.timestamps,
        ...metric.timestamps,
      },
      metrics: {
        eventsReceived: 0,
        averageEventSize: 0,
        ...existingMetric?.metrics,
        ...metric.metrics,
      },
      status: metric.status || 'active',
      userId: metric.userId || existingMetric?.userId,
      organizationId: metric.organizationId || existingMetric?.organizationId,
      filters: metric.filters || existingMetric?.filters,
    };

    this.subscriptionMetrics.set(subscriptionId, fullMetric);

    // Emit event
    this.emit('metric', { type: 'subscription', metric: fullMetric });

    return subscriptionId;
  }

  // Record error metric
  recordErrorMetric(metric: Partial<RealtimeErrorMetric>): string {
    if (!this.config.enabled || !this.config.enableErrorTracking) {
      return '';
    }

    const errorId =
      metric.errorId ||
      `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const fullMetric: RealtimeErrorMetric = {
      errorId,
      timestamp: Date.now(),
      type: metric.type || 'processing',
      severity: metric.severity || 'error',
      code: metric.code || 'UNKNOWN_ERROR',
      message: metric.message || 'Unknown error occurred',
      context: metric.context || {},
      metadata: metric.metadata,
    };

    this.errorMetrics.push(fullMetric);
    this.cleanup();

    // Emit event
    this.emit('metric', { type: 'error', metric: fullMetric });

    // Check error rate thresholds
    this.checkErrorRateThresholds();

    // Log error
    const logger = getLogger();
    logger.error('Real-time error recorded', {
      error: fullMetric,
    });

    return errorId;
  }

  // Get current performance statistics
  getCurrentStats(): RealtimePerformanceStats | undefined {
    return this.currentStats;
  }

  // Get active alerts
  getActiveAlerts(): RealtimeAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Add event listener
  on(event: string, listener: (data: Record<string, unknown>) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.push(listener);
    }
  }

  // Remove event listener
  off(event: string, listener: (data: Record<string, unknown>) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Emit event to listeners
  private emit(event: string, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          const logger = getLogger();
          logger.error('Error in real-time monitor event listener', { error });
        }
      });
    }
  }

  // Calculate latencies for a metric
  private calculateLatencies(metric: RealtimeLatencyMetric): void {
    const { timestamps } = metric;

    if (timestamps.eventSourced && timestamps.dbCommit) {
      metric.latencies.dbToEventSource =
        timestamps.eventSourced - timestamps.dbCommit;
    }

    if (timestamps.websocketSent && timestamps.eventSourced) {
      metric.latencies.eventSourceToWs =
        timestamps.websocketSent - timestamps.eventSourced;
    }

    if (timestamps.clientReceived && timestamps.websocketSent) {
      metric.latencies.wsToClient =
        timestamps.clientReceived - timestamps.websocketSent;
    }

    if (timestamps.clientReceived && timestamps.dbCommit) {
      metric.latencies.endToEnd =
        timestamps.clientReceived - timestamps.dbCommit;
    }
  }

  // Calculate performance statistics
  private calculatePerformanceStats(): void {
    if (!this.isMonitoring) {
      return;
    }

    const now = Date.now();
    const windowStart = now - this.config.alertConfig.evaluationWindow;

    // Filter metrics within the evaluation window
    const recentLatencyMetrics = this.latencyMetrics.filter(
      m => m.timestamps.dbCommit && m.timestamps.dbCommit >= windowStart
    );

    const recentErrorMetrics = this.errorMetrics.filter(
      m => m.timestamp >= windowStart
    );

    // Calculate latency statistics
    const endToEndLatencies = recentLatencyMetrics
      .map(m => m.latencies.endToEnd)
      .filter((l): l is number => l !== undefined);

    const dbToEventSourceLatencies = recentLatencyMetrics
      .map(m => m.latencies.dbToEventSource)
      .filter((l): l is number => l !== undefined);

    const eventSourceToWsLatencies = recentLatencyMetrics
      .map(m => m.latencies.eventSourceToWs)
      .filter((l): l is number => l !== undefined);

    const wsToClientLatencies = recentLatencyMetrics
      .map(m => m.latencies.wsToClient)
      .filter((l): l is number => l !== undefined);

    // Calculate connection statistics
    const activeConnections = Array.from(
      this.connectionMetrics.values()
    ).filter(c => c.status === 'connected').length;

    const totalConnections = this.connectionMetrics.size;

    const connectionTimes = Array.from(this.connectionMetrics.values())
      .map(c => c.metrics.connectionTime)
      .filter((t): t is number => t !== undefined);

    const successfulConnections = Array.from(
      this.connectionMetrics.values()
    ).filter(
      c => c.status === 'connected' || c.status === 'disconnected'
    ).length;

    // Calculate error statistics
    const totalErrors = recentErrorMetrics.length;
    const totalEvents = recentLatencyMetrics.length;
    const errorRate = totalEvents > 0 ? totalErrors / totalEvents : 0;

    const errorsByType = recentErrorMetrics.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const errorsBySeverity = recentErrorMetrics.reduce(
      (acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate throughput statistics
    const windowDurationSeconds =
      this.config.alertConfig.evaluationWindow / 1000;
    const eventsPerSecond = totalEvents / windowDurationSeconds;

    const totalBytes = recentLatencyMetrics.reduce(
      (sum, m) => sum + (m.metadata.messageSize || 0),
      0
    );
    const bytesPerSecond = totalBytes / windowDurationSeconds;

    // Create performance stats
    this.currentStats = {
      totalEvents,
      timeWindow: {
        start: windowStart,
        end: now,
        durationMs: this.config.alertConfig.evaluationWindow,
      },
      latencyStats: {
        endToEnd: this.calculatePercentileStats(endToEndLatencies),
        dbToEventSource: this.calculatePercentileStats(
          dbToEventSourceLatencies
        ),
        eventSourceToWs: this.calculatePercentileStats(
          eventSourceToWsLatencies
        ),
        wsToClient: this.calculatePercentileStats(wsToClientLatencies),
      },
      connectionStats: {
        totalConnections,
        activeConnections,
        averageConnectionTime:
          connectionTimes.length > 0
            ? connectionTimes.reduce((a, b) => a + b, 0) /
              connectionTimes.length
            : 0,
        connectionSuccessRate:
          totalConnections > 0 ? successfulConnections / totalConnections : 1,
      },
      errorStats: {
        totalErrors,
        errorRate,
        errorsByType,
        errorsBySeverity,
      },
      throughputStats: {
        eventsPerSecond,
        bytesPerSecond,
        messagesPerSecond: eventsPerSecond, // Assuming 1 message per event
      },
    };

    // Emit stats event
    this.emit('stats', this.currentStats as unknown as Record<string, unknown>);

    // Record stats in main performance monitor
    performanceMonitor.recordMetric(
      'realtime_events_per_second',
      eventsPerSecond,
      'events/sec',
      { component: 'realtime' }
    );

    performanceMonitor.recordMetric(
      'realtime_error_rate',
      errorRate * 100,
      'percent',
      { component: 'realtime' }
    );

    if (endToEndLatencies.length > 0) {
      const stats = this.currentStats.latencyStats.endToEnd;
      performanceMonitor.recordMetric('realtime_latency_p99', stats.p99, 'ms', {
        component: 'realtime',
        metric: 'end_to_end',
      });
    }
  }

  // Calculate percentile statistics for an array of values
  private calculatePercentileStats(values: number[]): PercentileStats {
    if (values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        standardDeviation: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = sorted.reduce((a, b) => a + b, 0) / count;

    const median =
      count % 2 === 0
        ? (sorted[Math.floor(count / 2) - 1] + sorted[Math.floor(count / 2)]) /
          2
        : sorted[Math.floor(count / 2)];

    const p90 = sorted[Math.floor(count * 0.9)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    const variance =
      sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    return {
      count,
      min,
      max,
      mean,
      median,
      p90,
      p95,
      p99,
      standardDeviation,
    };
  }

  // Check latency thresholds and trigger alerts
  private checkLatencyThresholds(metric: RealtimeLatencyMetric): void {
    if (!this.config.alertConfig.enabled || !metric.latencies.endToEnd) {
      return;
    }

    const { thresholds } = this.config.alertConfig;
    const endToEndLatency = metric.latencies.endToEnd;

    // Check individual metric thresholds
    if (endToEndLatency > thresholds.latency.endToEndP99Critical) {
      this.triggerAlert({
        type: 'latency',
        severity: 'critical',
        message: `End-to-end latency exceeded critical threshold: ${endToEndLatency}ms > ${thresholds.latency.endToEndP99Critical}ms`,
        details: {
          eventId: metric.eventId,
          eventType: metric.eventType,
          latency: endToEndLatency,
          threshold: thresholds.latency.endToEndP99Critical,
          channel: metric.metadata.channel,
        },
      });
    } else if (endToEndLatency > thresholds.latency.endToEndP99Warning) {
      this.triggerAlert({
        type: 'latency',
        severity: 'warning',
        message: `End-to-end latency exceeded warning threshold: ${endToEndLatency}ms > ${thresholds.latency.endToEndP99Warning}ms`,
        details: {
          eventId: metric.eventId,
          eventType: metric.eventType,
          latency: endToEndLatency,
          threshold: thresholds.latency.endToEndP99Warning,
          channel: metric.metadata.channel,
        },
      });
    }

    // Check P99 thresholds if we have current stats
    if (this.currentStats) {
      const p99Latency = this.currentStats.latencyStats.endToEnd.p99;
      const avgLatency = this.currentStats.latencyStats.endToEnd.mean;

      if (p99Latency > thresholds.latency.endToEndP99Critical) {
        this.triggerAlert({
          type: 'latency',
          severity: 'critical',
          message: `P99 latency exceeded critical threshold: ${p99Latency.toFixed(2)}ms > ${thresholds.latency.endToEndP99Critical}ms`,
          details: {
            p99Latency,
            threshold: thresholds.latency.endToEndP99Critical,
            sampleSize: this.currentStats.latencyStats.endToEnd.count,
            timeWindow: this.currentStats.timeWindow,
          },
        });
      }

      if (avgLatency > thresholds.latency.averageCritical) {
        this.triggerAlert({
          type: 'latency',
          severity: 'critical',
          message: `Average latency exceeded critical threshold: ${avgLatency.toFixed(2)}ms > ${thresholds.latency.averageCritical}ms`,
          details: {
            averageLatency: avgLatency,
            threshold: thresholds.latency.averageCritical,
            sampleSize: this.currentStats.latencyStats.endToEnd.count,
            timeWindow: this.currentStats.timeWindow,
          },
        });
      }
    }
  }

  // Check connection thresholds
  private checkConnectionThresholds(metric: WebSocketConnectionMetric): void {
    if (!this.config.alertConfig.enabled) {
      return;
    }

    const { thresholds } = this.config.alertConfig;

    // Check connection time
    if (
      metric.metrics.connectionTime &&
      metric.metrics.connectionTime > thresholds.connections.maxConnectionTime
    ) {
      this.triggerAlert({
        type: 'connection',
        severity: 'warning',
        message: `Connection time exceeded threshold: ${metric.metrics.connectionTime}ms > ${thresholds.connections.maxConnectionTime}ms`,
        details: {
          connectionId: metric.connectionId,
          connectionTime: metric.metrics.connectionTime,
          threshold: thresholds.connections.maxConnectionTime,
          userId: metric.userId,
        },
      });
    }

    // Check reconnection attempts
    if (
      metric.metrics.reconnectionAttempts >
      thresholds.connections.maxReconnectionAttempts
    ) {
      this.triggerAlert({
        type: 'connection',
        severity: 'critical',
        message: `Excessive reconnection attempts: ${metric.metrics.reconnectionAttempts} > ${thresholds.connections.maxReconnectionAttempts}`,
        details: {
          connectionId: metric.connectionId,
          reconnectionAttempts: metric.metrics.reconnectionAttempts,
          threshold: thresholds.connections.maxReconnectionAttempts,
          userId: metric.userId,
          lastError: metric.lastError,
        },
      });
    }

    // Check connection success rate if we have current stats
    if (this.currentStats) {
      const successRate =
        this.currentStats.connectionStats.connectionSuccessRate;
      if (successRate < thresholds.connections.minSuccessRate) {
        this.triggerAlert({
          type: 'connection',
          severity: 'critical',
          message: `Connection success rate below threshold: ${(successRate * 100).toFixed(1)}% < ${(thresholds.connections.minSuccessRate * 100).toFixed(1)}%`,
          details: {
            successRate,
            threshold: thresholds.connections.minSuccessRate,
            totalConnections:
              this.currentStats.connectionStats.totalConnections,
            activeConnections:
              this.currentStats.connectionStats.activeConnections,
          },
        });
      }
    }
  }

  // Check error rate thresholds (Charlie's requirement: >1% error rate)
  private checkErrorRateThresholds(): void {
    if (!this.config.alertConfig.enabled || !this.currentStats) {
      return;
    }

    const { thresholds } = this.config.alertConfig;
    const errorRate = this.currentStats.errorStats.errorRate;

    if (errorRate > thresholds.errorRate.criticalThreshold) {
      this.triggerAlert({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate exceeded critical threshold: ${(errorRate * 100).toFixed(2)}% > ${(thresholds.errorRate.criticalThreshold * 100).toFixed(2)}%`,
        details: {
          errorRate,
          threshold: thresholds.errorRate.criticalThreshold,
          totalErrors: this.currentStats.errorStats.totalErrors,
          totalEvents: this.currentStats.totalEvents,
          timeWindow: this.currentStats.timeWindow,
          errorsByType: this.currentStats.errorStats.errorsByType,
        },
      });
    } else if (errorRate > thresholds.errorRate.warningThreshold) {
      this.triggerAlert({
        type: 'error_rate',
        severity: 'warning',
        message: `Error rate exceeded warning threshold: ${(errorRate * 100).toFixed(2)}% > ${(thresholds.errorRate.warningThreshold * 100).toFixed(2)}%`,
        details: {
          errorRate,
          threshold: thresholds.errorRate.warningThreshold,
          totalErrors: this.currentStats.errorStats.totalErrors,
          totalEvents: this.currentStats.totalEvents,
          timeWindow: this.currentStats.timeWindow,
        },
      });
    }
  }

  // Trigger an alert with cooldown logic
  private triggerAlert(
    alertData: Omit<RealtimeAlert, 'id' | 'timestamp'>
  ): void {
    const alertKey = `${alertData.type}_${alertData.severity}`;
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;

    // Check cooldown period
    if (now - lastAlertTime < this.config.alertConfig.cooldownPeriod) {
      return;
    }

    const alert: RealtimeAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: now,
      ...alertData,
    };

    this.activeAlerts.set(alert.id, alert);
    this.lastAlertTimes.set(alertKey, now);

    // Emit alert event
    this.emit('alert', alert as unknown as Record<string, unknown>);

    // Log alert
    const logger = getLogger();
    logger.warn('Real-time performance alert triggered', {
      metadata: {
        alert,
      },
    });

    // Record alert metric in main performance monitor
    performanceMonitor.recordMetric('realtime_alert_triggered', 1, 'count', {
      component: 'realtime',
      type: alert.type,
      severity: alert.severity,
    });
  }

  // Cleanup old metrics to prevent memory leaks
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.metricsRetentionPeriod;

    // Clean up latency metrics
    this.latencyMetrics = this.latencyMetrics.filter(
      m => m.timestamps.dbCommit && m.timestamps.dbCommit >= cutoff
    );

    // Clean up error metrics
    this.errorMetrics = this.errorMetrics.filter(m => m.timestamp >= cutoff);

    // Enforce max metrics limit
    if (this.latencyMetrics.length > this.config.maxMetricsInMemory) {
      this.latencyMetrics = this.latencyMetrics.slice(
        -this.config.maxMetricsInMemory
      );
    }

    if (this.errorMetrics.length > this.config.maxMetricsInMemory) {
      this.errorMetrics = this.errorMetrics.slice(
        -this.config.maxMetricsInMemory
      );
    }

    // Clean up old connections (keep only recent ones)
    for (const [connectionId, metric] of this.connectionMetrics.entries()) {
      if (metric.timestamps.lastActivity < cutoff) {
        this.connectionMetrics.delete(connectionId);
      }
    }

    // Clean up old subscriptions
    for (const [subscriptionId, metric] of this.subscriptionMetrics.entries()) {
      if (
        metric.timestamps.subscribed < cutoff &&
        metric.status === 'inactive'
      ) {
        this.subscriptionMetrics.delete(subscriptionId);
      }
    }

    // Clean up resolved alerts older than retention period
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.activeAlerts.delete(alertId);
      }
    }
  }
}

// Global real-time performance monitor instance
export const realtimePerformanceMonitor = new RealtimePerformanceMonitor();
