/**
 * API Performance Monitoring Tests
 * Tests the performance monitoring, analysis, and alerting system
 */

import {
  MemoryPerformanceStore,
  PerformanceMonitor,
  PerformanceMetric,
  PerformanceThreshold,
  defaultPerformanceThresholds,
} from '../performance-monitoring';
import { NextRequest, NextResponse } from 'next/server';

describe('API Performance Monitoring System', () => {
  let performanceStore: MemoryPerformanceStore;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceStore = new MemoryPerformanceStore();
    performanceMonitor = new PerformanceMonitor(performanceStore);
  });

  describe('MemoryPerformanceStore', () => {
    it('should record and retrieve performance metrics', async () => {
      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        endpoint: '/api/v1/projects',
        method: 'GET',
        responseTime: 250,
        requestSize: 0,
        responseSize: 1024,
        statusCode: 200,
        traceId: 'trace-123',
      };

      await performanceStore.recordMetric(metric);

      const metrics = await performanceStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    it('should filter metrics by time range', async () => {
      const now = Date.now();
      const metric1: PerformanceMetric = {
        timestamp: now - 10000,
        endpoint: '/api/v1/projects',
        method: 'GET',
        responseTime: 200,
        requestSize: 0,
        responseSize: 512,
        statusCode: 200,
        traceId: 'trace-1',
      };

      const metric2: PerformanceMetric = {
        timestamp: now,
        endpoint: '/api/v1/tasks',
        method: 'POST',
        responseTime: 300,
        requestSize: 256,
        responseSize: 1024,
        statusCode: 201,
        traceId: 'trace-2',
      };

      await performanceStore.recordMetric(metric1);
      await performanceStore.recordMetric(metric2);

      const recentMetrics = await performanceStore.getMetrics({
        startTime: now - 5000,
      });

      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].endpoint).toBe('/api/v1/tasks');
    });

    it('should filter metrics by endpoint', async () => {
      const metrics: PerformanceMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/projects',
          method: 'GET',
          responseTime: 200,
          requestSize: 0,
          responseSize: 512,
          statusCode: 200,
          traceId: 'trace-1',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/tasks',
          method: 'GET',
          responseTime: 150,
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: 'trace-2',
        },
      ];

      for (const metric of metrics) {
        await performanceStore.recordMetric(metric);
      }

      const projectMetrics = await performanceStore.getMetrics({
        endpoint: '/api/v1/projects',
      });

      expect(projectMetrics).toHaveLength(1);
      expect(projectMetrics[0].endpoint).toBe('/api/v1/projects');
    });

    it('should filter metrics by response time range', async () => {
      const metrics: PerformanceMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 100,
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: 'trace-1',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 500,
          requestSize: 0,
          responseSize: 512,
          statusCode: 200,
          traceId: 'trace-2',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 1000,
          requestSize: 0,
          responseSize: 1024,
          statusCode: 200,
          traceId: 'trace-3',
        },
      ];

      for (const metric of metrics) {
        await performanceStore.recordMetric(metric);
      }

      const slowMetrics = await performanceStore.getMetrics({
        minResponseTime: 400,
      });

      expect(slowMetrics).toHaveLength(2);
      expect(slowMetrics.every(m => m.responseTime >= 400)).toBe(true);
    });

    it('should generate performance analysis', async () => {
      const metrics: PerformanceMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 100,
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: 'trace-1',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 200,
          requestSize: 0,
          responseSize: 512,
          statusCode: 200,
          traceId: 'trace-2',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime: 300,
          requestSize: 0,
          responseSize: 1024,
          statusCode: 500,
          traceId: 'trace-3',
        },
      ];

      for (const metric of metrics) {
        await performanceStore.recordMetric(metric);
      }

      const analysis = await performanceStore.getAnalysis(
        '/api/v1/test',
        'GET'
      );

      expect(analysis.endpoint).toBe('/api/v1/test');
      expect(analysis.method).toBe('GET');
      expect(analysis.metrics.requestCount).toBe(3);
      expect(analysis.metrics.averageResponseTime).toBe(200); // (100 + 200 + 300) / 3
      expect(analysis.metrics.errorRate).toBeCloseTo(33.33, 1); // 1 error out of 3 requests
      expect(analysis.trends).toBeDefined();
      expect(analysis.bottlenecks).toBeInstanceOf(Array);
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate percentiles correctly', async () => {
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      const metrics: PerformanceMetric[] = responseTimes.map(
        (responseTime, index) => ({
          timestamp: Date.now(),
          endpoint: '/api/v1/test',
          method: 'GET',
          responseTime,
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: `trace-${index}`,
        })
      );

      for (const metric of metrics) {
        await performanceStore.recordMetric(metric);
      }

      const analysis = await performanceStore.getAnalysis(
        '/api/v1/test',
        'GET'
      );

      expect(analysis.metrics.p50ResponseTime).toBe(500); // 50th percentile
      expect(analysis.metrics.p95ResponseTime).toBe(1000); // 95th percentile (corrected)
      expect(analysis.metrics.p99ResponseTime).toBe(1000); // 99th percentile (corrected)
    });

    it('should cleanup old metrics', async () => {
      const oldMetric: PerformanceMetric = {
        timestamp: Date.now() - 10000,
        endpoint: '/api/v1/old',
        method: 'GET',
        responseTime: 100,
        requestSize: 0,
        responseSize: 256,
        statusCode: 200,
        traceId: 'trace-old',
      };

      const newMetric: PerformanceMetric = {
        timestamp: Date.now(),
        endpoint: '/api/v1/new',
        method: 'GET',
        responseTime: 100,
        requestSize: 0,
        responseSize: 256,
        statusCode: 200,
        traceId: 'trace-new',
      };

      await performanceStore.recordMetric(oldMetric);
      await performanceStore.recordMetric(newMetric);

      await performanceStore.cleanup(Date.now() - 5000);

      const metrics = await performanceStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].endpoint).toBe('/api/v1/new');
    });
  });

  describe('PerformanceMonitor', () => {
    it('should add performance thresholds', () => {
      const threshold: PerformanceThreshold = {
        endpoint: '/api/v1/test',
        method: 'GET',
        responseTimeMs: 1000,
        severity: 'warning',
      };

      performanceMonitor.addThreshold(threshold);
      expect(performanceMonitor['thresholds']).toContain(threshold);
    });

    it('should create middleware that records performance metrics', async () => {
      const middleware = performanceMonitor.createMiddleware();

      const request = new NextRequest('http://localhost:3000/api/v1/test', {
        method: 'GET',
      });

      const mockHandler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
        return NextResponse.json({ success: true });
      });

      const response = await middleware(request, mockHandler);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Response-Time')).toMatch(/^\d+ms$/);
      expect(response.headers.get('X-Trace-ID')).toMatch(/^trace-/);

      // Check that metric was recorded
      const metrics = await performanceStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].endpoint).toBe('/api/test'); // Version is normalized out
      expect(metrics[0].method).toBe('GET');
      expect(metrics[0].statusCode).toBe(200);
      expect(metrics[0].responseTime).toBeGreaterThan(0);
      expect(metrics[0].traceId).toMatch(/^trace-/);
    });

    it('should handle errors in middleware', async () => {
      const middleware = performanceMonitor.createMiddleware();

      const request = new NextRequest('http://localhost:3000/api/v1/error', {
        method: 'POST',
      });

      const mockHandler = jest.fn(async () => {
        throw new Error('Test error');
      });

      const response = await middleware(request, mockHandler);

      expect(response.status).toBe(500);

      // Check that error metric was recorded
      const metrics = await performanceStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].statusCode).toBe(500);
    });

    it('should trigger alerts when thresholds are exceeded', async () => {
      const threshold: PerformanceThreshold = {
        endpoint: '/api/v1/slow',
        responseTimeMs: 500,
        severity: 'warning',
      };

      performanceMonitor.addThreshold(threshold);

      const slowMetric: PerformanceMetric = {
        timestamp: Date.now(),
        endpoint: '/api/v1/slow',
        method: 'GET',
        responseTime: 1000, // Exceeds threshold
        requestSize: 0,
        responseSize: 256,
        statusCode: 200,
        traceId: 'trace-slow',
      };

      // Simulate threshold checking
      await performanceMonitor['checkThresholds'](slowMetric);

      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].endpoint).toBe('/api/v1/slow');
      expect(activeAlerts[0].severity).toBe('warning');
      expect(activeAlerts[0].actualValue).toBe(1000);
    });

    it('should resolve alerts', () => {
      // Add a mock alert
      const alert = {
        id: 'alert-123',
        timestamp: Date.now(),
        endpoint: '/api/v1/test',
        method: 'GET',
        threshold: {
          endpoint: '/api/v1/test',
          responseTimeMs: 500,
          severity: 'warning' as const,
        },
        actualValue: 1000,
        severity: 'warning' as const,
        message: 'Test alert',
        resolved: false,
        resolvedAt: undefined as number | undefined,
      };

      performanceMonitor['alerts'].push(alert);

      expect(performanceMonitor.getActiveAlerts()).toHaveLength(1);

      performanceMonitor.resolveAlert('alert-123');

      expect(performanceMonitor.getActiveAlerts()).toHaveLength(0);
      expect(alert.resolved).toBe(true);
      expect(alert.resolvedAt).toBeDefined();
    });
  });

  describe('Default Performance Thresholds', () => {
    it('should have predefined performance thresholds', () => {
      expect(defaultPerformanceThresholds).toHaveLength(4);

      const projectsWarning = defaultPerformanceThresholds.find(
        t => t.endpoint === '/api/v1/projects' && t.severity === 'warning'
      );
      expect(projectsWarning).toBeDefined();
      expect(projectsWarning?.responseTimeMs).toBe(2000);

      const projectsCritical = defaultPerformanceThresholds.find(
        t => t.endpoint === '/api/v1/projects' && t.severity === 'critical'
      );
      expect(projectsCritical).toBeDefined();
      expect(projectsCritical?.responseTimeMs).toBe(5000);
    });

    it('should have valid threshold configurations', () => {
      defaultPerformanceThresholds.forEach(threshold => {
        expect(threshold.endpoint).toBeTruthy();
        expect(typeof threshold.responseTimeMs).toBe('number');
        expect(threshold.responseTimeMs).toBeGreaterThan(0);
        expect(['warning', 'critical']).toContain(threshold.severity);
      });
    });
  });

  describe('Performance Analysis Features', () => {
    it('should identify bottlenecks correctly', async () => {
      const slowMetrics: PerformanceMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/slow',
          method: 'GET',
          responseTime: 3000, // Very slow
          dbQueryTime: 2000, // Slow DB query
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: 'trace-1',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/slow',
          method: 'GET',
          responseTime: 2500,
          dbQueryTime: 1500,
          memoryUsage: 600, // High memory usage
          requestSize: 0,
          responseSize: 256,
          statusCode: 200,
          traceId: 'trace-2',
        },
      ];

      for (const metric of slowMetrics) {
        await performanceStore.recordMetric(metric);
      }

      const analysis = await performanceStore.getAnalysis(
        '/api/v1/slow',
        'GET'
      );

      expect(analysis.bottlenecks).toContain(
        'High average response time (>2s)'
      );
      expect(analysis.bottlenecks).toContain(
        'Slow database queries (>1s average)'
      );
      expect(analysis.bottlenecks).toContain('High memory usage detected');
    });

    it('should generate appropriate recommendations', async () => {
      const problematicMetrics: PerformanceMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/problematic',
          method: 'GET',
          responseTime: 2000, // Slow
          dbQueryCount: 15, // Many queries
          requestSize: 0,
          responseSize: 2 * 1024 * 1024, // Large response (2MB)
          statusCode: 500, // Error
          traceId: 'trace-1',
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/v1/problematic',
          method: 'GET',
          responseTime: 1500,
          dbQueryCount: 12,
          requestSize: 0,
          responseSize: 1.5 * 1024 * 1024,
          statusCode: 200,
          traceId: 'trace-2',
        },
      ];

      for (const metric of problematicMetrics) {
        await performanceStore.recordMetric(metric);
      }

      const analysis = await performanceStore.getAnalysis(
        '/api/v1/problematic',
        'GET'
      );

      expect(analysis.recommendations).toContain(
        'Consider implementing caching for frequently accessed data'
      );
      expect(analysis.recommendations).toContain(
        'Reduce N+1 query problems by using eager loading'
      );
      expect(analysis.recommendations).toContain(
        'Investigate and fix high error rate'
      );
      expect(analysis.recommendations).toContain(
        'Consider response compression for large payloads'
      );
    });
  });
});
