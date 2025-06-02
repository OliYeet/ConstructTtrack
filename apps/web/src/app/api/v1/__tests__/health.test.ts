/**
 * Health API Integration Tests
 * Tests for the health check endpoint
 */

import { GET } from '../health/route';
import { createMockRequest } from '@/tests/setup';

// Mock the middleware to return the GET handler directly
jest.mock('@/lib/api/middleware', () => ({
  withApiMiddleware: jest.fn((handlers, options) => {
    return async (request, context) => {
      const handler = handlers.GET;
      if (handler) {
        return await handler(request, context);
      }
      throw new Error('Method not allowed');
    };
  }),
}));

describe('/api/v1/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables for tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  });

  it('should return healthy status when all services are available', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    // Add mock context
    (request as any).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeValidApiResponse();
    expect(data.data.status).toBe('healthy');
    expect(data.data.services.api).toBe('healthy');
    expect(data.data.services.database).toBe('healthy');
    expect(data.data.version).toBe('1.0.0-test');
    expect(typeof data.data.uptime).toBe('number');
  });

  it('should return degraded status when database is unavailable', async () => {
    // Remove environment variables to simulate database unavailability
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    (request as any).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toBeValidApiResponse();
    expect(data.data.status).toBe('degraded');
    expect(data.data.services.api).toBe('healthy');
    expect(data.data.services.database).toBe('unhealthy');
  });

  it('should include proper metadata in response', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    const requestId = 'test-request-id-123';
    (request as any).context = {
      requestId,
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.requestId).toBe(requestId);
    expect(data.meta.timestamp).toBeDefined();
    expect(data.meta.version).toBe('1.0.0');
  });

  it('should handle errors gracefully', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    // Remove context to simulate an error
    delete (request as any).context;

    // This should not throw, but handle the error gracefully
    const response = await GET(request);
    
    // The response should still be valid, even if there's an internal error
    expect(response).toBeDefined();
  });

  it('should return consistent response format', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    (request as any).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('meta');

    // Verify data structure
    expect(data.data).toHaveProperty('status');
    expect(data.data).toHaveProperty('timestamp');
    expect(data.data).toHaveProperty('version');
    expect(data.data).toHaveProperty('services');
    expect(data.data).toHaveProperty('uptime');

    // Verify services structure
    expect(data.data.services).toHaveProperty('database');
    expect(data.data.services).toHaveProperty('api');

    // Verify meta structure
    expect(data.meta).toHaveProperty('timestamp');
    expect(data.meta).toHaveProperty('version');
    expect(data.meta).toHaveProperty('requestId');
  });

  it('should have valid timestamp format', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/health',
    });

    (request as any).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request);
    const data = await response.json();

    // Verify timestamp is valid ISO string
    expect(() => new Date(data.data.timestamp)).not.toThrow();
    expect(() => new Date(data.meta.timestamp)).not.toThrow();
    
    // Verify timestamps are recent (within last minute)
    const now = Date.now();
    const dataTimestamp = new Date(data.data.timestamp).getTime();
    const metaTimestamp = new Date(data.meta.timestamp).getTime();
    
    expect(now - dataTimestamp).toBeLessThan(60000); // Less than 1 minute
    expect(now - metaTimestamp).toBeLessThan(60000); // Less than 1 minute
  });
});
