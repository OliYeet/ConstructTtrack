/**
 * Enhanced API Metrics Tests
 * Tests the detailed metrics collection functionality in API middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiMiddleware } from '../middleware';
import { createRequestContext } from '../auth';

// Mock the enhanced logging module
jest.mock('@/lib/logging', () => ({
  logRequest: jest.fn(),
  logResponse: jest.fn(),
  logError: jest.fn(),
}));

// Mock other dependencies
jest.mock('../auth', () => ({
  createRequestContext: jest.fn(() => ({
    requestId: 'test-request-id',
    user: { id: 'user-123', role: 'admin' },
    organizationId: 'org-456',
  })),
}));

jest.mock('../logger', () => ({
  logRequest: jest.fn(),
  logResponse: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('@/lib/monitoring/api-metrics', () => ({
  apiMetricsTracker: {
    recordRequestStart: jest.fn(() => 'test-request-id'),
    recordRequestEnd: jest.fn(),
  },
}));

jest.mock('@/lib/security/headers', () => ({
  applySecurityHeaders: jest.fn(response => response),
  defaultSecurityConfig: {},
}));

jest.mock('@/lib/security/rate-limiting', () => ({
  createRateLimitMiddleware: jest.fn(() =>
    jest.fn(async () => ({ allowed: true }))
  ),
  rateLimitConfigs: { api: {} },
}));

jest.mock('../response', () => ({
  addCorsHeaders: jest.fn(response => response),
  createErrorResponse: jest.fn(() =>
    NextResponse.json({ error: 'Test error' }, { status: 400 })
  ),
}));

describe('Enhanced API Metrics', () => {
  let mockApiMetricsTracker: any;
  let mockEnhancedLogRequest: jest.Mock;
  // let mockEnhancedLogResponse: jest.Mock;
  let mockEnhancedLogError: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Get the mocked functions
    const logging = await import('@/lib/logging');
    mockEnhancedLogRequest = logging.logRequest as jest.Mock;
    // mockEnhancedLogResponse = logging.logResponse;
    mockEnhancedLogError = logging.logError as jest.Mock;

    // Get the mocked API metrics tracker
    const apiMetrics = await import('@/lib/monitoring/api-metrics');
    mockApiMetricsTracker = apiMetrics.apiMetricsTracker;
  });

  it('should perform basic metrics collection when detailed metrics is disabled', async () => {
    const handler = withApiMiddleware({
      GET: async () => NextResponse.json({ message: 'Success' }),
    });

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should call basic API metrics tracking
    expect(mockApiMetricsTracker.recordRequestStart).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        requestId: 'test-request-id',
        user: { id: 'user-123', role: 'admin' },
      })
    );

    expect(mockApiMetricsTracker.recordRequestEnd).toHaveBeenCalledWith(
      request,
      expect.any(Object), // response
      'test-request-id',
      expect.objectContaining({
        requestId: 'test-request-id',
      })
    );
  });

  it('should perform detailed metrics collection when enabled', async () => {
    const handler = withApiMiddleware(
      {
        POST: async () => {
          const response = NextResponse.json({ message: 'Created' });
          response.headers.set('content-length', '25');
          return response;
        },
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '50',
      },
      body: JSON.stringify({ name: 'Test User' }),
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should call enhanced logging multiple times for different metrics
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'request_size',
          value: 50,
          unit: 'bytes',
          tags: expect.objectContaining({
            endpoint: '/api/users',
            method: 'POST',
            status: '200',
            authenticated: 'true',
            userRole: 'admin',
          }),
        }),
      })
    );

    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'response_size',
          value: 25,
          unit: 'bytes',
        }),
      })
    );

    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'user_activity',
          value: 1,
          unit: 'count',
          tags: expect.objectContaining({
            userId: 'user-123',
            userRole: 'admin',
          }),
        }),
      })
    );

    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'endpoint_performance',
          unit: 'ms',
          tags: expect.objectContaining({
            endpoint: '/api/users',
            method: 'POST',
          }),
        }),
      })
    );
  });

  it('should record error metrics for failed requests', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () =>
          NextResponse.json({ error: 'Not found' }, { status: 404 }),
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/nonexistent', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should record error metrics
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'api_error',
          value: 1,
          unit: 'count',
          tags: expect.objectContaining({
            status: '404',
            errorType: 'client_error',
          }),
        }),
      })
    );
  });

  it('should record server error metrics for 5xx responses', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () =>
          NextResponse.json({ error: 'Internal error' }, { status: 500 }),
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/error', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should record server error metrics
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'api_error',
          value: 1,
          unit: 'count',
          tags: expect.objectContaining({
            status: '500',
            errorType: 'server_error',
          }),
        }),
      })
    );
  });

  it('should record rate limiting metrics when available', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () => {
          const response = NextResponse.json({ message: 'Success' });
          response.headers.set('X-RateLimit-Remaining', '95');
          return response;
        },
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should record rate limiting metrics
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'rate_limit_usage',
          value: 95,
          unit: 'remaining',
        }),
      })
    );
  });

  it('should handle metrics collection errors gracefully', async () => {
    // Mock the basic logging to succeed but detailed metrics logging to fail
    // const basicLogRequest = require('@/lib/api/logger').logRequest;
    // basicLogRequest.mockImplementation(() => {});

    // Mock enhanced logging to succeed for basic calls but fail for metrics
    mockEnhancedLogRequest
      .mockResolvedValueOnce(undefined) // Basic request logging
      .mockResolvedValueOnce(undefined) // Basic response logging
      .mockRejectedValueOnce(new Error('Metrics collection failed')); // Detailed metrics

    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        'content-length': '0',
      },
    });

    // Should not throw despite metrics error
    const response = await handler(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    // Should log the error
    expect(mockEnhancedLogError).toHaveBeenCalledWith(
      'Failed to record detailed metrics',
      expect.any(Error),
      request,
      expect.any(Object)
    );
  });

  it('should record anonymous user metrics for unauthenticated requests', async () => {
    // Mock unauthenticated context
    (
      createRequestContext as jest.MockedFunction<typeof createRequestContext>
    ).mockReturnValueOnce({
      requestId: 'test-request-id',
      user: null,
      organizationId: null,
    });

    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Public endpoint' }),
      },
      { enableDetailedMetrics: true }
    );

    const request = new NextRequest('http://localhost:3000/api/public', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should record metrics with anonymous user tags
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        metadata: expect.objectContaining({
          metricType: 'endpoint_performance',
          tags: expect.objectContaining({
            authenticated: 'false',
            userRole: 'anonymous',
            organizationId: 'unknown',
          }),
        }),
      })
    );
  });
});
