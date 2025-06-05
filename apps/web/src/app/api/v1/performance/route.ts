/**
 * API Performance Monitoring Endpoint
 * Provides access to performance metrics, analysis, and optimization recommendations
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import {
  performanceStore,
  performanceMonitor,
  PerformanceFilter,
  defaultPerformanceThresholds,
} from '@/lib/api/performance-monitoring';

// GET /api/v1/performance - Get performance metrics and analysis
export const GET = withApiMiddleware(
  {
    GET: async (request: NextRequest) => {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'summary';

      switch (action) {
        case 'summary':
          return await getPerformanceSummary(request);
        case 'analysis':
          return await getPerformanceAnalysis(request);
        case 'metrics':
          return await getPerformanceMetrics(request);
        case 'alerts':
          return await getPerformanceAlerts(request);
        case 'recommendations':
          return await getOptimizationRecommendations(request);
        case 'bottlenecks':
          return await getBottleneckAnalysis(request);
        default:
          return createSuccessResponse({
            message: 'API Performance Monitoring',
            availableActions: {
              summary: '?action=summary - Get performance overview',
              analysis:
                '?action=analysis&endpoint={endpoint} - Get detailed analysis',
              metrics: '?action=metrics - Get raw performance metrics',
              alerts: '?action=alerts - Get active performance alerts',
              recommendations:
                '?action=recommendations - Get optimization recommendations',
              bottlenecks: '?action=bottlenecks - Get bottleneck analysis',
            },
            parameters: {
              startTime: 'Unix timestamp for start time filter',
              endTime: 'Unix timestamp for end time filter',
              endpoint: 'Filter by specific endpoint',
              method: 'Filter by HTTP method',
              limit: 'Limit number of results',
            },
          });
      }
    },
  },
  { requireAuth: true, requireRoles: ['admin', 'manager'] }
);

async function getPerformanceSummary(_request: NextRequest) {
  const now = Date.now();
  const last24Hours = now - 24 * 60 * 60 * 1000;
  const lastHour = now - 60 * 60 * 1000;

  // Get metrics for different time periods
  const last24HoursMetrics = await performanceStore.getMetrics({
    startTime: last24Hours,
    endTime: now,
  });

  const lastHourMetrics = await performanceStore.getMetrics({
    startTime: lastHour,
    endTime: now,
  });

  const activeAlerts = performanceMonitor.getActiveAlerts();

  // Calculate summary statistics
  const summary = {
    last24Hours: calculateSummaryStats(last24HoursMetrics),
    lastHour: calculateSummaryStats(lastHourMetrics),
    alerts: {
      active: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'critical').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length,
    },
    topSlowEndpoints: getTopSlowEndpoints(last24HoursMetrics, 5),
    performanceScore: calculatePerformanceScore(last24HoursMetrics),
  };

  return createSuccessResponse({
    message: 'Performance monitoring summary',
    data: summary,
    generatedAt: new Date().toISOString(),
  });
}

async function getPerformanceAnalysis(request: NextRequest) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');
  const method = url.searchParams.get('method') || undefined;

  if (!endpoint) {
    return createSuccessResponse({
      error: 'Missing required parameter: endpoint',
      example: '/api/v1/performance?action=analysis&endpoint=/api/v1/projects',
    });
  }

  const analysis = await performanceStore.getAnalysis(endpoint, method);

  return createSuccessResponse({
    message: `Performance analysis for ${endpoint}`,
    data: analysis,
    generatedAt: new Date().toISOString(),
  });
}

async function getPerformanceMetrics(request: NextRequest) {
  const url = new URL(request.url);
  const filters = buildPerformanceFilters(url.searchParams);

  // Limit metrics to prevent large responses
  if (!filters.limit) {
    filters.limit = 1000;
  }

  const metrics = await performanceStore.getMetrics(filters);

  return createSuccessResponse({
    message: 'Performance metrics',
    data: metrics,
    count: metrics.length,
    filters,
    generatedAt: new Date().toISOString(),
  });
}

async function getPerformanceAlerts(_request: NextRequest) {
  const activeAlerts = performanceMonitor.getActiveAlerts();

  return createSuccessResponse({
    message: 'Active performance alerts',
    data: {
      activeAlerts,
      alertCount: activeAlerts.length,
      thresholds: defaultPerformanceThresholds.map(threshold => ({
        endpoint: threshold.endpoint,
        method: threshold.method,
        responseTimeMs: threshold.responseTimeMs,
        severity: threshold.severity,
      })),
    },
    generatedAt: new Date().toISOString(),
  });
}

async function getOptimizationRecommendations(_request: NextRequest) {
  const now = Date.now();
  const last24Hours = now - 24 * 60 * 60 * 1000;

  const metrics = await performanceStore.getMetrics({
    startTime: last24Hours,
    endTime: now,
  });

  // Group metrics by endpoint
  const endpointGroups = groupMetricsByEndpoint(metrics);
  const recommendations: any[] = [];

  for (const [endpoint] of Object.entries(endpointGroups)) {
    const analysis = await performanceStore.getAnalysis(endpoint);

    recommendations.push({
      endpoint,
      metrics: analysis.metrics,
      bottlenecks: analysis.bottlenecks,
      recommendations: analysis.recommendations,
      priority: determinePriority(analysis),
    });
  }

  // Sort by priority
  recommendations.sort(
    (a, b) => getPriorityScore(b.priority) - getPriorityScore(a.priority)
  );

  return createSuccessResponse({
    message: 'Performance optimization recommendations',
    data: {
      recommendations,
      summary: {
        totalEndpoints: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        mediumPriority: recommendations.filter(r => r.priority === 'medium')
          .length,
        lowPriority: recommendations.filter(r => r.priority === 'low').length,
      },
    },
    generatedAt: new Date().toISOString(),
  });
}

async function getBottleneckAnalysis(_request: NextRequest) {
  const now = Date.now();
  const last24Hours = now - 24 * 60 * 60 * 1000;

  const metrics = await performanceStore.getMetrics({
    startTime: last24Hours,
    endTime: now,
  });

  const bottlenecks = {
    slowEndpoints: getTopSlowEndpoints(metrics, 10),
    highErrorRateEndpoints: getHighErrorRateEndpoints(metrics, 10),
    resourceIntensiveEndpoints: getResourceIntensiveEndpoints(metrics, 10),
    systemBottlenecks: identifySystemBottlenecks(metrics),
  };

  return createSuccessResponse({
    message: 'Performance bottleneck analysis',
    data: bottlenecks,
    generatedAt: new Date().toISOString(),
  });
}

// Helper functions
function buildPerformanceFilters(
  searchParams: URLSearchParams
): PerformanceFilter {
  const filters: PerformanceFilter = {};

  const startTime = searchParams.get('startTime');
  if (startTime) {
    filters.startTime = parseInt(startTime, 10);
  }

  const endTime = searchParams.get('endTime');
  if (endTime) {
    filters.endTime = parseInt(endTime, 10);
  }

  const endpoint = searchParams.get('endpoint');
  if (endpoint) {
    filters.endpoint = endpoint;
  }

  const method = searchParams.get('method');
  if (method) {
    filters.method = method.toUpperCase();
  }

  const minResponseTime = searchParams.get('minResponseTime');
  if (minResponseTime) {
    filters.minResponseTime = parseInt(minResponseTime, 10);
  }

  const maxResponseTime = searchParams.get('maxResponseTime');
  if (maxResponseTime) {
    filters.maxResponseTime = parseInt(maxResponseTime, 10);
  }

  const statusCode = searchParams.get('statusCode');
  if (statusCode) {
    filters.statusCode = parseInt(statusCode, 10);
  }

  const limit = searchParams.get('limit');
  if (limit) {
    filters.limit = parseInt(limit, 10);
  }

  return filters;
}

function calculateSummaryStats(metrics: any[]) {
  if (metrics.length === 0) {
    return {
      requestCount: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      throughput: 0,
    };
  }

  const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
  const errorCount = metrics.filter(m => m.statusCode >= 400).length;
  const timeSpan =
    Math.max(...metrics.map(m => m.timestamp)) -
    Math.min(...metrics.map(m => m.timestamp));
  const throughput = timeSpan > 0 ? metrics.length / (timeSpan / 1000) : 0;

  return {
    requestCount: metrics.length,
    averageResponseTime:
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
    p95ResponseTime:
      responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
    errorRate: (errorCount / metrics.length) * 100,
    throughput,
  };
}

function getTopSlowEndpoints(metrics: any[], limit: number) {
  const endpointStats = groupMetricsByEndpoint(metrics);

  return Object.entries(endpointStats)
    .map(([endpoint, endpointMetrics]) => ({
      endpoint,
      averageResponseTime:
        (endpointMetrics as any[]).reduce(
          (sum: number, m: any) => sum + m.responseTime,
          0
        ) / (endpointMetrics as any[]).length,
      requestCount: (endpointMetrics as any[]).length,
    }))
    .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
    .slice(0, limit);
}

function getHighErrorRateEndpoints(metrics: any[], limit: number) {
  const endpointStats = groupMetricsByEndpoint(metrics);

  return Object.entries(endpointStats)
    .map(([endpoint, endpointMetrics]) => {
      const errorCount = (endpointMetrics as any[]).filter(
        (m: any) => m.statusCode >= 400
      ).length;
      return {
        endpoint,
        errorRate: (errorCount / (endpointMetrics as any[]).length) * 100,
        requestCount: (endpointMetrics as any[]).length,
        errorCount,
      };
    })
    .filter(stat => stat.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, limit);
}

function getResourceIntensiveEndpoints(metrics: any[], limit: number) {
  const endpointStats = groupMetricsByEndpoint(metrics);

  return Object.entries(endpointStats)
    .map(([endpoint, endpointMetrics]) => ({
      endpoint,
      averageMemoryUsage:
        (endpointMetrics as any[])
          .filter((m: any) => m.memoryUsage !== undefined)
          .reduce((sum: number, m: any) => sum + (m.memoryUsage || 0), 0) /
        (endpointMetrics as any[]).length,
      averageResponseSize:
        (endpointMetrics as any[]).reduce(
          (sum: number, m: any) => sum + m.responseSize,
          0
        ) / (endpointMetrics as any[]).length,
      requestCount: (endpointMetrics as any[]).length,
    }))
    .sort((a, b) => b.averageMemoryUsage - a.averageMemoryUsage)
    .slice(0, limit);
}

function identifySystemBottlenecks(metrics: any[]) {
  const bottlenecks: string[] = [];

  const avgResponseTime =
    metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
  if (avgResponseTime > 2000) {
    bottlenecks.push('High system-wide response times');
  }

  const errorRate =
    (metrics.filter(m => m.statusCode >= 400).length / metrics.length) * 100;
  if (errorRate > 5) {
    bottlenecks.push('High system-wide error rate');
  }

  return bottlenecks;
}

function groupMetricsByEndpoint(metrics: any[]) {
  return metrics.reduce(
    (groups, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
      return groups;
    },
    {} as Record<string, any[]>
  );
}

function calculatePerformanceScore(metrics: any[]): number {
  if (metrics.length === 0) return 100;

  const avgResponseTime =
    metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
  const errorRate =
    (metrics.filter(m => m.statusCode >= 400).length / metrics.length) * 100;

  let score = 100;

  // Deduct points for slow response times
  if (avgResponseTime > 1000) score -= 20;
  if (avgResponseTime > 2000) score -= 30;
  if (avgResponseTime > 5000) score -= 40;

  // Deduct points for errors
  score -= errorRate * 2;

  return Math.max(0, Math.min(100, score));
}

function determinePriority(analysis: any): 'high' | 'medium' | 'low' {
  if (
    analysis.metrics.averageResponseTime > 3000 ||
    analysis.metrics.errorRate > 10
  ) {
    return 'high';
  }
  if (
    analysis.metrics.averageResponseTime > 1500 ||
    analysis.metrics.errorRate > 5
  ) {
    return 'medium';
  }
  return 'low';
}

function getPriorityScore(priority: string): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

// POST /api/v1/performance - Performance management operations
export const POST = withApiMiddleware(
  {
    POST: async (request: NextRequest) => {
      const body = await request.json();
      const { action, ...params } = body;

      switch (action) {
        case 'resolve_alert':
          if (!params.alertId) {
            return createSuccessResponse({
              error: 'Missing alertId parameter',
            });
          }
          performanceMonitor.resolveAlert(params.alertId);
          return createSuccessResponse({
            message: 'Performance alert resolved',
            data: { alertId: params.alertId },
          });

        case 'cleanup_metrics': {
          const olderThan =
            params.olderThan || Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
          await performanceStore.cleanup(olderThan);
          return createSuccessResponse({
            message: 'Performance metrics cleanup completed',
            data: { cleanupThreshold: new Date(olderThan).toISOString() },
          });
        }

        default:
          return createSuccessResponse({
            message: 'Performance management operations',
            availableActions: {
              resolve_alert: {
                description: 'Resolve a performance alert',
                payload: { action: 'resolve_alert', alertId: 'alert-id' },
              },
              cleanup_metrics: {
                description: 'Clean up old performance metrics',
                payload: {
                  action: 'cleanup_metrics',
                  olderThan:
                    'Unix timestamp (optional, defaults to 7 days ago)',
                },
              },
            },
          });
      }
    },
  },
  { requireAuth: true, requireRoles: ['admin'] }
);
