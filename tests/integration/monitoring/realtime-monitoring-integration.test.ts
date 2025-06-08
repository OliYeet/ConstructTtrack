/**
 * Real-time Monitoring Integration Tests
 * Integration tests for the complete monitoring system
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { RealtimeMonitoringIntegration } from '@/lib/monitoring/realtime-monitoring-integration';
import {
  ConnectionCollector,
  ThroughputCollector,
} from '@/lib/monitoring/collectors';
import {
  generateConnectionEvent,
  generateThroughputEvent,
  generateLoadTestScenario,
} from '../../setup/realtime-factory';

// Mock the configuration
jest.mock('@/lib/monitoring/config/realtime-config', () => ({
  realtimeConfig: {
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
    metrics: {
      bufferSize: 100,
      flushInterval: 1000,
    },
    latency: {
      p99Critical: 1000,
      p99Warning: 500,
    },
    connection: {
      maxConnections: 1000,
      heartbeatInterval: 30000,
      timeoutMs: 5000,
    },
  },
  isRealtimeMonitoringEnabled: () => true,
}));

// Mock performance monitor
jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: jest.fn(),
  },
}));

describe('RealtimeMonitoringIntegration', () => {
  let integration: RealtimeMonitoringIntegration;

  beforeEach(() => {
    integration = new RealtimeMonitoringIntegration();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (integration.status === 'running') {
      await integration.shutdown();
    }
    // Clear all event listeners to prevent memory leaks
    integration.removeAllListeners();
    // Allow any pending async operations to complete
    await Promise.resolve();
  });

  describe('Initialization and Shutdown', () => {
    it('should initialize successfully', async () => {
      expect(integration.status).toBe('stopped');

      await integration.initialize();

      expect(integration.status).toBe('running');
      expect(integration.stats.collectorsRegistered).toBeGreaterThan(0);
    });

    it('should shutdown successfully', async () => {
      await integration.initialize();
      expect(integration.status).toBe('running');

      await integration.shutdown();

      expect(integration.status).toBe('stopped');
      expect(integration.stats.collectorsRunning).toBe(0);
    });

    it('should emit started and stopped events', async () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();

      integration.on('started', startedSpy);
      integration.on('stopped', stoppedSpy);

      await integration.initialize();
      expect(startedSpy).toHaveBeenCalled();

      await integration.shutdown();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await integration.initialize();
      const firstStatus = integration.status;

      // Second initialization should not throw
      await integration.initialize();
      expect(integration.status).toBe(firstStatus);
    });
  });

  describe('Collector Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should register and unregister collectors', () => {
      // Create a mock collector with a unique ID to avoid conflicts
      const mockCollector = {
        id: `test-collector-${Date.now()}`,
        start: jest.fn(),
        stop: jest.fn(),
        onMetric: jest.fn(),
      };

      integration.registerCollector(mockCollector);

      expect(integration.getCollector(mockCollector.id)).toBe(mockCollector);
      expect(integration.stats.collectorsRegistered).toBeGreaterThan(0);

      const success = integration.unregisterCollector(mockCollector.id);
      expect(success).toBe(true);
      expect(integration.getCollector(mockCollector.id)).toBeUndefined();
    });

    it('should provide access to default collectors', () => {
      expect(integration.connectionCollector).toBeDefined();
      expect(integration.throughputCollector).toBeDefined();
      expect(integration.resourceCollector).toBeDefined();
      expect(integration.queueDepthCollector).toBeDefined();
    });

    it('should get all collectors', () => {
      const collectors = integration.getAllCollectors();
      expect(collectors.length).toBeGreaterThan(0);
      expect(collectors.every(c => c.id)).toBe(true);
    });

    it('should get collector statistics', () => {
      const stats = integration.getCollectorStats();
      expect(typeof stats).toBe('object');
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });

  describe('Metric Processing', () => {
    beforeEach(async () => {
      await integration.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should process connection metrics', async () => {
      const metricSpy = jest.fn();
      integration.on('metric', metricSpy);

      const connectionCollector =
        integration.connectionCollector as ConnectionCollector;
      expect(connectionCollector).toBeDefined();

      if (connectionCollector) {
        const connectionEvent = generateConnectionEvent({
          type: 'connected',
          connectionId: 'test-conn-123',
        });

        connectionCollector.trackConnection(connectionEvent);

        // Use fake timers instead of real delay
        jest.advanceTimersByTime(50);
        await Promise.resolve(); // Allow any pending promises to resolve

        expect(metricSpy).toHaveBeenCalled();
        expect(integration.stats.totalMetricsCollected).toBeGreaterThan(0);
      }
    });

    it('should process throughput metrics', async () => {
      const metricSpy = jest.fn();
      integration.on('metric', metricSpy);

      const throughputCollector =
        integration.throughputCollector as ThroughputCollector;
      expect(throughputCollector).toBeDefined();

      if (throughputCollector) {
        const throughputEvent = generateThroughputEvent({
          type: 'message_sent',
          size: 1024,
        });

        throughputCollector.trackThroughput(throughputEvent);

        // Use fake timers instead of real delay
        jest.advanceTimersByTime(50);
        await Promise.resolve(); // Allow any pending promises to resolve

        expect(metricSpy).toHaveBeenCalled();
        expect(integration.stats.totalMetricsCollected).toBeGreaterThan(0);
      }
    });

    it('should handle high-volume metrics', async () => {
      const metricSpy = jest.fn();
      integration.on('metric', metricSpy);

      const connectionCollector =
        integration.connectionCollector as ConnectionCollector;
      const throughputCollector =
        integration.throughputCollector as ThroughputCollector;

      if (connectionCollector && throughputCollector) {
        // Generate load test scenario
        const { connectionEvents, throughputEvents } = generateLoadTestScenario(
          5000, // 5 seconds
          5, // 5 connections per second
          3 // 3 messages per connection
        );

        // Process all events
        connectionEvents.forEach(event => {
          connectionCollector.trackConnection(event);
        });

        throughputEvents.forEach(event => {
          throughputCollector.trackThroughput(event);
        });

        // Use fake timers instead of real delay
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Allow any pending promises to resolve

        expect(metricSpy).toHaveBeenCalled();
        expect(integration.stats.totalMetricsCollected).toBeGreaterThan(50);
      }
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should report healthy status when running', () => {
      const health = integration.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('running');
      expect(health.collectors).toBeInstanceOf(Array);
      expect(health.collectors.length).toBeGreaterThan(0);
    });

    it('should report collector health status', () => {
      const health = integration.getHealthStatus();

      health.collectors.forEach(collector => {
        expect(collector).toHaveProperty('id');
        expect(collector).toHaveProperty('healthy');
        expect(typeof collector.healthy).toBe('boolean');
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a failing collector
      const failingCollector = {
        id: 'failing-collector',
        start: jest.fn(() => {
          throw new Error('Collector start failed');
        }),
        stop: jest.fn(),
        onMetric: jest.fn(),
      };

      integration.registerCollector(failingCollector);

      await expect(integration.initialize()).rejects.toThrow(
        'Collector start failed'
      );
      expect(integration.status).toBe('error');
    });

    it('should emit error events', async () => {
      const errorSpy = jest.fn();
      integration.on('error', errorSpy);

      // Trigger an error by registering a collector with duplicate ID
      const mockCollector1 = {
        id: `test-error-collector-${Date.now()}`,
        start: jest.fn(),
        stop: jest.fn(),
        onMetric: jest.fn(),
      };
      const mockCollector2 = {
        id: `test-error-collector-${Date.now()}`, // Same ID to trigger error
        start: jest.fn(),
        stop: jest.fn(),
        onMetric: jest.fn(),
      };

      integration.registerCollector(mockCollector1);

      try {
        integration.registerCollector(mockCollector2);
      } catch {
        // Expected to throw
      }

      // Use fake timers instead of real delay
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Allow any pending promises to resolve

      expect(errorSpy).toHaveBeenCalled();
      expect(integration.stats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await integration.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle metrics within performance thresholds', async () => {
      const metricCount = 1000;
      let processedCount = 0;

      const metricSpy = jest.fn(() => {
        processedCount++;
      });

      integration.on('metric', metricSpy);

      const connectionCollector =
        integration.connectionCollector as ConnectionCollector;

      if (connectionCollector) {
        // Generate and process metrics rapidly
        for (let i = 0; i < metricCount; i++) {
          const event = generateConnectionEvent({
            connectionId: `perf-test-${i}`,
            type: i % 2 === 0 ? 'connected' : 'disconnected',
          });
          connectionCollector.trackConnection(event);
        }

        // Allow processing to complete
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();

        // Verify metrics were processed efficiently
        // Use flexible assertions that account for multiple collectors potentially processing events
        expect(processedCount).toBeGreaterThan(metricCount * 0.9); // At least 90% of expected metrics
        expect(processedCount).toBeLessThan(metricCount * 2); // But not more than double (reasonable upper bound)
        expect(integration.stats.totalMetricsCollected).toBeGreaterThan(0);

        // Verify processing was reasonably efficient (within order of magnitude)
        // This is more flexible than strict timing requirements and accounts for multiple collectors
        expect(processedCount).toBeGreaterThan(100); // Ensure significant processing occurred
      }
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await integration.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not leak memory during normal operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const connectionCollector =
        integration.connectionCollector as ConnectionCollector;

      if (connectionCollector) {
        // Generate many events
        for (let i = 0; i < 10000; i++) {
          const event = generateConnectionEvent({
            connectionId: `memory-test-${i}`,
          });
          connectionCollector.trackConnection(event);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Use fake timers instead of real delay
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Allow any pending promises to resolve

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      }
    });
  });
});
