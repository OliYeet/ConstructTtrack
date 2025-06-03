/**
 * API Metrics Tracking
 * Specialized monitoring for API performance and usage
 */

import { NextRequest } from 'next/server';
import { RequestContext } from '@/types/api';
import { performanceMonitor } from './performance-monitor';
import { getLogger } from '@/lib/logging';

// API metric data
export interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  userAgent?: string;
  ip?: string;
  error?: string;
}

// API endpoint statistics
export interface ApiEndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  errorRate: number;
  requestsPerMinute: number;
  statusCodes: Record<number, number>;
  recentErrors: string[];
}

// API metrics aggregation
export interface ApiMetricsAggregation {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
  errorsByEndpoint: Record<string, number>;
  statusCodeDistribution: Record<number, number>;
}

// API metrics tracker
export class ApiMetricsTracker {
  private metrics: ApiMetric[] = [];
  private maxMetrics = 10000;
  private retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  // Record API request start
  recordRequestStart(request: NextRequest, context?: RequestContext): string {
    const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Start performance timing
    performanceMonitor.startTiming(`api_${requestId}`);
    
    return requestId;
  }

  // Record API request completion
  recordRequestEnd(
    request: NextRequest,
    response: Response,
    requestId: string,
    context?: RequestContext
  ): void {
    // End performance timing
    const responseTime = performanceMonitor.endTiming(`api_${requestId}`, {
      endpoint: this.extractEndpoint(request.url),
      method: request.method || 'GET',
      status: response.status.toString(),
    });

    if (responseTime == null) { // covers null OR undefined
       return;
     }

    // Extract request/response sizes
    const requestSize = this.getRequestSize(request);
    const responseSize = this.getResponseSize(response);

    // Create API metric
    const metric: ApiMetric = {
      endpoint: this.extractEndpoint(request.url),
      method: request.method || 'GET',
      statusCode: response.status,
      responseTime,
      requestSize,
      responseSize,
      timestamp: new Date().toISOString(),
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
    };

    // Store metric
    this.metrics.push(metric);

    // Record in performance monitor
    performanceMonitor.recordMetric(
      'api_response_time',
      responseTime,
      'ms',
      {
        endpoint: metric.endpoint,
        method: metric.method,
        status: metric.statusCode.toString(),
      },
      {
        requestSize,
        responseSize,
        userId: metric.userId,
      }
    );

    // Record request count
    performanceMonitor.recordMetric(
      'api_request_count',
      1,
      'count',
      {
        endpoint: metric.endpoint,
        method: metric.method,
        status: metric.statusCode.toString(),
      }
    );

    // Log slow requests
    if (responseTime > 2000) { // 2 seconds
      const logger = getLogger();
      logger.warn(
        'Slow API request detected',
        undefined,
        {
           endpoint: metric.endpoint,
           method: metric.method,
           responseTime,
           statusCode: metric.statusCode,
           requestId,
        },
      );
    }

    // Log errors
    if (response.status >= 500) {
      const logger = getLogger();
      logger.error('API server error', undefined, {
        metadata: {
          endpoint: metric.endpoint,
          method: metric.method,
          statusCode: metric.statusCode,
          responseTime,
          requestId,
        },
      });
    }

    // Cleanup old metrics
    this.cleanup();
  }

  // Extract endpoint from URL
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      let pathname = urlObj.pathname;
      
      // Normalize API paths by removing IDs and dynamic segments
      pathname = pathname
        .replace(/\/api\/v\d+/, '/api') // Remove version
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
        .replace(/\/\d+/g, '/:id') // Numeric IDs
        .replace(/\/[a-f0-9]{24}/g, '/:id'); // MongoDB ObjectIds
      
      return pathname;
    } catch {
      return url;
    }
  }

  // Get request size
  private getRequestSize(request: NextRequest): number {
    const contentLength = request.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  // Get response size
  private getResponseSize(response: Response): number {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  // Get endpoint statistics
  getEndpointStats(endpoint: string, method?: string): ApiEndpointStats | null {
    const filteredMetrics = this.metrics.filter(metric => 
      metric.endpoint === endpoint && 
      (!method || metric.method === method)
    );

    if (filteredMetrics.length === 0) {
      return null;
    }

    const responseTimes = filteredMetrics.map(m => m.responseTime);
    const successCount = filteredMetrics.filter(m => m.statusCode < 400).length;
    const errorCount = filteredMetrics.length - successCount;

    // Calculate requests per minute
    const timeSpan = Date.now() - new Date(filteredMetrics[0].timestamp).getTime();
    const minuteWindow = Math.max(timeSpan, 60_000); // ≥ 1 min to avoid div-by-zero & spikes
    const requestsPerMinute = filteredMetrics.length / (minuteWindow / 60_000);

    // Status code distribution
    const statusCodes: Record<number, number> = {};
    filteredMetrics.forEach(metric => {
      statusCodes[metric.statusCode] = (statusCodes[metric.statusCode] || 0) + 1;
    });

    // Recent errors
    const recentErrors = filteredMetrics
      .filter(m => m.error && new Date(m.timestamp).getTime() > Date.now() - 60000) // Last minute
      .map(m => m.error!)
      .slice(-5); // Last 5 errors

    return {
      endpoint,
      method: method || 'ALL',
      totalRequests: filteredMetrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      successRate: (successCount / filteredMetrics.length) * 100,
      errorRate: (errorCount / filteredMetrics.length) * 100,
      requestsPerMinute,
      statusCodes,
      recentErrors,
    };
  }

  // Get aggregated metrics
  getAggregatedMetrics(): ApiMetricsAggregation {
    const recentThreshold = Date.now() - (60 * 60 * 1000); // Last hour
    const recentMetrics = this.metrics.filter(
      metric => new Date(metric.timestamp).getTime() > recentThreshold
    );

    // Calculate totals
    const totalRequests = recentMetrics.length;
    const totalErrors = recentMetrics.filter(m => m.statusCode >= 400).length;
    const averageResponseTime = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length :
      0;

    // Requests per minute
    const requestsPerMinute = totalRequests / 60;

    // Top endpoints by request count
    const endpointCounts: Record<string, number> = {};
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      endpointCounts[key] = (endpointCounts[key] || 0) + 1;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, requests]) => ({ endpoint, requests }));

    // Slowest endpoints
    const endpointTimes: Record<string, number[]> = {};
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!endpointTimes[key]) {
        endpointTimes[key] = [];
      }
      endpointTimes[key].push(metric.responseTime);
    });

    const slowestEndpoints = Object.entries(endpointTimes)
      .map(([endpoint, times]) => ({
        endpoint,
        avgResponseTime: times.reduce((a, b) => a + b, 0) / times.length,
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 10);

    // Errors by endpoint
    const errorsByEndpoint: Record<string, number> = {};
    recentMetrics
      .filter(m => m.statusCode >= 400)
      .forEach(metric => {
        const key = `${metric.method} ${metric.endpoint}`;
        errorsByEndpoint[key] = (errorsByEndpoint[key] || 0) + 1;
      });

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {};
    recentMetrics.forEach(metric => {
      statusCodeDistribution[metric.statusCode] = 
        (statusCodeDistribution[metric.statusCode] || 0) + 1;
    });

    return {
      totalRequests,
      totalErrors,
      averageResponseTime,
      requestsPerMinute,
      topEndpoints,
      slowestEndpoints,
      errorsByEndpoint,
      statusCodeDistribution,
    };
  }

  // Get all metrics
  getAllMetrics(): ApiMetric[] {
    return [...this.metrics];
  }

  // Cleanup old metrics
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionPeriod;
    this.metrics = this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoff);

    // Limit total metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
}

// Global API metrics tracker instance
export const apiMetricsTracker = new ApiMetricsTracker();
