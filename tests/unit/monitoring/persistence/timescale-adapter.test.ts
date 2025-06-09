/**
 * TimescaleAdapter Tests
 * Tests for the TimescaleDB persistence adapter, focusing on batch processing
 * and the fix for recursive stack overflow issues.
 */

import {
  TimescaleAdapter,
  InMemoryAdapter,
} from '../../../../apps/web/src/lib/monitoring/persistence/timescale-adapter';
import { RealtimeMetricEvent } from '../../../../apps/web/src/lib/monitoring/collectors/base';

// Mock the Supabase client
const mockUpsert = jest.fn(() => Promise.resolve({ error: null }));
const mockFrom = jest.fn(() => ({
  upsert: mockUpsert,
}));

jest.mock('@constructtrack/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock the realtime config
jest.mock(
  '../../../../apps/web/src/lib/monitoring/config/realtime-config',
  () => ({
    realtimeConfig: {
      storage: {
        batchSize: 100,
        maxRetries: 3,
        flushInterval: 1000,
      },
    },
  })
);

describe('TimescaleAdapter', () => {
  let adapter: TimescaleAdapter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUpsert.mockClear();
    mockFrom.mockClear();

    adapter = new TimescaleAdapter();
    // Stop background processing for controlled testing
    adapter.stopBackgroundProcessing();
  });

  afterEach(() => {
    jest.useRealTimers();
    adapter.stopBackgroundProcessing();
  });

  describe('Batch Processing - Stack Overflow Fix', () => {
    it('should process many batches without stack overflow', async () => {
      // Create a large number of batches to simulate high load
      const batchCount = 100;
      const metricsPerBatch = 10;

      const promises: Promise<void>[] = [];

      // Add many batches rapidly
      for (let i = 0; i < batchCount; i++) {
        const metrics: RealtimeMetricEvent[] = [];
        for (let j = 0; j < metricsPerBatch; j++) {
          metrics.push({
            id: `test_metric_${i}_${j}_${Date.now()}`,
            name: `test_metric_${i}_${j}`,
            value: Math.random() * 100,
            unit: 'count',
            timestamp: new Date().toISOString(),
            tags: { batch: i.toString(), metric: j.toString() },
            metadata: { test: true },
          });
        }

        // Add batch without awaiting to simulate rapid additions
        promises.push(adapter.flush(metrics));
      }

      // Process all batches
      await Promise.all(promises);

      // Verify all batches were processed
      const stats = adapter.getStats();
      expect(stats.pendingBatches).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });

    it('should handle continuous batch additions during processing', async () => {
      let processedBatches = 0;
      const totalBatches = 50;

      // Mock processBatch to track processing and add delay
      const originalProcessBatch = (
        adapter as unknown as {
          processBatch: (_batch: unknown) => Promise<void>;
        }
      ).processBatch;
      (adapter as unknown as { processBatch: jest.Mock }).processBatch =
        jest.fn(async batch => {
          processedBatches++;
          // Small delay to simulate processing time
          await new Promise(resolve => setTimeout(resolve, 1));
          return originalProcessBatch.call(adapter, batch);
        });

      // Start processing batches
      const addBatchesPromise = (async () => {
        for (let i = 0; i < totalBatches; i++) {
          const metrics: RealtimeMetricEvent[] = [
            {
              id: `continuous_metric_${i}_${Date.now()}`,
              name: `continuous_metric_${i}`,
              value: i,
              unit: 'count',
              timestamp: new Date().toISOString(),
              tags: { iteration: i.toString() },
              metadata: {},
            },
          ];

          await adapter.flush(metrics);

          // Small delay between additions
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      })();

      await addBatchesPromise;

      // Verify all batches were processed
      expect(processedBatches).toBe(totalBatches);

      const stats = adapter.getStats();
      expect(stats.pendingBatches).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });

    it('should handle batch processing errors without infinite recursion', async () => {
      // Mock insertMetrics to always fail to test that we don't get infinite recursion
      let callCount = 0;

      // Mock the insertMetrics method to simulate failure
      const mockInsertMetrics = jest.fn(async (_metrics: unknown) => {
        callCount++;
        throw new Error(`Simulated failure ${callCount}`);
      });

      (adapter as unknown as { insertMetrics: jest.Mock }).insertMetrics =
        mockInsertMetrics;

      const metrics: RealtimeMetricEvent[] = [
        {
          id: `error_test_metric_${Date.now()}`,
          name: 'error_test_metric',
          value: 42,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
      ];

      // This should not cause infinite recursion - it should fail once and schedule retries
      const startTime = Date.now();
      await adapter.flush(metrics);
      const endTime = Date.now();

      // The key test: flush should complete quickly without infinite recursion
      // If there was infinite recursion, this would take much longer or timeout
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second

      // The initial call should complete without infinite recursion
      const stats = adapter.getStats();
      expect(stats.isProcessing).toBe(false);

      // Should have been called once initially (retries are scheduled asynchronously)
      expect(mockInsertMetrics).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);

      // The batch should be scheduled for retry (not immediately retried in a loop)
      // We can verify this by checking that only one call happened during flush
      expect(mockInsertMetrics).toHaveBeenCalledTimes(1);
    });

    it('should respect processing flag to prevent concurrent processing', async () => {
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      // Mock processPendingBatches to track concurrency and prevent actual recursion

      (
        adapter as unknown as { processPendingBatches: jest.Mock }
      ).processPendingBatches = jest.fn(async function () {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);

        try {
          // Simulate processing without calling the original method to prevent stack overflow
          await new Promise(resolve => setTimeout(resolve, 1));
          return Promise.resolve();
        } finally {
          concurrentCalls--;
        }
      });

      // Add multiple batches simultaneously
      const promises = Array.from({ length: 10 }, (_, i) => {
        const metrics: RealtimeMetricEvent[] = [
          {
            id: `concurrent_metric_${i}_${Date.now()}_${Math.random()}`,
            name: `concurrent_metric_${i}`,
            value: i,
            unit: 'count',
            timestamp: new Date().toISOString(),
            tags: { index: i.toString() },
            metadata: {},
          },
        ];
        return adapter.flush(metrics);
      });

      await Promise.all(promises);

      // Should never have more than 1 concurrent processing call
      expect(maxConcurrentCalls).toBe(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: `stats_test_metric_${Date.now()}`,
          name: 'stats_test_metric',
          value: 100,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
      ];

      // Add a batch but don't process it yet
      const statsBeforeProcessing = adapter.getStats();
      expect(statsBeforeProcessing.pendingBatches).toBe(0);
      expect(statsBeforeProcessing.totalPendingMetrics).toBe(0);
      expect(statsBeforeProcessing.isProcessing).toBe(false);

      // Add batch and check stats
      await adapter.flush(metrics);

      const statsAfterProcessing = adapter.getStats();
      expect(statsAfterProcessing.isProcessing).toBe(false);
      expect(statsAfterProcessing.pendingBatches).toBe(0);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should properly shutdown and flush pending batches', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: `shutdown_test_metric_${Date.now()}`,
          name: 'shutdown_test_metric',
          value: 200,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
      ];

      await adapter.flush(metrics);
      await adapter.shutdown();

      const stats = adapter.getStats();
      expect(stats.pendingBatches).toBe(0);
      expect(stats.isProcessing).toBe(false);
    });
  });
});

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it('should store and retrieve metrics correctly', async () => {
    const metrics: RealtimeMetricEvent[] = [
      {
        id: `memory_test_metric_1_${Date.now()}`,
        name: 'memory_test_metric_1',
        value: 10,
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { type: 'test' },
        metadata: {},
      },
      {
        id: `memory_test_metric_2_${Date.now()}`,
        name: 'memory_test_metric_2',
        value: 20,
        unit: 'ms',
        timestamp: new Date().toISOString(),
        tags: { type: 'test' },
        metadata: {},
      },
    ];

    await adapter.flush(metrics);

    const queryResult = await adapter.query({
      metricNames: ['memory_test_metric_1'],
      limit: 10,
    });

    expect(queryResult).toHaveLength(1);
    expect(queryResult[0].metric_name).toBe('memory_test_metric_1');
    expect(queryResult[0].value).toBe(10);
  });

  it('should respect size limits', async () => {
    const adapter = new InMemoryAdapter();
    (adapter as unknown as { maxSize: number }).maxSize = 5; // Set small limit for testing

    // Add more metrics than the limit
    for (let i = 0; i < 10; i++) {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: `limit_test_metric_${i}_${Date.now()}`,
          name: `limit_test_metric_${i}`,
          value: i,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
      ];
      await adapter.flush(metrics);
    }

    const allMetrics = adapter.getMetrics();
    expect(allMetrics.length).toBe(5); // Should be limited to maxSize
  });
});
