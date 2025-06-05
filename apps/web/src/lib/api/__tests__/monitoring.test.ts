/**
 * API Monitoring Tests
 * Tests the monitoring, metrics collection, and alerting system
 */

import {
  MemoryMetricsStore,
  AlertManager,
  MetricsCollector,
  ApiMetric,
  AlertRule,
  defaultAlertRules,
} from '../monitoring';
import { NextRequest, NextResponse } from 'next/server';

describe('API Monitoring System', () => {
  let metricsStore: MemoryMetricsStore;
  let alertManager: AlertManager;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsStore = new MemoryMetricsStore();
    alertManager = new AlertManager();
    metricsCollector = new MetricsCollector(metricsStore, alertManager);
  });

  describe('MemoryMetricsStore', () => {
    it('should record and retrieve metrics', async () => {
      const metric: ApiMetric = {
        timestamp: Date.now(),
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        requestSize: 0,
        responseSize: 1024,
        userId: 'user-123',
      };

      await metricsStore.recordMetric(metric);

      const metrics = await metricsStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    it('should filter metrics by time range', async () => {
      const now = Date.now();
      const metric1: ApiMetric = {
        timestamp: now - 10000,
        endpoint: '/api/test1',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        requestSize: 0,
        responseSize: 512,
      };

      const metric2: ApiMetric = {
        timestamp: now,
        endpoint: '/api/test2',
        method: 'POST',
        statusCode: 201,
        responseTime: 200,
        requestSize: 256,
        responseSize: 1024,
      };

      await metricsStore.recordMetric(metric1);
      await metricsStore.recordMetric(metric2);

      const recentMetrics = await metricsStore.getMetrics({
        startTime: now - 5000,
      });

      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].endpoint).toBe('/api/test2');
    });

    it('should filter metrics by endpoint', async () => {
      const metric1: ApiMetric = {
        timestamp: Date.now(),
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        requestSize: 0,
        responseSize: 512,
      };

      const metric2: ApiMetric = {
        timestamp: Date.now(),
        endpoint: '/api/projects',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        requestSize: 0,
        responseSize: 1024,
      };

      await metricsStore.recordMetric(metric1);
      await metricsStore.recordMetric(metric2);

      const userMetrics = await metricsStore.getMetrics({
        endpoint: '/api/users',
      });

      expect(userMetrics).toHaveLength(1);
      expect(userMetrics[0].endpoint).toBe('/api/users');
    });

    it('should generate metrics summary', async () => {
      const metrics: ApiMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
          requestSize: 0,
          responseSize: 512,
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 500,
          responseTime: 200,
          requestSize: 0,
          responseSize: 256,
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/other',
          method: 'POST',
          statusCode: 201,
          responseTime: 150,
          requestSize: 128,
          responseSize: 1024,
        },
      ];

      for (const metric of metrics) {
        await metricsStore.recordMetric(metric);
      }

      const summary = await metricsStore.getSummary({});

      expect(summary.totalRequests).toBe(3);
      expect(summary.averageResponseTime).toBe(150); // (100 + 200 + 150) / 3
      expect(summary.errorRate).toBe(33.33333333333333); // 1 error out of 3 requests
      expect(summary.statusCodeDistribution['200']).toBe(1);
      expect(summary.statusCodeDistribution['500']).toBe(1);
      expect(summary.statusCodeDistribution['201']).toBe(1);
      expect(summary.endpointStats['GET /api/test'].count).toBe(2);
      expect(summary.endpointStats['POST /api/other'].count).toBe(1);
    });

    it('should cleanup old metrics', async () => {
      const oldMetric: ApiMetric = {
        timestamp: Date.now() - 10000,
        endpoint: '/api/old',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        requestSize: 0,
        responseSize: 512,
      };

      const newMetric: ApiMetric = {
        timestamp: Date.now(),
        endpoint: '/api/new',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        requestSize: 0,
        responseSize: 512,
      };

      await metricsStore.recordMetric(oldMetric);
      await metricsStore.recordMetric(newMetric);

      await metricsStore.cleanup(Date.now() - 5000);

      const metrics = await metricsStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].endpoint).toBe('/api/new');
    });
  });

  describe('AlertManager', () => {
    it('should add and remove alert rules', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        condition: 'response_time',
        threshold: 1000,
        operator: 'gt',
        timeWindow: 5,
        enabled: true,
        notificationChannels: ['email'],
      };

      alertManager.addRule(rule);
      expect(alertManager['rules']).toHaveLength(1);

      alertManager.removeRule('test-rule');
      expect(alertManager['rules']).toHaveLength(0);
    });

    it('should evaluate response time alerts', async () => {
      const rule: AlertRule = {
        id: 'high-response-time',
        name: 'High Response Time',
        condition: 'response_time',
        threshold: 500,
        operator: 'gt',
        timeWindow: 5,
        enabled: true,
        notificationChannels: ['email'],
      };

      alertManager.addRule(rule);

      // Add metrics that should trigger the alert
      const metrics: ApiMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/slow',
          method: 'GET',
          statusCode: 200,
          responseTime: 1000, // Above threshold
          requestSize: 0,
          responseSize: 512,
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/slow',
          method: 'GET',
          statusCode: 200,
          responseTime: 800, // Above threshold
          requestSize: 0,
          responseSize: 512,
        },
      ];

      for (const metric of metrics) {
        await metricsStore.recordMetric(metric);
      }

      const alerts = await alertManager.checkAlerts(metricsStore);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].ruleName).toBe('High Response Time');
      expect(alerts[0].severity).toBe('medium'); // 900ms average is 1.8x threshold
    });

    it('should evaluate error rate alerts', async () => {
      const rule: AlertRule = {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate',
        threshold: 25, // 25%
        operator: 'gt',
        timeWindow: 5,
        enabled: true,
        notificationChannels: ['slack'],
      };

      alertManager.addRule(rule);

      // Add metrics with 50% error rate
      const metrics: ApiMetric[] = [
        {
          timestamp: Date.now(),
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 100,
          requestSize: 0,
          responseSize: 512,
        },
        {
          timestamp: Date.now(),
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 500,
          responseTime: 100,
          requestSize: 0,
          responseSize: 256,
        },
      ];

      for (const metric of metrics) {
        await metricsStore.recordMetric(metric);
      }

      const alerts = await alertManager.checkAlerts(metricsStore);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].ruleName).toBe('High Error Rate');
      expect(alerts[0].message).toContain('50.00%');
    });

    it('should resolve alerts', () => {
      const alert = {
        id: 'alert-123',
        ruleId: 'rule-1',
        ruleName: 'Test Alert',
        message: 'Test alert message',
        severity: 'medium' as const,
        timestamp: Date.now(),
        resolved: false,
        metadata: {},
      };

      alertManager['alerts'].push(alert);

      expect(alertManager.getActiveAlerts()).toHaveLength(1);

      alertManager.resolveAlert('alert-123');

      expect(alertManager.getActiveAlerts()).toHaveLength(0);
      expect(alert.resolved).toBe(true);
      expect(alert.resolvedAt).toBeDefined();
    });
  });

  describe('MetricsCollector', () => {
    it('should create middleware that records metrics', async () => {
      const middleware = metricsCollector.createMiddleware();

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const mockHandler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
        return NextResponse.json({ success: true });
      });

      const response = await middleware(request, mockHandler);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);

      // Check that metric was recorded
      const metrics = await metricsStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].endpoint).toBe('/api/test');
      expect(metrics[0].method).toBe('GET');
      expect(metrics[0].statusCode).toBe(200);
      expect(metrics[0].responseTime).toBeGreaterThan(0);
    });

    it('should handle errors in middleware', async () => {
      const middleware = metricsCollector.createMiddleware();

      const request = new NextRequest('http://localhost:3000/api/error', {
        method: 'POST',
      });

      const mockHandler = jest.fn(async () => {
        throw new Error('Test error');
      });

      const response = await middleware(request, mockHandler);

      expect(response.status).toBe(500);

      // Check that error metric was recorded
      const metrics = await metricsStore.getMetrics({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].statusCode).toBe(500);
      expect(metrics[0].error).toBe('Test error');
    });
  });

  describe('Default Alert Rules', () => {
    it('should have predefined alert rules', () => {
      expect(defaultAlertRules).toHaveLength(3);

      const responseTimeRule = defaultAlertRules.find(
        r => r.id === 'high-response-time'
      );
      expect(responseTimeRule).toBeDefined();
      expect(responseTimeRule?.threshold).toBe(5000);

      const errorRateRule = defaultAlertRules.find(
        r => r.id === 'high-error-rate'
      );
      expect(errorRateRule).toBeDefined();
      expect(errorRateRule?.threshold).toBe(10);

      const requestCountRule = defaultAlertRules.find(
        r => r.id === 'too-many-requests'
      );
      expect(requestCountRule).toBeDefined();
      expect(requestCountRule?.threshold).toBe(1000);
    });

    it('should have valid alert rule configurations', () => {
      defaultAlertRules.forEach(rule => {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.condition).toBeTruthy();
        expect(typeof rule.threshold).toBe('number');
        expect(['gt', 'lt', 'eq', 'gte', 'lte']).toContain(rule.operator);
        expect(typeof rule.timeWindow).toBe('number');
        expect(typeof rule.enabled).toBe('boolean');
        expect(Array.isArray(rule.notificationChannels)).toBe(true);
      });
    });
  });
});
