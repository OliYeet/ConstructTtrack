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
  createTestConfig,
} from '../../setup/realtime-factory';

// Mock the configuration
jest.mock('@/lib/monitoring/config/realtime-config', () => ({
  realtimeConfig: createTestConfig(),
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
      const customCollector = new ConnectionCollector();
      customCollector.id = 'custom-connection-collector';

      integration.registerCollector(customCollector);

      expect(integration.getCollector('custom-connection-collector')).toBe(
        customCollector
      );
      expect(integration.stats.collectorsRegistered).toBeGreaterThan(0);

      const success = integration.unregisterCollector(
        'custom-connection-collector'
      );
      expect(success).toBe(true);
      expect(
        integration.getCollector('custom-connection-collector')
      ).toBeUndefined();
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
    });

    it('should process connection metrics', done => {
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

        // Give some time for async processing
        setTimeout(() => {
          expect(metricSpy).toHaveBeenCalled();
          expect(integration.stats.totalMetricsCollected).toBeGreaterThan(0);
          done();
        }, 100);
      } else {
        done();
      }
    });

    it('should process throughput metrics', done => {
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

        setTimeout(() => {
          expect(metricSpy).toHaveBeenCalled();
          expect(integration.stats.totalMetricsCollected).toBeGreaterThan(0);
          done();
        }, 100);
      } else {
        done();
      }
    });

    it('should handle high-volume metrics', done => {
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

        setTimeout(() => {
          expect(metricSpy).toHaveBeenCalled();
          expect(integration.stats.totalMetricsCollected).toBeGreaterThan(50);
          done();
        }, 1000);
      } else {
        done();
      }
    }, 10000); // Increase timeout for load test
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

    it('should emit error events', done => {
      const errorSpy = jest.fn();
      integration.on('error', errorSpy);

      // Trigger an error by registering a collector with duplicate ID
      const collector1 = new ConnectionCollector();
      const collector2 = new ConnectionCollector();

      integration.registerCollector(collector1);

      try {
        integration.registerCollector(collector2);
      } catch {
        // Expected to throw
      }

      setTimeout(() => {
        expect(errorSpy).toHaveBeenCalled();
        expect(integration.stats.totalErrors).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle metrics within performance thresholds', done => {
      const startTime = Date.now();
      const metricCount = 1000;
      let processedCount = 0;

      const metricSpy = jest.fn(() => {
        processedCount++;
        if (processedCount === metricCount) {
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Should process 1000 metrics in less than 1 second
          expect(duration).toBeLessThan(1000);
          done();
        }
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
      } else {
        done();
      }
    }, 5000);
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should not leak memory during normal operation', done => {
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

        setTimeout(() => {
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = finalMemory - initialMemory;

          // Memory increase should be reasonable (less than 50MB)
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
          done();
        }, 1000);
      } else {
        done();
      }
    }, 10000);
  });
});
