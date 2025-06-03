/**
 * Metrics API Endpoint
 * Provides access to performance and monitoring metrics
 */

import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/response';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { apiMetricsTracker } from '@/lib/monitoring/api-metrics';
import { resourceMonitor } from '@/lib/monitoring/resource-monitor';
import { errorReporter } from '@/lib/errors/error-reporter';
import { globalErrorHandler } from '@/lib/errors/global-handler';

// GET /api/v1/metrics - Get system metrics
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'all';
  const timeframe = url.searchParams.get('timeframe') || '1h';

  // Parse timeframe
  const timeframeMs = parseTimeframe(timeframe);
  
  let metrics: Record<string, unknown> = {};

  switch (type) {
    case 'performance':
      metrics = {
        performance: performanceMonitor.getStats(),
        metrics: performanceMonitor.getMetrics().filter(
          m => new Date(m.timestamp).getTime() > Date.now() - timeframeMs
        ),
      };
      break;

    case 'api':
      metrics = {
        api: apiMetricsTracker.getAggregatedMetrics(),
        // recentRequests: apiMetricsTracker.getRecentMetrics(
        //   timeframeMs / (60 * 1000) // Convert to minutes
        // ),
      };
      break;

    case 'resources':
      metrics = {
        resources: resourceMonitor.getStats(),
        current: resourceMonitor.getCurrentUsage(),
        history: resourceMonitor.getHistory(timeframeMs / (60 * 60 * 1000)), // Convert to hours
        trends: resourceMonitor.getTrends(),
      };
      break;

    case 'errors':
      metrics = {
        errors: errorReporter.getStats(),
        aggregated: errorReporter.getAggregatedErrors().slice(0, 20), // Top 20
        globalStats: globalErrorHandler.getErrorStats(),
      };
      break;

    case 'health':
      metrics = await getHealthMetrics();
      break;

    case 'all':
    default:
      metrics = {
        performance: performanceMonitor.getStats(),
        api: apiMetricsTracker.getAggregatedMetrics(),
        resources: {
          stats: resourceMonitor.getStats(),
          current: resourceMonitor.getCurrentUsage(),
        },
        errors: errorReporter.getStats(),
        health: await getHealthMetrics(),
        timestamp: new Date().toISOString(),
      };
      break;
  }

  return createSuccessResponse(metrics);
}

// POST /api/v1/metrics - Record custom metric
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const { name, value, unit, tags, metadata } = body;

  // Validate required fields
  if (!name || typeof value !== 'number' || !unit) {
    return createErrorResponse(
      new Error('Missing required fields: name, value, unit'),
      'unknown'
    );
  }

  // Record the metric
  performanceMonitor.recordMetric(
    name,
    value,
    unit,
    tags || {},
    metadata
  );

  return createSuccessResponse({
    message: 'Metric recorded successfully',
    metric: {
      name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString(),
    },
  });
}

// Helper function to parse timeframe
function parseTimeframe(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 60 * 60 * 1000; // Default to 1 hour
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

// Get health metrics
async function getHealthMetrics() {
  const currentResources = resourceMonitor.getCurrentUsage();
  const apiStats = apiMetricsTracker.getAggregatedMetrics();
  const errorStats = errorReporter.getStats();

  // Calculate health score (0-100)
  let healthScore = 100;

  // Deduct points for high resource usage
  if (currentResources) {
    if (currentResources.memory.percentage > 90) {
      healthScore -= 30;
    } else if (currentResources.memory.percentage > 80) {
      healthScore -= 15;
    }

    if (currentResources.cpu.usage > 0.9) {
      healthScore -= 25;
    } else if (currentResources.cpu.usage > 0.7) {
      healthScore -= 10;
    }
  }

  // Deduct points for slow API responses
  if (apiStats.averageResponseTime > 5000) {
    healthScore -= 20;
  } else if (apiStats.averageResponseTime > 2000) {
    healthScore -= 10;
  }

  // Deduct points for high error rates
  const errorRate = apiStats.totalRequests > 0 ? 
    (apiStats.totalErrors / apiStats.totalRequests) * 100 : 0;
  
  if (errorRate > 10) {
    healthScore -= 25;
  } else if (errorRate > 5) {
    healthScore -= 10;
  }

  // Ensure health score doesn't go below 0
  healthScore = Math.max(0, healthScore);

  // Determine health status
  let status: 'healthy' | 'warning' | 'critical';
  if (healthScore >= 80) {
    status = 'healthy';
  } else if (healthScore >= 60) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  return {
    score: healthScore,
    status,
    checks: {
      memory: {
        status: !currentResources ? 'unknown' :
                currentResources.memory.percentage > 90 ? 'critical' :
                currentResources.memory.percentage > 80 ? 'warning' : 'healthy',
        usage: currentResources?.memory.percentage || 0,
      },
      cpu: {
        status: !currentResources ? 'unknown' :
                currentResources.cpu.usage > 0.9 ? 'critical' :
                currentResources.cpu.usage > 0.7 ? 'warning' : 'healthy',
        usage: currentResources ? currentResources.cpu.usage * 100 : 0,
      },
      api: {
        status: apiStats.averageResponseTime > 5000 ? 'critical' :
                apiStats.averageResponseTime > 2000 ? 'warning' : 'healthy',
        averageResponseTime: apiStats.averageResponseTime,
        requestsPerMinute: apiStats.requestsPerMinute,
      },
      errors: {
        status: errorRate > 10 ? 'critical' :
                errorRate > 5 ? 'warning' : 'healthy',
        errorRate,
        recentErrors: errorStats.recentErrors,
      },
    },
    timestamp: new Date().toISOString(),
  };
}
