/**
 * Enhanced Request/Response Logging Tests
 * Tests the detailed logging functionality in API middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiMiddleware } from '../middleware';

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
    user: { id: 'user-123', role: 'user' },
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

describe('Enhanced Request/Response Logging', () => {
  let mockEnhancedLogRequest: jest.Mock;
  let mockEnhancedLogResponse: jest.Mock;
  let mockEnhancedLogError: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Get the mocked functions
    const logging = await import('@/lib/logging');
    mockEnhancedLogRequest = logging.logRequest as jest.Mock;
    mockEnhancedLogResponse = logging.logResponse as jest.Mock;
    mockEnhancedLogError = logging.logError as jest.Mock;
  });

  it('should perform basic logging when detailed logging is disabled', async () => {
    const handler = withApiMiddleware({
      GET: async () => NextResponse.json({ message: 'Success' }),
    });

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    await handler(request, { params: Promise.resolve({}) });

    // Should call basic enhanced logging
    expect(mockEnhancedLogRequest).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        requestId: 'test-request-id',
        user: { id: 'user-123', role: 'user' },
      })
    );

    expect(mockEnhancedLogResponse).toHaveBeenCalledWith(
      request,
      200,
      expect.any(Number),
      expect.objectContaining({
        requestId: 'test-request-id',
      })
    );
  });

  it('should perform detailed logging when enabled', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { enableDetailedLogging: true }
    );

    const request = new NextRequest(
      'http://localhost:3000/api/test?param=value',
      {
        method: 'GET',
        headers: {
          'user-agent': 'Test Agent',
          authorization: 'Bearer secret-token',
          'x-custom-header': 'custom-value',
        },
      }
    );

    await handler(request, { params: Promise.resolve({}) });

    // Should call enhanced logging twice (basic + detailed)
    expect(mockEnhancedLogRequest).toHaveBeenCalledTimes(2);

    // Check detailed request logging
    const detailedRequestCall = mockEnhancedLogRequest.mock.calls[1];
    expect(detailedRequestCall[1]).toMatchObject({
      metadata: expect.objectContaining({
        detailedLogging: true,
        url: expect.objectContaining({
          pathname: '/api/test',
          search: '?param=value',
          searchParams: { param: 'value' },
        }),
        headers: expect.objectContaining({
          'user-agent': 'Test Agent',
          authorization: '[REDACTED]',
          'x-custom-header': 'custom-value',
        }),
      }),
    });

    // Should call enhanced response logging twice (basic + detailed)
    expect(mockEnhancedLogResponse).toHaveBeenCalledTimes(2);

    // Check detailed response logging
    const detailedResponseCall = mockEnhancedLogResponse.mock.calls[1];
    expect(detailedResponseCall[3]).toMatchObject({
      metadata: expect.objectContaining({
        detailedLogging: true,
        response: expect.objectContaining({
          headers: expect.any(Object),
          contentType: 'application/json',
        }),
        performance: expect.objectContaining({
          duration: expect.any(Number),
        }),
      }),
    });
  });

  it('should log request body for POST requests with detailed logging', async () => {
    const handler = withApiMiddleware(
      {
        POST: async () => NextResponse.json({ message: 'Created' }),
      },
      { enableDetailedLogging: true }
    );

    const requestBody = { name: 'Test', email: 'test@example.com' };
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    await handler(request, { params: Promise.resolve({}) });

    // Check that request body was logged
    const detailedRequestCall = mockEnhancedLogRequest.mock.calls[1];
    expect(detailedRequestCall[1].metadata.body).toEqual(requestBody);
  });

  it('should redact sensitive headers in detailed logging', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { enableDetailedLogging: true }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'x-api-key': 'api-key-123',
        'user-agent': 'Test Agent',
      },
    });

    await handler(request, { params: Promise.resolve({}) });

    const detailedRequestCall = mockEnhancedLogRequest.mock.calls[1];
    const headers = detailedRequestCall[1].metadata.headers;

    expect(headers.authorization).toBe('[REDACTED]');
    expect(headers.cookie).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
    expect(headers['user-agent']).toBe('Test Agent');
  });

  it('should handle logging errors gracefully', async () => {
    // Mock the basic logging to succeed but detailed logging to fail
    // const basicLogRequest = require('@/lib/api/logger').logRequest;
    // basicLogRequest.mockImplementation(() => {});

    // Mock enhanced logging to throw an error on the second call (detailed logging)
    mockEnhancedLogRequest
      .mockResolvedValueOnce(undefined) // First call succeeds (basic logging)
      .mockRejectedValueOnce(new Error('Logging failed')); // Second call fails (detailed logging)

    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { enableDetailedLogging: true }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    // Should not throw despite logging error
    const response = await handler(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    // Should log the error
    expect(mockEnhancedLogError).toHaveBeenCalledWith(
      'Failed to log detailed request',
      expect.any(Error),
      request,
      expect.any(Object)
    );
  });

  it('should limit request body size in logging', async () => {
    const handler = withApiMiddleware(
      {
        POST: async () => NextResponse.json({ message: 'Created' }),
      },
      { enableDetailedLogging: true }
    );

    // Create a large request body
    const largeBody = 'x'.repeat(2000);
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
      },
      body: largeBody,
    });

    await handler(request, { params: Promise.resolve({}) });

    const detailedRequestCall = mockEnhancedLogRequest.mock.calls[1];
    const loggedBody = detailedRequestCall[1].metadata.body;

    // Should be truncated to 1000 characters
    expect(loggedBody).toHaveLength(1000);
    expect(loggedBody).toBe('x'.repeat(1000));
  });
});
