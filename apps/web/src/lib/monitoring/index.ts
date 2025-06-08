/**
 * Real-time Monitoring Module
 * Main export file for the real-time monitoring system
 * Based on Charlie's implementation blueprint for LUM-585
 */

// Configuration exports
export {
  realtimeConfig,
  isRealtimeMonitoringEnabled,
  getCollectorConfig,
  getStorageConfig,
  getAlertConfig,
  reloadRealtimeConfig,
  type RealtimeMonitoringConfig,
} from './config/realtime-config';

export {
  RealtimeConfigSchema,
  validateRealtimeConfig,
  isValidRealtimeConfig,
  type RealtimeConfigType,
} from './config/schema';

export {
  defaultRealtimeMonitoringConfig,
  developmentOverrides,
  productionOverrides,
} from './config/defaults';

// Collector exports
export {
  // Base collector types and interfaces
  type RealtimeMetricCollector,
  type ExtendedRealtimeMetricCollector,
  type RealtimeMetricEvent,
  type CollectorStatus,
  type CollectorStats,
  BaseRealtimeCollector,
  CollectorRegistry,
  type CollectorFactory,

  // Specific collectors
  ConnectionCollector,
  ThroughputCollector,
  ResourceCollector,
  QueueDepthCollector,

  // Collector types
  type ConnectionEvent,
  type ConnectionEventType,
  type ConnectionStats,
  type ThroughputEvent,
  type ThroughputEventType,
  type ThroughputStats,
  type ResourceMetrics,
  type ResourceStats,
  type QueueMetrics,
  type QueueStats,

  // Factory and utilities
  DefaultCollectorFactory,
  defaultCollectors,
  collectorRegistry,
  createCollectorRegistry,
  createDefaultCollectors,
  registerDefaultCollectors,

  // Utility functions
  isExtendedCollector,
  isBaseCollector,
  getCollectorStats,
  isCollectorRunning,
  startCollector,
  stopCollector,
  startAllCollectors,
  stopAllCollectors,
  getAllCollectorStats,
  getRunningCollectors,
  getStoppedCollectors,
  checkCollectorHealth,
  checkAllCollectorsHealth,
  getUnhealthyCollectors,
} from './collectors';

// Integration exports
export {
  RealtimeMonitoringIntegration,
  realtimeMonitoringIntegration,
  type IntegrationStatus,
  type IntegrationStats,
  type IntegrationEvents,
} from './realtime-monitoring-integration';

// Persistence exports
export {
  TimescaleAdapter,
  InMemoryAdapter,
  createPersistenceAdapter,
  persistenceAdapter,
  type MetricPersistenceAdapter,
  type QueryOptions,
  type MetricQueryResult,
} from './persistence/timescale-adapter';

// Performance monitor (existing)
export { performanceMonitor } from './performance-monitor';

// Convenience functions for common use cases
export function initializeRealtimeMonitoring(): Promise<void> {
  return realtimeMonitoringIntegration.initialize();
}

export function shutdownRealtimeMonitoring(): Promise<void> {
  return realtimeMonitoringIntegration.shutdown();
}

export function getMonitoringHealth() {
  return realtimeMonitoringIntegration.getHealthStatus();
}

export function getMonitoringStats() {
  return {
    integration: realtimeMonitoringIntegration.stats,
    collectors: realtimeMonitoringIntegration.getCollectorStats(),
  };
}

// Quick access to collectors
export function getConnectionCollector(): ConnectionCollector | undefined {
  return realtimeMonitoringIntegration.connectionCollector as ConnectionCollector;
}

export function getThroughputCollector(): ThroughputCollector | undefined {
  return realtimeMonitoringIntegration.throughputCollector as ThroughputCollector;
}

export function getResourceCollector(): ResourceCollector | undefined {
  return realtimeMonitoringIntegration.resourceCollector as ResourceCollector;
}

export function getQueueDepthCollector(): QueueDepthCollector | undefined {
  return realtimeMonitoringIntegration.queueDepthCollector as QueueDepthCollector;
}

// Convenience functions for tracking events
export function trackConnection(event: ConnectionEvent): void {
  const collector = getConnectionCollector();
  if (collector) {
    collector.trackConnection(event);
  }
}

export function trackThroughput(event: ThroughputEvent): void {
  const collector = getThroughputCollector();
  if (collector) {
    collector.trackThroughput(event);
  }
}

export function trackMessageSent(
  size: number,
  channel?: string,
  messageType?: string,
  userId?: string
): void {
  const collector = getThroughputCollector();
  if (collector) {
    collector.trackMessageSent(size, channel, messageType, userId);
  }
}

export function trackMessageReceived(
  size: number,
  channel?: string,
  messageType?: string,
  userId?: string
): void {
  const collector = getThroughputCollector();
  if (collector) {
    collector.trackMessageReceived(size, channel, messageType, userId);
  }
}

export function trackEventProcessed(
  channel?: string,
  eventType?: string,
  userId?: string
): void {
  const collector = getThroughputCollector();
  if (collector) {
    collector.trackEventProcessed(channel, eventType, userId);
  }
}

export function enqueueItem(
  queueName: string,
  itemId: string,
  size?: number,
  priority?: number,
  metadata?: Record<string, unknown>
): void {
  const collector = getQueueDepthCollector();
  if (collector) {
    collector.enqueueItem(queueName, itemId, size, priority, metadata);
  }
}

export function dequeueItem(queueName: string, itemId?: string): unknown {
  const collector = getQueueDepthCollector();
  if (collector) {
    return collector.dequeueItem(queueName, itemId);
  }
  return undefined;
}

export function dropItem(
  queueName: string,
  itemId: string,
  reason?: string
): boolean {
  const collector = getQueueDepthCollector();
  if (collector) {
    return collector.dropItem(queueName, itemId, reason);
  }
  return false;
}

// Type guards for runtime type checking
export function isConnectionEvent(event: unknown): event is ConnectionEvent {
  return (
    event &&
    typeof event.type === 'string' &&
    typeof event.connectionId === 'string' &&
    typeof event.timestamp === 'string'
  );
}

export function isThroughputEvent(event: unknown): event is ThroughputEvent {
  return (
    event &&
    typeof event.type === 'string' &&
    typeof event.size === 'number' &&
    typeof event.timestamp === 'string'
  );
}

export function isRealtimeMetricEvent(
  event: unknown
): event is RealtimeMetricEvent {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.name === 'string' &&
    typeof event.value === 'number' &&
    typeof event.unit === 'string' &&
    typeof event.tags === 'object'
  );
}

// Error types for better error handling
export class RealtimeMonitoringError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'RealtimeMonitoringError';
  }
}

export class CollectorError extends RealtimeMonitoringError {
  constructor(
    message: string,
    public readonly collectorId: string
  ) {
    super(message, 'COLLECTOR_ERROR');
    this.name = 'CollectorError';
  }
}

export class PersistenceError extends RealtimeMonitoringError {
  constructor(
    message: string,
    public readonly operation?: string
  ) {
    super(message, 'PERSISTENCE_ERROR');
    this.name = 'PersistenceError';
  }
}

// Version information
export const REALTIME_MONITORING_VERSION = '1.0.0';
export const SUPPORTED_FEATURES = [
  'connection_tracking',
  'throughput_monitoring',
  'resource_monitoring',
  'queue_depth_tracking',
  'timescale_persistence',
  'real_time_alerts',
  'continuous_aggregates',
  'retention_policies',
] as const;

export type SupportedFeature = (typeof SUPPORTED_FEATURES)[number];

export function isFeatureSupported(
  feature: string
): feature is SupportedFeature {
  return SUPPORTED_FEATURES.includes(feature as SupportedFeature);
}
