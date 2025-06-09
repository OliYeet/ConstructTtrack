/**
 * Real-time Performance Monitoring - Main Export
 *
 * Provides comprehensive real-time performance monitoring for ConstructTrack's
 * fiber installation workflows based on Charlie's strategic requirements.
 *
 * Key Features:
 * - End-to-end latency tracking (DB commit → client receive)
 * - P90/P99 percentile calculations with <250ms goal
 * - Real-time alerting (>1% error rate, >500ms avg latency for 5min)
 * - WebSocket connection health monitoring
 * - Integration with existing monitoring systems
 */

// Import functions for internal use
import {
  realtimeMonitoringIntegration,
  SupabaseRealtimeIntegration,
  WebSocketGatewayIntegration,
  EventSourcingIntegration,
} from './realtime-integration';
import { realtimePerformanceMonitor } from './realtime-performance-monitor';

// Core monitoring components
export {
  RealtimePerformanceMonitor,
  realtimePerformanceMonitor,
} from './realtime-performance-monitor';
export { RealtimeAlertManager, AlertFormatters } from './realtime-alerts';
export {
  RealtimeMonitoringIntegration,
  SupabaseRealtimeIntegration,
  WebSocketGatewayIntegration,
  EventSourcingIntegration,
  realtimeMonitoringIntegration,
} from './realtime-integration';

// Types and interfaces
export type {
  RealtimeLatencyMetric,
  WebSocketConnectionMetric,
  RealtimeSubscriptionMetric,
  RealtimeErrorMetric,
  RealtimePerformanceStats,
  PercentileStats,
  RealtimeAlertThresholds,
  RealtimeAlertConfig,
  RealtimeMonitoringConfig,
  RealtimeAlert,
  ThresholdExceeded,
  RealtimeMetricEvent,
  RealtimeMonitoringEvent,
} from './realtime-metrics';

export type { AlertChannel, AlertNotification } from './realtime-alerts';

// Default configuration
export { defaultRealtimeMonitoringConfig } from './realtime-metrics';

// Utility functions for easy integration

export const RealtimeMonitoring = {
  // Initialize monitoring
  initialize: () => realtimeMonitoringIntegration.initialize(),

  // Shutdown monitoring
  shutdown: () => realtimeMonitoringIntegration.shutdown(),

  // Get current status
  getStatus: () => realtimeMonitoringIntegration.getStatus(),

  // Get current performance stats
  getStats: () => realtimePerformanceMonitor.getCurrentStats(),

  // Get active alerts
  getAlerts: () => realtimePerformanceMonitor.getActiveAlerts(),

  // Track a real-time event (simplified interface)
  trackEvent: (
    eventType: string,
    channel: string,
    metadata: Record<string, unknown> = {}
  ) => {
    return realtimePerformanceMonitor.recordLatencyMetric({
      eventType: eventType as any,
      metadata: {
        channel,
        messageSize: 0,
        ...metadata,
      },
    });
  },

  // Update event with received timestamp
  eventReceived: (eventId: string, messageSize: number = 0) => {
    realtimePerformanceMonitor.updateLatencyMetric(eventId, {
      timestamps: {
        clientReceived: Date.now(),
      },
      metadata: {
        messageSize,
      },
    });
  },

  // Track connection events
  trackConnection: (
    connectionId: string,
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    userId?: string,
    organizationId?: string
  ) => {
    return realtimePerformanceMonitor.recordConnectionMetric({
      connectionId,
      status,
      userId,
      organizationId,
    });
  },

  // Record errors
  recordError: (
    type: 'connection' | 'message' | 'subscription' | 'processing',
    code: string,
    message: string,
    context: Record<string, unknown> = {}
  ) => {
    return realtimePerformanceMonitor.recordErrorMetric({
      type,
      severity: 'error',
      code,
      message,
      context,
    });
  },

  // Get alert manager for configuration
  getAlertManager: () => realtimeMonitoringIntegration.getAlertManager(),
};

// Performance monitoring middleware for API routes
export const withRealtimeMonitoring = (handler: any) => {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const eventId = RealtimeMonitoring.trackEvent(
      'ApiRequest',
      `api:${req.url}`,
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
      }
    );

    try {
      const result = await handler(req, res);

      // Track successful completion
      RealtimeMonitoring.eventReceived(
        eventId,
        JSON.stringify(result || {}).length
      );

      return result;
    } catch (error) {
      // Track error
      RealtimeMonitoring.recordError(
        'processing',
        'API_ERROR',
        error instanceof Error ? error.message : 'Unknown API error',
        {
          eventId,
          method: req.method,
          url: req.url,
          duration: Date.now() - startTime,
        }
      );

      throw error;
    }
  };
};

// Supabase real-time monitoring helpers

export const SupabaseMonitoring = {
  // Track Supabase subscription
  trackSubscription: SupabaseRealtimeIntegration.trackSubscription,

  // Update when event received
  eventReceived: SupabaseRealtimeIntegration.updateEventReceived,

  // Track connection status
  trackConnection: SupabaseRealtimeIntegration.trackConnection,

  // Track subscription events
  trackSubscriptionEvent: SupabaseRealtimeIntegration.trackSubscriptionEvent,

  // Record errors
  recordError: SupabaseRealtimeIntegration.recordError,
};

// WebSocket monitoring helpers (for future use)

export const WebSocketMonitoring = {
  // Track message sent
  messageSent: WebSocketGatewayIntegration.trackMessageSent,

  // Track connection
  trackConnection: WebSocketGatewayIntegration.trackConnection,

  // Update connection status
  updateConnectionStatus: WebSocketGatewayIntegration.updateConnectionStatus,

  // Track throughput
  trackThroughput: WebSocketGatewayIntegration.trackMessageThroughput,
};

// Event sourcing monitoring helpers (for future use)

export const EventSourcingMonitoring = {
  // Track event sourced
  eventSourced: EventSourcingIntegration.trackEventSourced,

  // Record processing error
  recordProcessingError: EventSourcingIntegration.recordProcessingError,
};

// Default export for convenience
export default RealtimeMonitoring;
