/**
 * Real-time Monitoring Collectors
 * Export all collectors and utilities
 * Based on Charlie's implementation blueprint for LUM-585
 */

// Base collector exports
export {
  type RealtimeMetricCollector,
  type ExtendedRealtimeMetricCollector,
  type RealtimeMetricEvent,
  type CollectorStatus,
  type CollectorStats,
  BaseRealtimeCollector,
  CollectorRegistry,
  type CollectorFactory,
} from './base';

// Import types for internal use
import type {
  RealtimeMetricCollector,
  ExtendedRealtimeMetricCollector,
  CollectorStatus,
  CollectorStats,
  CollectorFactory,
} from './base';
import { BaseRealtimeCollector, CollectorRegistry } from './base';
import { ConnectionCollector } from './connection-collector';
import { QueueDepthCollector } from './queue-depth-collector';
import { ResourceCollector } from './resource-collector';
import { ThroughputCollector } from './throughput-collector';

// Connection collector exports
export {
  ConnectionCollector,
  type ConnectionEvent,
  type ConnectionEventType,
  type ConnectionStats,
} from './connection-collector';
// Queue depth collector exports
export {
  QueueDepthCollector,
  type QueueMetrics,
  type QueueStats,
} from './queue-depth-collector';
// Resource collector exports
export {
  ResourceCollector,
  type ResourceMetrics,
  type ResourceStats,
} from './resource-collector';
// Throughput collector exports
export {
  ThroughputCollector,
  type ThroughputEvent,
  type ThroughputEventType,
  type ThroughputStats,
} from './throughput-collector';

// Collector factory implementations
export class DefaultCollectorFactory implements CollectorFactory {
  create(
    id: string,
    _config: Record<string, unknown>
  ): RealtimeMetricCollector {
    switch (id) {
      case 'connection':
        return new ConnectionCollector();
      case 'throughput':
        return new ThroughputCollector();
      case 'resource':
        return new ResourceCollector();
      case 'queue-depth':
        return new QueueDepthCollector();
      default:
        throw new Error(`Unknown collector type: ${id}`);
    }
  }
}

// Default collector instances
export const defaultCollectors = {
  connection: new ConnectionCollector(),
  throughput: new ThroughputCollector(),
  resource: new ResourceCollector(),
  queueDepth: new QueueDepthCollector(),
};

// Collector registry instance
export const collectorRegistry = new CollectorRegistry();

// Register default collectors
Object.values(defaultCollectors).forEach(collector => {
  collectorRegistry.register(collector);
});

// Utility functions
export function createCollectorRegistry(): CollectorRegistry {
  return new CollectorRegistry();
}

export function createDefaultCollectors(): typeof defaultCollectors {
  return {
    connection: new ConnectionCollector(),
    throughput: new ThroughputCollector(),
    resource: new ResourceCollector(),
    queueDepth: new QueueDepthCollector(),
  };
}

export function registerDefaultCollectors(registry: CollectorRegistry): void {
  const collectors = createDefaultCollectors();
  Object.values(collectors).forEach(collector => {
    registry.register(collector);
  });
}

// Collector type guards
export function isExtendedCollector(
  collector: RealtimeMetricCollector
): collector is ExtendedRealtimeMetricCollector {
  return (
    'status' in collector && 'stats' in collector && 'isRunning' in collector
  );
}

export function isBaseCollector(
  collector: RealtimeMetricCollector
): collector is BaseRealtimeCollector {
  return collector instanceof BaseRealtimeCollector;
}

// Collector utilities
export function getCollectorStats(
  collector: RealtimeMetricCollector
): CollectorStats | null {
  if (isExtendedCollector(collector)) {
    return collector.getStats();
  }
  return null;
}

export function isCollectorRunning(
  collector: RealtimeMetricCollector
): boolean {
  if (isExtendedCollector(collector)) {
    return collector.isRunning();
  }
  return false;
}

export function startCollector(collector: RealtimeMetricCollector): void {
  try {
    collector.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to start collector ${collector.id}:`, error);
    throw error;
  }
}

export function stopCollector(collector: RealtimeMetricCollector): void {
  try {
    collector.stop();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to stop collector ${collector.id}:`, error);
    throw error;
  }
}

export function startAllCollectors(registry: CollectorRegistry): void {
  const collectors = registry.getAll();
  const errors: Array<{ id: string; error: Error }> = [];

  for (const collector of collectors) {
    try {
      startCollector(collector);
    } catch (error) {
      errors.push({
        id: collector.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (errors.length > 0) {
    const errorMessage = errors
      .map(e => `${e.id}: ${e.error.message}`)
      .join(', ');
    throw new Error(`Failed to start collectors: ${errorMessage}`);
  }
}

export function stopAllCollectors(registry: CollectorRegistry): void {
  const collectors = registry.getAll();
  const errors: Array<{ id: string; error: Error }> = [];

  for (const collector of collectors) {
    try {
      stopCollector(collector);
    } catch (error) {
      errors.push({
        id: collector.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (errors.length > 0) {
    const errorMessage = errors
      .map(e => `${e.id}: ${e.error.message}`)
      .join(', ');
    // eslint-disable-next-line no-console
    console.warn(`Some collectors failed to stop: ${errorMessage}`);
  }
}

export function getAllCollectorStats(
  registry: CollectorRegistry
): Record<string, CollectorStats | null> {
  const collectors = registry.getAll();
  const stats: Record<string, CollectorStats | null> = {};

  for (const collector of collectors) {
    stats[collector.id] = getCollectorStats(collector);
  }

  return stats;
}

export function getRunningCollectors(
  registry: CollectorRegistry
): RealtimeMetricCollector[] {
  return registry.getAll().filter(collector => isCollectorRunning(collector));
}

export function getStoppedCollectors(
  registry: CollectorRegistry
): RealtimeMetricCollector[] {
  return registry.getAll().filter(collector => !isCollectorRunning(collector));
}

// Health check utilities
export function checkCollectorHealth(collector: RealtimeMetricCollector): {
  id: string;
  healthy: boolean;
  status?: CollectorStatus;
  lastError?: string;
  metricsCollected?: number;
} {
  const stats = getCollectorStats(collector);
  const isRunning = isCollectorRunning(collector);

  return {
    id: collector.id,
    healthy: isRunning && (!stats || stats.errorsCount === 0),
    status: stats?.status,
    lastError: stats?.lastError,
    metricsCollected: stats?.metricsCollected,
  };
}

export function checkAllCollectorsHealth(
  registry: CollectorRegistry
): Array<ReturnType<typeof checkCollectorHealth>> {
  return registry.getAll().map(collector => checkCollectorHealth(collector));
}

export function getUnhealthyCollectors(
  registry: CollectorRegistry
): Array<ReturnType<typeof checkCollectorHealth>> {
  return checkAllCollectorsHealth(registry).filter(health => !health.healthy);
}
