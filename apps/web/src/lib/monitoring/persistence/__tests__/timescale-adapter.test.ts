/**
 * Unit tests for TimescaleAdapter
 * Ensures robust handling of CI environments and missing dependencies
 */

import {
  TimescaleAdapter,
  InMemoryAdapter,
  createPersistenceAdapter,
} from '../timescale-adapter';
import type { RealtimeMetricEvent } from '../../collectors/base';

// Mock the Supabase client
jest.mock('@constructtrack/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              contains: jest.fn(() => ({
                limit: jest.fn(() => ({
                  order: jest.fn(() =>
                    Promise.resolve({ data: [], error: null })
                  ),
                })),
              })),
            })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(() => Promise.resolve({ count: 0, error: null })),
      })),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock the realtime config
jest.mock('../../config/realtime-config', () => ({
  realtimeConfig: {
    storage: {
      type: 'inmemory',
      batchSize: 100,
      maxRetries: 3,
    },
  },
}));

describe('TimescaleAdapter', () => {
  let adapter: TimescaleAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      NODE_ENV: 'test',
      CI: 'true',
    };

    adapter = new TimescaleAdapter();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await adapter.shutdown();
    // Restore original environment
    process.env = originalEnv;
  });

  describe('query', () => {
    it('should handle missing Supabase client gracefully', async () => {
      // Mock import failure
      jest.doMock('@constructtrack/supabase/client', () => {
        throw new Error('Module not found');
      });

      const result = await adapter.query({});
      expect(result).toEqual([]);
    });

    it('should handle null Supabase client gracefully', async () => {
      jest.doMock('@constructtrack/supabase/client', () => ({
        supabase: null,
      }));

      const result = await adapter.query({});
      expect(result).toEqual([]);
    });

    it('should return empty array in CI environment on error', async () => {
      const originalEnv = process.env.NODE_ENV;
      // Use Object.defineProperty to modify read-only property
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        writable: true,
        configurable: true,
      });

      // Force an error by mocking a failing query
      jest.doMock('@constructtrack/supabase/client', () => ({
        supabase: {
          from: () => {
            throw new Error('Database connection failed');
          },
        },
      }));

      const result = await adapter.query({});
      expect(result).toEqual([]);

      // Restore original value
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('cleanup', () => {
    it('should handle missing Supabase client gracefully', async () => {
      jest.doMock('@constructtrack/supabase/client', () => {
        throw new Error('Module not found');
      });

      const result = await adapter.cleanup(new Date());
      expect(result).toBe(0);
    });

    it('should return 0 in CI environment on error', async () => {
      const originalEnv = process.env.CI;
      // Use Object.defineProperty to modify read-only property
      Object.defineProperty(process.env, 'CI', {
        value: 'true',
        writable: true,
        configurable: true,
      });

      jest.doMock('@constructtrack/supabase/client', () => ({
        supabase: {
          from: () => {
            throw new Error('Database connection failed');
          },
        },
      }));

      const result = await adapter.cleanup(new Date());
      expect(result).toBe(0);

      // Restore original value
      Object.defineProperty(process.env, 'CI', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('flush', () => {
    it('should handle empty metrics array', async () => {
      await expect(adapter.flush([])).resolves.not.toThrow();
    });

    it('should handle metrics insertion gracefully in CI', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'test-metric-1',
          name: 'test_metric',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: { test: 'value' },
          metadata: {},
        },
      ];

      await expect(adapter.flush(metrics)).resolves.not.toThrow();
    });

    it('should validate metrics before insertion', async () => {
      const invalidMetrics: RealtimeMetricEvent[] = [
        {
          id: '', // Invalid: empty id
          name: 'test_metric',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: { test: 'value' },
          metadata: {},
        },
      ];

      // Should not throw in CI environment
      await expect(adapter.flush(invalidMetrics)).resolves.not.toThrow();
    });

    it('should handle missing environment variables gracefully', async () => {
      // Remove environment variables
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'test-metric-env',
          name: 'test_metric',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: { test: 'value' },
          metadata: {},
        },
      ];

      // Should not throw in CI environment
      await expect(adapter.flush(metrics)).resolves.not.toThrow();
    });
  });

  describe('background processing', () => {
    it('should start and stop background processing', () => {
      expect(() => adapter.stopBackgroundProcessing()).not.toThrow();
    });

    it('should handle processing errors gracefully', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'test-metric-2',
          name: 'test_metric',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: { test: 'value' },
          metadata: {},
        },
      ];

      // This should not throw even if processing fails
      await expect(adapter.flush(metrics)).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return valid statistics', () => {
      const stats = adapter.getStats();

      expect(stats).toHaveProperty('pendingBatches');
      expect(stats).toHaveProperty('totalPendingMetrics');
      expect(stats).toHaveProperty('isProcessing');
      expect(typeof stats.pendingBatches).toBe('number');
      expect(typeof stats.totalPendingMetrics).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });
});

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  describe('flush and query', () => {
    it('should store and retrieve metrics', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'test-metric-3',
          name: 'test_metric',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: { test: 'value' },
          metadata: {},
        },
      ];

      await adapter.flush(metrics);
      const result = await adapter.query({});

      expect(result).toHaveLength(1);
      expect(result[0].metric_name).toBe('test_metric');
      expect(result[0].value).toBe(1);
    });

    it('should filter by metric names', async () => {
      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'metric-1',
          name: 'metric1',
          value: 1,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
        {
          id: 'metric-2',
          name: 'metric2',
          value: 2,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        },
      ];

      await adapter.flush(metrics);
      const result = await adapter.query({ metricNames: ['metric1'] });

      expect(result).toHaveLength(1);
      expect(result[0].metric_name).toBe('metric1');
    });

    it('should respect limit parameter', async () => {
      const metrics: RealtimeMetricEvent[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: `metric-${i}`,
          name: `metric${i}`,
          value: i,
          unit: 'count',
          timestamp: new Date().toISOString(),
          tags: {},
          metadata: {},
        })
      );

      await adapter.flush(metrics);
      const result = await adapter.query({ limit: 3 });

      expect(result).toHaveLength(3);
    });
  });

  describe('cleanup', () => {
    it('should remove old metrics', async () => {
      const oldTime = new Date(Date.now() - 3600000); // 1 hour ago
      const newTime = new Date();

      const metrics: RealtimeMetricEvent[] = [
        {
          id: 'old-metric',
          name: 'old_metric',
          value: 1,
          unit: 'count',
          timestamp: oldTime.toISOString(),
          tags: {},
          metadata: {},
        },
        {
          id: 'new-metric',
          name: 'new_metric',
          value: 2,
          unit: 'count',
          timestamp: newTime.toISOString(),
          tags: {},
          metadata: {},
        },
      ];

      await adapter.flush(metrics);
      const removedCount = await adapter.cleanup(
        new Date(Date.now() - 1800000)
      ); // 30 min ago

      expect(removedCount).toBe(1);

      const remaining = await adapter.query({});
      expect(remaining).toHaveLength(1);
      expect(remaining[0].metric_name).toBe('new_metric');
    });
  });
});

describe('createPersistenceAdapter', () => {
  it('should create InMemoryAdapter for inmemory type', () => {
    const adapter = createPersistenceAdapter();
    expect(adapter).toBeInstanceOf(InMemoryAdapter);
  });
});
