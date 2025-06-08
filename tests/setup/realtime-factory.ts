/**
 * Real-time Monitoring Test Factory
 * Synthetic data helpers for testing real-time monitoring
 * Based on Charlie's implementation blueprint for LUM-585
 */

import {
  RealtimeMetricEvent,
  ConnectionEvent,
  ThroughputEvent,
  ResourceMetrics,
  QueueMetrics,
} from '@/lib/monitoring/collectors';

// Factory for generating connection events
export function generateConnectionEvent(
  overrides: Partial<ConnectionEvent> = {}
): ConnectionEvent {
  const defaults: ConnectionEvent = {
    type: 'connected',
    connectionId: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId: `user_${Math.random().toString(36).substring(2, 9)}`,
    userAgent: 'Mozilla/5.0 (Test Browser)',
    ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
    timestamp: new Date().toISOString(),
  };

  return { ...defaults, ...overrides };
}

// Factory for generating throughput events
export function generateThroughputEvent(
  overrides: Partial<ThroughputEvent> = {}
): ThroughputEvent {
  const defaults: ThroughputEvent = {
    type: 'message_sent',
    size: Math.floor(Math.random() * 1024) + 100, // 100-1124 bytes
    channel: `channel_${Math.random().toString(36).substring(2, 7)}`,
    messageType: 'data',
    userId: `user_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  return { ...defaults, ...overrides };
}

// Factory for generating resource metrics
export function generateResourceMetrics(
  overrides: Partial<ResourceMetrics> = {}
): ResourceMetrics {
  const memoryUsage = Math.random() * 1024 * 1024 * 1024; // Up to 1GB
  const cpuUsage = Math.random() * 100; // 0-100%

  const defaults: ResourceMetrics = {
    memory: {
      rss: memoryUsage,
      heapUsed: memoryUsage * 0.7,
      heapTotal: memoryUsage * 0.8,
      external: memoryUsage * 0.1,
      arrayBuffers: memoryUsage * 0.05,
      percentage: (memoryUsage / (8 * 1024 * 1024 * 1024)) * 100, // Assume 8GB total
    },
    cpu: {
      usage: cpuUsage,
      loadAverage: [1.2, 1.5, 1.8],
      userTime: Math.random() * 1000000,
      systemTime: Math.random() * 1000000,
    },
    process: {
      uptime: Math.random() * 86400, // Up to 24 hours
      pid: Math.floor(Math.random() * 65535),
      ppid: Math.floor(Math.random() * 65535),
      platform: 'linux',
      arch: 'x64',
    },
    system: {
      totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
      freeMemory: Math.random() * 2 * 1024 * 1024 * 1024, // Up to 2GB free
      cpuCount: 4,
    },
  };

  return { ...defaults, ...overrides };
}

// Factory for generating queue metrics
export function generateQueueMetrics(
  overrides: Partial<QueueMetrics> = {}
): QueueMetrics {
  const depth = Math.floor(Math.random() * 1000);

  const defaults: QueueMetrics = {
    queueName: `queue_${Math.random().toString(36).substring(2, 7)}`,
    depth,
    maxDepth: depth + Math.floor(Math.random() * 100),
    processingRate: Math.random() * 100, // 0-100 items/sec
    averageWaitTime: Math.random() * 5000, // 0-5 seconds
    oldestItemAge: Math.random() * 10000, // 0-10 seconds
    totalProcessed: Math.floor(Math.random() * 10000),
    totalDropped: Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString(),
  };

  return { ...defaults, ...overrides };
}

// Factory for generating latency metrics
export function generateLatencyMetric(
  overrides: Partial<RealtimeMetricEvent> = {}
): RealtimeMetricEvent {
  const latency = Math.random() * 1000; // 0-1000ms

  const defaults: RealtimeMetricEvent = {
    id: `metric_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    name: 'response_time',
    value: latency,
    unit: 'ms',
    tags: {
      endpoint: `/api/v1/endpoint_${Math.floor(Math.random() * 10)}`,
      method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
      status: Math.random() > 0.1 ? '200' : '500', // 90% success rate
    },
  };

  return { ...defaults, ...overrides };
}

// Factory for generating error metrics
export function generateErrorMetric(
  type: string = 'api_error',
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): RealtimeMetricEvent {
  return {
    id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    name: 'error_count',
    value: 1,
    unit: 'count',
    tags: {
      error_type: type,
      severity,
      component: `component_${Math.floor(Math.random() * 5)}`,
    },
    metadata: {
      error_message: `Test error message for ${type}`,
      stack_trace: 'Error\n    at test (test.js:1:1)',
    },
  };
}

// Factory for generating batch metrics
export function generateMetricBatch(
  count: number = 10,
  metricType: 'latency' | 'error' | 'throughput' = 'latency'
): RealtimeMetricEvent[] {
  const metrics: RealtimeMetricEvent[] = [];

  for (let i = 0; i < count; i++) {
    switch (metricType) {
      case 'latency':
        metrics.push(generateLatencyMetric());
        break;
      case 'error':
        metrics.push(generateErrorMetric());
        break;
      case 'throughput':
        metrics.push({
          id: `throughput_${Date.now()}_${i}`,
          timestamp: new Date().toISOString(),
          name: 'messages_per_second',
          value: Math.random() * 1000,
          unit: 'rate',
          tags: {
            channel: `channel_${i % 3}`,
          },
        });
        break;
    }
  }

  return metrics;
}

// Helper to generate realistic time series data
export function generateTimeSeriesMetrics(
  metricName: string,
  duration: number = 3600000, // 1 hour in ms
  interval: number = 60000, // 1 minute in ms
  baseValue: number = 100,
  variance: number = 20
): RealtimeMetricEvent[] {
  const metrics: RealtimeMetricEvent[] = [];
  const startTime = Date.now() - duration;
  const endTime = startTime + duration; // Fix: Capture end time once

  for (let time = startTime; time <= endTime; time += interval) {
    const value = baseValue + (Math.random() - 0.5) * variance * 2;

    metrics.push({
      id: `${metricName}_${time}`,
      timestamp: new Date(time).toISOString(),
      name: metricName,
      value: Math.max(0, value), // Ensure non-negative
      unit: 'count',
      tags: {
        source: 'test',
      },
    });
  }

  return metrics;
}

// Helper to generate load test scenario
export function generateLoadTestScenario(
  duration: number = 60000, // 1 minute
  connectionsPerSecond: number = 10,
  messagesPerConnection: number = 5
): {
  connectionEvents: ConnectionEvent[];
  throughputEvents: ThroughputEvent[];
} {
  const connectionEvents: ConnectionEvent[] = [];
  const throughputEvents: ThroughputEvent[] = [];
  const connections: string[] = [];

  // Fix: Guard against pathological input and use integer math
  const rawInterval = 1000 / connectionsPerSecond;
  const interval = Math.max(1, Math.floor(rawInterval)); // Minimum 1ms interval
  const startTime = Date.now();

  for (let time = 0; time < duration; time += interval) {
    const connectionId = `load_test_conn_${connections.length}`;
    connections.push(connectionId);

    // Connection established
    connectionEvents.push(
      generateConnectionEvent({
        type: 'connected',
        connectionId,
        timestamp: new Date(startTime + time).toISOString(),
      })
    );

    // Generate messages for this connection
    for (let msg = 0; msg < messagesPerConnection; msg++) {
      const msgTime = time + msg * 100; // Spread messages over 500ms
      if (msgTime < duration) {
        throughputEvents.push(
          generateThroughputEvent({
            type: 'message_sent',
            timestamp: new Date(startTime + msgTime).toISOString(),
          })
        );
      }
    }

    // Some connections disconnect
    if (Math.random() > 0.7 && connections.length > 0) {
      const disconnectingConn = connections.splice(
        Math.floor(Math.random() * connections.length),
        1
      )[0];

      connectionEvents.push(
        generateConnectionEvent({
          type: 'disconnected',
          connectionId: disconnectingConn,
          timestamp: new Date(startTime + time + 500).toISOString(),
        })
      );
    }
  }

  // Disconnect remaining connections
  connections.forEach((connectionId, index) => {
    connectionEvents.push(
      generateConnectionEvent({
        type: 'disconnected',
        connectionId,
        timestamp: new Date(startTime + duration + index * 10).toISOString(),
      })
    );
  });

  return { connectionEvents, throughputEvents };
}

// Helper to create test configuration
export function createTestConfig(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    retentionDays: 1,
    samplingRate: 1.0,
    storage: {
      type: 'inmemory',
      batchSize: 10,
      maxRetries: 1,
    },
    alerts: {
      enabled: false,
      cooldownMs: 1000,
      channels: [],
    },
    collectors: {
      connection: {
        enabled: true,
        sampleRate: 1.0,
      },
      throughput: {
        enabled: true,
        sampleRate: 1.0,
        aggregationWindow: 1000,
      },
      resource: {
        enabled: true,
        sampleInterval: 1000,
      },
      queueDepth: {
        enabled: true,
        sampleInterval: 1000,
      },
    },
    ...overrides,
  };
}
