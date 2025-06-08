/**
 * Real-time Monitoring Integration
 *
 * Integrates real-time performance monitoring with:
 * - Existing performance monitoring system
 * - Supabase real-time subscriptions
 * - WebSocket gateway (when implemented)
 * - Event sourcing system (future)
 * - Multiple metric collectors (LUM-585 enhancement)
 */

import type { EventType } from '../../types/realtime-protocol';
import { getLogger } from '../logging';

import {
  AggregateCollector,
  defaultAggregateCollectorConfig,
} from './metric-collectors/aggregate-collector';
import {
  CollectorRegistry,
  collectorRegistry,
  BaseMetricCollector,
  CollectorMetric,
} from './metric-collectors/base-collector';
import {
  ExportCollector,
  defaultExportCollectorConfig,
} from './metric-collectors/export-collector';
import {
  ResourceCollector,
  defaultResourceCollectorConfig,
} from './metric-collectors/resource-collector';
import { performanceMonitor } from './performance-monitor';
import { RealtimeAlertManager } from './realtime-alerts';
import {
  getMonitoringConfig,
  EnhancedRealtimeMonitoringConfig,
} from './realtime-config';
import {
  RealtimeLatencyMetric,
  RealtimeAlert,
  defaultRealtimeMonitoringConfig,
} from './realtime-metrics';
import { realtimePerformanceMonitor } from './realtime-performance-monitor';

// LUM-585: Enhanced monitoring imports

// Integration manager for real-time monitoring
export class RealtimeMonitoringIntegration {
  private alertManager: RealtimeAlertManager;
  private isInitialized = false;

  // LUM-585: Enhanced monitoring properties
  private enhancedConfig: EnhancedRealtimeMonitoringConfig;
  private metricCollectors = new Map<string, BaseMetricCollector>();
  private collectorRegistry: CollectorRegistry;
  private reportingTimer?: NodeJS.Timeout;

  constructor() {
    this.alertManager = new RealtimeAlertManager(
      defaultRealtimeMonitoringConfig.alertConfig
    );

    // LUM-585: Initialize enhanced monitoring
    this.enhancedConfig = getMonitoringConfig();
    this.collectorRegistry = collectorRegistry;
    this.setupCollectorEventListeners();
  }

  // Initialize the integration
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Start real-time performance monitoring
    realtimePerformanceMonitor.start();

    // Setup event listeners
    this.setupEventListeners();

    // Integrate with existing performance monitor
    this.integrateWithPerformanceMonitor();

    // LUM-585: Initialize enhanced monitoring collectors
    this.initializeMetricCollectors();

    this.isInitialized = true;

    const logger = getLogger();
    logger.info(
      'Real-time monitoring integration initialized with enhanced collectors',
      {
        metadata: {
          collectorsEnabled: Array.from(this.metricCollectors.keys()),
          enhancedConfig: {
            resourceMonitoring: this.enhancedConfig.collectors.resource.enabled,
            aggregateMonitoring:
              this.enhancedConfig.collectors.aggregate.enabled,
            exportMonitoring:
              this.enhancedConfig.collectors.export.prometheus.enabled ||
              this.enhancedConfig.collectors.export.openTelemetry.enabled,
          },
        },
      }
    );
  }

  // Shutdown the integration
  shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    // Stop real-time performance monitoring
    realtimePerformanceMonitor.stop();

    // LUM-585: Stop all metric collectors
    this.shutdownMetricCollectors();

    // Clear reporting timer
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = undefined;
    }

    this.isInitialized = false;

    const logger = getLogger();
    logger.info(
      'Real-time monitoring integration shutdown with enhanced collectors'
    );
  }

  // LUM-585: Shutdown all metric collectors
  private shutdownMetricCollectors(): void {
    const logger = getLogger();

    try {
      // Stop all collectors
      for (const [name, collector] of this.metricCollectors.entries()) {
        collector.stop();
        this.collectorRegistry.unregister(collector.id);
        logger.info(`Collector ${name} stopped and unregistered`);
      }

      // Clear the collectors map
      this.metricCollectors.clear();

      logger.info('All metric collectors shutdown successfully');
    } catch (error) {
      logger.error('Error during metric collectors shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Setup event listeners for real-time monitoring
  private setupEventListeners(): void {
    // Listen for alerts and send them through alert manager
    realtimePerformanceMonitor.on('alert', async (alert: RealtimeAlert) => {
      await this.alertManager.sendAlert(alert);
    });

    // Listen for performance stats and log them
    realtimePerformanceMonitor.on('stats', stats => {
      const logger = getLogger();
      logger.info('Real-time performance stats calculated', {
        metadata: {
          stats: {
            totalEvents: stats.totalEvents,
            errorRate: stats.errorStats.errorRate,
            p99Latency: stats.latencyStats.endToEnd.p99,
            activeConnections: stats.connectionStats.activeConnections,
            eventsPerSecond: stats.throughputStats.eventsPerSecond,
          },
        },
      });
    });

    // Listen for metrics and optionally sample them for detailed logging
    realtimePerformanceMonitor.on('metric', event => {
      if (event.type === 'latency') {
        const metric = event.metric as RealtimeLatencyMetric;

        // Log high-latency events for debugging
        if (metric.latencies.endToEnd && metric.latencies.endToEnd > 1000) {
          const logger = getLogger();
          logger.warn('High latency real-time event detected', {
            metadata: {
              eventId: metric.eventId,
              eventType: metric.eventType,
              endToEndLatency: metric.latencies.endToEnd,
              channel: metric.metadata.channel,
            },
          });
        }
      }
    });
  }

  // Integrate with existing performance monitoring system
  private integrateWithPerformanceMonitor(): void {
    // Record real-time monitoring startup
    performanceMonitor.recordMetric(
      'realtime_monitoring_initialized',
      1,
      'count',
      { component: 'realtime' }
    );

    // Setup periodic reporting to main performance monitor
    this.reportingTimer = setInterval(() => {
      const stats = realtimePerformanceMonitor.getCurrentStats();
      if (stats) {
        // Report key metrics to main performance monitor
        performanceMonitor.recordMetric(
          'realtime_active_connections',
          stats.connectionStats.activeConnections,
          'count',
          { component: 'realtime' }
        );

        performanceMonitor.recordMetric(
          'realtime_events_total',
          stats.totalEvents,
          'count',
          { component: 'realtime' }
        );

        if (stats.latencyStats.endToEnd.count > 0) {
          performanceMonitor.recordMetric(
            'realtime_latency_mean',
            stats.latencyStats.endToEnd.mean,
            'ms',
            { component: 'realtime', metric: 'end_to_end' }
          );

          performanceMonitor.recordMetric(
            'realtime_latency_p90',
            stats.latencyStats.endToEnd.p90,
            'ms',
            { component: 'realtime', metric: 'end_to_end' }
          );
        }
      }
    }, 60000); // Report every minute
  }

  // Get alert manager for external configuration
  getAlertManager(): RealtimeAlertManager {
    return this.alertManager;
  }

  // Record a custom metric through the integration
  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string | number> = {}
  ): void {
    // Ensure the integration is initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    // Record the metric through the performance monitor
    performanceMonitor.recordMetric(name, value, unit, {
      ...tags,
      component: 'api-metrics',
      source: 'realtime-integration',
    });

    const logger = getLogger();
    logger.debug('Custom metric recorded through realtime integration', {
      metadata: {
        name,
        value,
        unit,
        tags,
      },
    });
  }

  // Get monitoring status
  getStatus(): {
    initialized: boolean;
    monitoring: boolean;
    stats?: {
      totalEvents: number;
      errorRate: number;
      p99Latency: number;
      activeConnections: number;
      eventsPerSecond: number;
    };
    alerts: number;
    collectors?: Record<
      string,
      {
        id: string;
        name: string;
        enabled: boolean;
        running: boolean;
        lastCollection: number | null;
        nextCollection: number | null;
        metricsCollected: number;
        errors: number;
      }
    >; // LUM-585: Enhanced collector status
  } {
    const stats = realtimePerformanceMonitor.getCurrentStats();
    const alerts = realtimePerformanceMonitor.getActiveAlerts();

    // LUM-585: Get collector status
    const collectorStatus = this.getCollectorStatus();

    return {
      initialized: this.isInitialized,
      monitoring: this.isInitialized,
      stats: stats
        ? {
            totalEvents: stats.totalEvents,
            errorRate: stats.errorStats.errorRate,
            p99Latency: stats.latencyStats.endToEnd.p99,
            activeConnections: stats.connectionStats.activeConnections,
            eventsPerSecond: stats.throughputStats.eventsPerSecond,
          }
        : undefined,
      alerts: alerts.length,
      collectors: collectorStatus,
    };
  }

  // LUM-585: Initialize metric collectors based on configuration
  private initializeMetricCollectors(): void {
    const logger = getLogger();

    try {
      // Initialize Resource Collector
      if (this.enhancedConfig.collectors.resource.enabled) {
        const resourceCollector = new ResourceCollector({
          ...defaultResourceCollectorConfig,
          enabled: this.enhancedConfig.collectors.resource.enabled,
          interval: this.enhancedConfig.collectors.resource.interval,
          metrics: this.enhancedConfig.collectors.resource.metrics,
        });

        this.metricCollectors.set('resource', resourceCollector);
        this.collectorRegistry.register(resourceCollector);
        resourceCollector.start();

        logger.info('Resource collector initialized and started');
      }

      // Initialize Aggregate Collector
      if (this.enhancedConfig.collectors.aggregate.enabled) {
        const aggregateCollector = new AggregateCollector({
          ...defaultAggregateCollectorConfig,
          enabled: this.enhancedConfig.collectors.aggregate.enabled,
          interval: this.enhancedConfig.collectors.aggregate.interval,
          retentionPeriods:
            this.enhancedConfig.collectors.aggregate.retentionPeriods,
        });

        this.metricCollectors.set('aggregate', aggregateCollector);
        this.collectorRegistry.register(aggregateCollector);
        aggregateCollector.start();

        logger.info('Aggregate collector initialized and started');
      }

      // Initialize Export Collector
      if (
        this.enhancedConfig.collectors.export.prometheus.enabled ||
        this.enhancedConfig.collectors.export.openTelemetry.enabled
      ) {
        const exportCollector = new ExportCollector({
          ...defaultExportCollectorConfig,
          enabled: true,
          exporters: {
            prometheus: {
              enabled: this.enhancedConfig.collectors.export.prometheus.enabled,
              endpoint:
                this.enhancedConfig.collectors.export.prometheus.endpoint,
              format: 'text',
              includeTimestamp: false,
              includeHelp: true,
            },
            openTelemetry: {
              enabled:
                this.enhancedConfig.collectors.export.openTelemetry.enabled,
              endpoint:
                this.enhancedConfig.collectors.export.openTelemetry.endpoint,
              protocol: 'http',
              headers:
                this.enhancedConfig.collectors.export.openTelemetry.headers,
              compression: 'none',
            },
            json: {
              enabled: false, // JSON export not configured in enhanced config
              format: 'structured',
            },
          },
        });

        this.metricCollectors.set('export', exportCollector);
        this.collectorRegistry.register(exportCollector);
        exportCollector.start();

        logger.info('Export collector initialized and started');
      }
    } catch (error) {
      logger.error('Failed to initialize metric collectors', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // LUM-585: Setup event listeners for collector registry
  private setupCollectorEventListeners(): void {
    const logger = getLogger();

    // Listen for metrics from all collectors
    this.collectorRegistry.on(
      'metrics',
      (data: { collector: string; metrics: CollectorMetric[] }) => {
        logger.debug('Metrics collected', {
          metadata: {
            collector: data.collector,
            count: data.metrics.length,
          },
        });

        // Forward metrics to aggregate collector if it exists
        const aggregateCollector = this.metricCollectors.get(
          'aggregate'
        ) as AggregateCollector;
        if (aggregateCollector) {
          aggregateCollector.addMetricsToBuffer(data.metrics);
        }

        // Forward metrics to export collector if it exists
        const exportCollector = this.metricCollectors.get(
          'export'
        ) as ExportCollector;
        if (exportCollector) {
          exportCollector.addMetricsToQueue(data.metrics);
        }

        // Integrate with existing performance monitor
        this.integrateCollectorMetricsWithPerformanceMonitor(data.metrics);
      }
    );

    // Listen for collector errors
    this.collectorRegistry.on(
      'error',
      (data: { collector: string; error: any }) => {
        logger.error('Collector error', {
          metadata: {
            collector: data.collector,
            error: data.error,
          },
        });
      }
    );

    // Listen for collector lifecycle events
    this.collectorRegistry.on(
      'collectorStarted',
      (data: { collector: string }) => {
        logger.info('Collector started', {
          metadata: { collector: data.collector },
        });
      }
    );

    this.collectorRegistry.on(
      'collectorStopped',
      (data: { collector: string }) => {
        logger.info('Collector stopped', {
          metadata: { collector: data.collector },
        });
      }
    );
  }

  // LUM-585: Get status of all collectors
  private getCollectorStatus(): Record<
    string,
    {
      id: string;
      name: string;
      enabled: boolean;
      running: boolean;
      lastCollection: number | null;
      nextCollection: number | null;
      metricsCollected: number;
      errors: number;
    }
  > {
    const status: Record<
      string,
      {
        id: string;
        name: string;
        enabled: boolean;
        running: boolean;
        lastCollection: number | null;
        nextCollection: number | null;
        metricsCollected: number;
        errors: number;
      }
    > = {};

    for (const [name, collector] of this.metricCollectors.entries()) {
      status[name] = collector.getStatus();
    }

    return status;
  }

  // LUM-585: Integrate collector metrics with existing performance monitor
  private integrateCollectorMetricsWithPerformanceMonitor(
    metrics: CollectorMetric[]
  ): void {
    for (const metric of metrics) {
      if (metric.type === 'resource') {
        // Record resource metrics in the main performance monitor
        performanceMonitor.recordMetric(
          `realtime_${metric.resourceType}_${metric.tags.metric || 'value'}`,
          metric.value,
          metric.unit,
          {
            component: 'realtime-enhanced',
            collector: metric.source,
            resourceType: metric.resourceType,
          }
        );
      }
    }
  }
}

// Supabase real-time integration helpers
export class SupabaseRealtimeIntegration {
  // Track Supabase real-time subscription performance
  static trackSubscription(
    channel: string,
    eventType: EventType,
    startTime: number
  ): string {
    const eventId = realtimePerformanceMonitor.recordLatencyMetric({
      eventType,
      timestamps: {
        dbCommit: startTime,
      },
      metadata: {
        channel,
        messageSize: 0, // Will be updated when message is received
      },
    });

    return eventId;
  }

  // Update latency metric when Supabase event is received
  static updateEventReceived(
    eventId: string,
    messageSize: number,
    receivedAt?: number
  ): void {
    realtimePerformanceMonitor.updateLatencyMetric(eventId, {
      timestamps: {
        clientReceived: receivedAt || Date.now(),
      },
      metadata: {
        messageSize,
      },
    });
  }

  // Track Supabase connection events
  static trackConnection(
    connectionId: string,
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    error?: { code: string; message: string }
  ): void {
    const now = Date.now();

    const timestamps: {
      connectionStart: number;
      connectionEstablished?: number;
      lastActivity: number;
      disconnected?: number;
    } = {
      connectionStart: now,
      lastActivity: now,
    };

    if (status === 'connected') {
      timestamps.connectionEstablished = now;
    } else if (status === 'disconnected') {
      timestamps.disconnected = now;
    }

    realtimePerformanceMonitor.recordConnectionMetric({
      connectionId,
      status,
      timestamps,
      lastError: error ? { ...error, timestamp: now } : undefined,
    });
  }

  // Track Supabase subscription events
  static trackSubscriptionEvent(
    subscriptionId: string,
    channel: string,
    eventSize: number
  ): void {
    realtimePerformanceMonitor.recordSubscriptionMetric({
      subscriptionId,
      channel,
      metrics: {
        eventsReceived: 1,
        averageEventSize: eventSize,
        lastEventTimestamp: Date.now(),
      },
    });
  }

  // Record Supabase real-time errors
  static recordError(
    type: 'connection' | 'subscription' | 'message',
    code: string,
    message: string,
    context: Record<string, unknown> = {}
  ): void {
    realtimePerformanceMonitor.recordErrorMetric({
      type,
      severity: 'error',
      code,
      message,
      context,
    });
  }
}

// WebSocket gateway integration helpers (for future use with LUM-591)
export class WebSocketGatewayIntegration {
  // Track WebSocket message sending
  static trackMessageSent(
    eventId: string,
    messageSize: number,
    sentAt?: number
  ): void {
    realtimePerformanceMonitor.updateLatencyMetric(eventId, {
      timestamps: {
        websocketSent: sentAt || Date.now(),
      },
      metadata: {
        messageSize,
      },
    });
  }

  // Track WebSocket connection metrics
  static trackConnection(
    connectionId: string,
    userId?: string,
    organizationId?: string
  ): void {
    realtimePerformanceMonitor.recordConnectionMetric({
      connectionId,
      userId,
      organizationId,
      status: 'connecting',
    });
  }

  // Update connection status
  static updateConnectionStatus(
    connectionId: string,
    status: 'connected' | 'disconnected' | 'error',
    error?: { code: string; message: string }
  ): void {
    const now = Date.now();

    const timestamps: {
      connectionStart: number;
      connectionEstablished?: number;
      lastActivity: number;
      disconnected?: number;
    } = {
      connectionStart: now,
      lastActivity: now,
    };

    if (status === 'connected') {
      timestamps.connectionEstablished = now;
    } else if (status === 'disconnected') {
      timestamps.disconnected = now;
    }

    realtimePerformanceMonitor.recordConnectionMetric({
      connectionId,
      status,
      timestamps,
      lastError: error ? { ...error, timestamp: now } : undefined,
    });
  }

  // Track message throughput
  static trackMessageThroughput(
    connectionId: string,
    messagesSent: number,
    messagesReceived: number,
    bytesTransferred: number
  ): void {
    const now = Date.now();
    realtimePerformanceMonitor.recordConnectionMetric({
      connectionId,
      metrics: {
        messagesSent,
        messagesReceived,
        bytesTransferred,
        reconnectionAttempts: 0,
      },
      timestamps: {
        connectionStart: now,
        lastActivity: now,
      },
    });
  }
}

// Event sourcing integration helpers (for future use with LUM-588)
export class EventSourcingIntegration {
  // Track event sourcing latency
  static trackEventSourced(eventId: string, sourcedAt?: number): void {
    realtimePerformanceMonitor.updateLatencyMetric(eventId, {
      timestamps: {
        eventSourced: sourcedAt || Date.now(),
      },
    });
  }

  // Track event processing errors
  static recordProcessingError(
    eventId: string,
    error: { code: string; message: string },
    context: Record<string, unknown> = {}
  ): void {
    realtimePerformanceMonitor.recordErrorMetric({
      type: 'processing',
      severity: 'error',
      code: error.code,
      message: error.message,
      context: {
        eventId,
        ...context,
      },
    });
  }
}

// Global integration instance
export const realtimeMonitoringIntegration =
  new RealtimeMonitoringIntegration();

// Auto-initialize in production environments
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Initialize on client side in production
  realtimeMonitoringIntegration.initialize();
} else if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Initialize on server side (except in tests)
  realtimeMonitoringIntegration.initialize();
}
