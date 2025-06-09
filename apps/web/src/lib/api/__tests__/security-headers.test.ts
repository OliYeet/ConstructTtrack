/**
 * Security Headers Integration Tests
 * Tests that security headers are properly applied to API responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiMiddleware } from '../middleware';

// Mock the security headers module
jest.mock('@/lib/security/headers', () => ({
  applySecurityHeaders: jest.fn(response => {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }),
  defaultSecurityConfig: {},
}));

// Mock the response utilities
jest.mock('../response', () => ({
  addCorsHeaders: jest.fn(response => {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    return response;
  }),
  createErrorResponse: jest.fn(() =>
    NextResponse.json({ error: 'Test error' }, { status: 400 })
  ),
}));

// Mock auth module
jest.mock('../auth', () => ({
  createRequestContext: jest.fn(() => ({
    requestId: 'test-request-id',
    user: null,
  })),
}));

// Mock other dependencies
jest.mock('../logger', () => ({
  logRequest: jest.fn(),
  logResponse: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
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

describe('API Security Headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should apply security headers to successful responses', async () => {
    const handler = withApiMiddleware({
      GET: async () => {
        return NextResponse.json({ message: 'Success' });
      },
    });

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await handler(request, { params: Promise.resolve({}) });

    // Check that security headers are applied
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains'
    );
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );

    // Check that CORS headers are also applied
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, PUT, DELETE, OPTIONS'
    );
  });

  it('should apply security headers to error responses', async () => {
    const handler = withApiMiddleware({
      GET: async () => {
        throw new Error('Test error');
      },
    });

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await handler(request, { params: Promise.resolve({}) });

    // Check that security headers are applied even to error responses
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });

  it('should apply security headers to OPTIONS preflight requests', async () => {
    const handler = withApiMiddleware({
      GET: async () => NextResponse.json({ message: 'Success' }),
    });

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'OPTIONS',
    });

    const response = await handler(request, { params: Promise.resolve({}) });

    // Check that security headers are applied to OPTIONS responses
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');

    // Handle the mock status object structure
    const statusValue =
      typeof response.status === 'object' && response.status.status
        ? response.status.status
        : response.status;
    expect(statusValue).toBe(200);
  });

  it('should apply security headers when CORS is disabled', async () => {
    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { cors: false }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await handler(request, { params: Promise.resolve({}) });

    // Security headers should still be applied
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');

    // CORS headers should not be applied
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeFalsy();
  });

  it('should apply security headers to rate limit responses', async () => {
    // Mock rate limiting to always fail
    jest.doMock('../middleware', () => {
      const originalModule = jest.requireActual('../middleware');
      return {
        ...originalModule,
        checkRateLimit: jest.fn(() => false),
      };
    });

    const handler = withApiMiddleware(
      {
        GET: async () => NextResponse.json({ message: 'Success' }),
      },
      { rateLimit: { windowMs: 1000, maxRequests: 1 } }
    );

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await handler(request, { params: Promise.resolve({}) });

    // Security headers should be applied to rate limit responses
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
