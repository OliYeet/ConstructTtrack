/**
 * Authentication Middleware Unit Tests
 * Validates token-based authentication enforcement using `withAuth`.
 */

import { jest } from '@jest/globals';
import { createSuccessResponse } from '../response';
import { withAuth } from '../middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMockRequest } from '../../../tests/setup';
// Import removed - using mock instead

// Import the mocked supabase client (for type checking only)

// Mock the Supabase client methods before tests
jest.mock('@constructtrack/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

// Mock other dependencies
jest.mock('@/lib/logging', () => ({
  logRequest: jest.fn(),
  logResponse: jest.fn(),
  logError: jest.fn(),
  enhancedLogRequest: jest.fn(),
  enhancedLogResponse: jest.fn(),
  enhancedLogError: jest.fn(),
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@/lib/monitoring/api-metrics', () => ({
  apiMetricsTracker: {
    recordRequestStart: jest.fn(() => 'test-request-id'),
    recordRequestEnd: jest.fn(),
  },
}));

jest.mock('@/lib/security/headers', () => ({
  applySecurityHeaders: jest.fn(response => response),
  applyApiHeaders: jest.fn(response => response),
  defaultSecurityConfig: {},
}));

jest.mock('@/lib/security/rate-limiting', () => ({
  createRateLimitMiddleware: jest.fn(() =>
    jest.fn(async () => ({ allowed: true, headers: {} }))
  ),
  rateLimitConfigs: { api: {} },
}));

jest.mock('../caching', () => ({
  cacheManager: {
    generateKey: jest.fn(() => 'test-cache-key'),
    get: jest.fn(() => null),
    set: jest.fn(),
    isStale: jest.fn(() => false),
    createCachedResponse: jest.fn(),
    getCacheControlHeader: jest.fn(() => 'public, max-age=300'),
  },
  cacheConfigs: {
    short: { ttl: 60 },
    medium: { ttl: 300 },
    long: { ttl: 3600 },
  },
  CacheStrategy: {
    CACHE_FIRST: 'CACHE_FIRST',
    STALE_WHILE_REVALIDATE: 'STALE_WHILE_REVALIDATE',
  },
}));

jest.mock('../response', () => ({
  addCorsHeaders: jest.fn(response => response),
  createErrorResponse: jest.fn((error: unknown, requestId) => {
    const errorObj = error as { status?: number; code?: string; message?: string };
    const status = errorObj?.status || 500;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorObj?.code || 'UNKNOWN_ERROR',
          message: errorObj?.message || 'Test error',
          statusCode: status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1',
          requestId,
        },
      },
      { status }
    );
  }),
  createMethodNotAllowedResponse: jest.fn((_allowedMethods, _requestId) =>
    NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  ),
  createSuccessResponse: jest.fn(data =>
    NextResponse.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    })
  ),
}));

// Mock the auth module
const mockCreateRequestContext = jest.fn() as jest.MockedFunction<any>;
jest.mock('@/lib/api/auth', () => ({
  createRequestContext: mockCreateRequestContext,
}));

// Mock the error classes
jest.mock('@/lib/errors/api-errors', () => ({
  BaseApiError: jest.fn().mockImplementation((message, status, code) => ({
    message,
    status,
    code,
  })),
  InternalServerError: jest.fn(),
}));

// Simple handler used to confirm successful auth
const okHandler = async () =>
  createSuccessResponse({ message: 'Authenticated' }, 'OK', 200);

const wrappedHandler = withAuth({ GET: okHandler });
const exec = (request: NextRequest) =>
  wrappedHandler(request, { params: Promise.resolve({}) });

// -------------------------------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------------------------------

describe('Authentication middleware (`withAuth`)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRequestContext.mockClear();
  });

  it('allows request with a valid token', async () => {
    // Mock createRequestContext to return context with user
    mockCreateRequestContext.mockResolvedValueOnce({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'field_worker',
        organizationId: 'org-123',
      },
      organizationId: 'org-123',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/protected',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await exec(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toBeValidApiResponse();
  });

  it('rejects request when token is missing', async () => {
    // Mock createRequestContext to return context without user
    mockCreateRequestContext.mockResolvedValueOnce({
      user: undefined,
      organizationId: undefined,
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/protected',
    });

    const response = await exec(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toBeValidApiError();
  });

  it('rejects request when token is invalid', async () => {
    // Mock createRequestContext to return context without user (invalid token)
    mockCreateRequestContext.mockResolvedValueOnce({
      user: undefined,
      organizationId: undefined,
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/protected',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await exec(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toBeValidApiError();
  });
});
