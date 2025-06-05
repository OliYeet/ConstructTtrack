/**
 * Real-time Performance Metrics Types
 * 
 * Defines interfaces and types for monitoring real-time WebSocket and 
 * event-driven performance in ConstructTrack's fiber installation workflows.
 * 
 * Based on Charlie's strategic plan (LUM-582):
 * - P90/P99 latency from DB commit → client receive (<250ms goal)
 * - Alert if error ratio >1% or average latency >500ms for 5 min
 */

import { EVENT_TYPES } from '../../../../../src/types/realtime-protocol';

// Real-time event latency tracking
export interface RealtimeLatencyMetric {
  eventId: string;
  eventType: typeof EVENT_TYPES[number];
  timestamps: {
    dbCommit?: number;          // Database commit timestamp
    eventSourced?: number;      // Event sourcing log timestamp
    websocketSent?: number;     // WebSocket gateway send timestamp
    clientReceived?: number;    // Client acknowledgment timestamp
  };
  latencies: {
    dbToEventSource?: number;   // DB commit → event sourcing
    eventSourceToWs?: number;   // Event sourcing → WebSocket
    wsToClient?: number;        // WebSocket → client
    endToEnd?: number;          // Total DB commit → client receive
  };
  metadata: {
    userId?: string;
    organizationId?: string;
    workOrderId?: string;
    sectionId?: string;
    channel?: string;
    messageSize?: number;
  };
}

// WebSocket connection metrics
export interface WebSocketConnectionMetric {
  connectionId: string;
  userId?: string;
  organizationId?: string;
  timestamps: {
    connectionStart: number;
    connectionEstablished?: number;
    lastActivity: number;
    disconnected?: number;
  };
  metrics: {
    connectionTime?: number;    // Time to establish connection
    totalDuration?: number;     // Total connection duration
    messagesSent: number;
    messagesReceived: number;
    bytesTransferred: number;
    reconnectionAttempts: number;
  };
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: {
    code: string;
    message: string;
    timestamp: number;
  };
}

// Real-time subscription metrics
export interface RealtimeSubscriptionMetric {
  subscriptionId: string;
  channel: string;
  userId?: string;
  organizationId?: string;
  timestamps: {
    subscribed: number;
    unsubscribed?: number;
  };
  metrics: {
    eventsReceived: number;
    averageEventSize: number;
    lastEventTimestamp?: number;
  };
  filters?: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
}

// Real-time error tracking
export interface RealtimeErrorMetric {
  errorId: string;
  timestamp: number;
  type: 'connection' | 'message' | 'subscription' | 'processing';
  severity: 'warning' | 'error' | 'critical';
  code: string;
  message: string;
  context: {
    userId?: string;
    organizationId?: string;
    connectionId?: string;
    eventId?: string;
    channel?: string;
  };
  metadata?: Record<string, unknown>;
}

// Performance statistics for percentile calculations
export interface RealtimePerformanceStats {
  totalEvents: number;
  timeWindow: {
    start: number;
    end: number;
    durationMs: number;
  };
  latencyStats: {
    endToEnd: PercentileStats;
    dbToEventSource: PercentileStats;
    eventSourceToWs: PercentileStats;
    wsToClient: PercentileStats;
  };
  connectionStats: {
    totalConnections: number;
    activeConnections: number;
    averageConnectionTime: number;
    connectionSuccessRate: number;
  };
  errorStats: {
    totalErrors: number;
    errorRate: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  };
  throughputStats: {
    eventsPerSecond: number;
    bytesPerSecond: number;
    messagesPerSecond: number;
  };
}

// Percentile statistics
export interface PercentileStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  standardDeviation: number;
}

// Real-time alert thresholds (based on Charlie's requirements)
export interface RealtimeAlertThresholds {
  latency: {
    endToEndP99Warning: number;     // Default: 250ms (Charlie's goal)
    endToEndP99Critical: number;    // Default: 500ms
    averageWarning: number;         // Default: 200ms
    averageCritical: number;        // Default: 500ms (Charlie's 5min threshold)
  };
  errorRate: {
    warningThreshold: number;       // Default: 0.5% (0.005)
    criticalThreshold: number;      // Default: 1% (0.01) - Charlie's threshold
  };
  connections: {
    maxConnectionTime: number;      // Default: 5000ms
    maxReconnectionAttempts: number; // Default: 5
    minSuccessRate: number;         // Default: 95% (0.95)
  };
  throughput: {
    minEventsPerSecond: number;     // Default: 1
    maxEventsPerSecond: number;     // Default: 1000
    maxMessageSize: number;         // Default: 1MB
  };
}

// Alert configuration
export interface RealtimeAlertConfig {
  enabled: boolean;
  thresholds: RealtimeAlertThresholds;
  evaluationWindow: number;          // Time window for alert evaluation (ms)
  cooldownPeriod: number;           // Minimum time between alerts (ms)
  channels: {
    email?: string[];
    webhook?: string[];
    slack?: string[];
  };
}

// Real-time monitoring configuration
export interface RealtimeMonitoringConfig {
  enabled: boolean;
  metricsRetentionPeriod: number;   // How long to keep metrics in memory (ms)
  maxMetricsInMemory: number;       // Maximum number of metrics to store
  samplingRate: number;             // Percentage of events to sample (0-1)
  enableLatencyTracking: boolean;
  enableConnectionTracking: boolean;
  enableSubscriptionTracking: boolean;
  enableErrorTracking: boolean;
  alertConfig: RealtimeAlertConfig;
  performanceStatsInterval: number; // How often to calculate stats (ms)
}

// Default configuration based on Charlie's requirements
export const defaultRealtimeMonitoringConfig: RealtimeMonitoringConfig = {
  enabled: true,
  metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  maxMetricsInMemory: 100000, // 100k metrics
  samplingRate: 1.0, // Sample all events initially
  enableLatencyTracking: true,
  enableConnectionTracking: true,
  enableSubscriptionTracking: true,
  enableErrorTracking: true,
  performanceStatsInterval: 60 * 1000, // 1 minute
  alertConfig: {
    enabled: true,
    evaluationWindow: 5 * 60 * 1000, // 5 minutes (Charlie's requirement)
    cooldownPeriod: 15 * 60 * 1000,  // 15 minutes between alerts
    thresholds: {
      latency: {
        endToEndP99Warning: 250,      // Charlie's goal: <250ms
        endToEndP99Critical: 500,     // Charlie's alert threshold
        averageWarning: 200,
        averageCritical: 500,         // Charlie's 5min threshold
      },
      errorRate: {
        warningThreshold: 0.005,      // 0.5%
        criticalThreshold: 0.01,      // 1% - Charlie's threshold
      },
      connections: {
        maxConnectionTime: 5000,      // 5 seconds
        maxReconnectionAttempts: 5,
        minSuccessRate: 0.95,         // 95%
      },
      throughput: {
        minEventsPerSecond: 0.1,
        maxEventsPerSecond: 1000,
        maxMessageSize: 1024 * 1024,  // 1MB
      },
    },
    channels: {
      // Configure based on deployment environment
    },
  },
};

// Metric collection events
export type RealtimeMetricEvent = 
  | { type: 'latency'; metric: RealtimeLatencyMetric }
  | { type: 'connection'; metric: WebSocketConnectionMetric }
  | { type: 'subscription'; metric: RealtimeSubscriptionMetric }
  | { type: 'error'; metric: RealtimeErrorMetric };

// Performance monitoring events
export type RealtimeMonitoringEvent =
  | { type: 'stats_calculated'; stats: RealtimePerformanceStats }
  | { type: 'alert_triggered'; alert: RealtimeAlert }
  | { type: 'threshold_exceeded'; threshold: ThresholdExceeded };

// Alert types
export interface RealtimeAlert {
  id: string;
  timestamp: number;
  type: 'latency' | 'error_rate' | 'connection' | 'throughput';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: number;
}

// Threshold exceeded event
export interface ThresholdExceeded {
  metric: string;
  threshold: number;
  actualValue: number;
  severity: 'warning' | 'critical';
  timestamp: number;
  context: Record<string, unknown>;
}
