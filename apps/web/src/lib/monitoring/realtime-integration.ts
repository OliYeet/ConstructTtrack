/**
 * Real-time Monitoring Integration
 *
 * Integrates real-time performance monitoring with:
 * - Existing performance monitoring system
 * - Supabase real-time subscriptions
 * - WebSocket gateway (when implemented)
 * - Event sourcing system (future)
 */

import { getLogger } from '../logging';

import { performanceMonitor } from './performance-monitor';
import { RealtimeAlertManager } from './realtime-alerts';
import {
  RealtimeLatencyMetric,
  RealtimeAlert,
  defaultRealtimeMonitoringConfig,
} from './realtime-metrics';
import { realtimePerformanceMonitor } from './realtime-performance-monitor';

// Integration manager for real-time monitoring
export class RealtimeMonitoringIntegration {
  private alertManager: RealtimeAlertManager;
  private isInitialized = false;
  private statsInterval?: NodeJS.Timeout;

  constructor() {
    this.alertManager = new RealtimeAlertManager(
      defaultRealtimeMonitoringConfig.alertConfig
    );
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

    this.isInitialized = true;

    const logger = getLogger();
    logger.info('Real-time monitoring integration initialized');
  }

  // Shutdown the integration
  shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    realtimePerformanceMonitor.stop();
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
    this.isInitialized = false;

    const logger = getLogger();
    logger.info('Real-time monitoring integration shutdown');
  }

  // Setup event listeners for real-time monitoring
  private setupEventListeners(): void {
    // Listen for alerts and send them through alert manager
    realtimePerformanceMonitor.on('alert', async (data: unknown) => {
      const alert = data as RealtimeAlert;
      await this.alertManager.sendAlert(alert);
    });

    // Listen for performance stats and log them
    realtimePerformanceMonitor.on('stats', (data: unknown) => {
      const stats = data as any; // Type assertion for stats object
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
    realtimePerformanceMonitor.on('metric', (data: unknown) => {
      const event = data as any; // Type assertion for event object
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
    this.statsInterval = setInterval(() => {
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

  // Get monitoring status
  getStatus(): {
    initialized: boolean;
    monitoring: boolean;
    stats?: any;
    alerts: number;
  } {
    const stats = realtimePerformanceMonitor.getCurrentStats();
    const alerts = realtimePerformanceMonitor.getActiveAlerts();

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
    };
  }
}

// Supabase real-time integration helpers
export class SupabaseRealtimeIntegration {
  // Track Supabase real-time subscription performance
  static trackSubscription(
    channel: string,
    eventType: string,
    startTime: number
  ): string {
    const eventId = realtimePerformanceMonitor.recordLatencyMetric({
      eventType: eventType as any,
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

    const timestamps: any = {
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

    const timestamps: any = {
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
