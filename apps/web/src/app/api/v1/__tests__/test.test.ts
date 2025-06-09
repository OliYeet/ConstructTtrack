/**
 * Test API Integration Tests
 * Tests for the test endpoint functionality
 */

import { GET, POST } from '../test/route';
import { createMockRequest } from '@/tests/setup';
import { NextRequest } from 'next/server';
import { RequestContext } from '@/types/api';

type RequestWithContext = NextRequest & { context?: RequestContext };

// Mock the middleware to return the handlers directly
jest.mock('@/lib/api/middleware', () => ({
  withApiMiddleware: jest.fn(handlers => {
    // Return a function that routes to the correct handler based on method
    return async (request: Request, context: RequestContext) => {
      const method = request.method;
      const handler = handlers[method];
      if (handler) {
        return await handler(request, context);
      }
      throw new Error(`Method ${method} not allowed`);
    };
  }),
}));

describe('/api/v1/test GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return success response with test data', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/test',
    });

    const requestId = 'test-request-id';
    (request as RequestWithContext).context = {
      requestId,
      timestamp: new Date().toISOString(),
    };

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeValidApiResponse();
    expect(data.data.message).toBe('API is working correctly!');
    expect(data.data.requestId).toBe(requestId);
    expect(data.data.timestamp).toBeDefined();
    expect(data.message).toBe('Test endpoint successful');
  });

  it('should include user information when available', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/test',
    });

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'field_worker',
    };

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
      user: mockUser,
    };

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(data.data.user).toEqual(mockUser);
  });

  it('should work without user context', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/test',
    });

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
      // No user
    };

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.user).toBeUndefined();
  });
});

describe('/api/v1/test POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should echo message and data from request body', async () => {
    const requestBody = {
      message: 'Hello API!',
      data: { test: true, number: 42 },
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: requestBody,
    });

    const requestId = 'test-request-id';
    (request as RequestWithContext).context = {
      requestId,
      timestamp: new Date().toISOString(),
    };

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeValidApiResponse();
    expect(data.data.message).toBe('Received: Hello API!');
    expect(data.data.receivedData).toEqual(requestBody.data);
    expect(data.data.requestId).toBe(requestId);
    expect(data.message).toBe('Test POST successful');
  });

  it('should validate request body and reject invalid data', async () => {
    const invalidBody = {
      message: '', // Empty string should fail validation
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: invalidBody,
    });

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    // This should throw a validation error
    await expect(
      POST(request, { params: Promise.resolve({}) })
    ).rejects.toThrow();
  });

  it('should handle request body without optional data field', async () => {
    const requestBody = {
      message: 'Hello without data!',
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: requestBody,
    });

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.message).toBe('Received: Hello without data!');
    expect(data.data.receivedData).toBeUndefined();
  });

  it('should include user information when available', async () => {
    const requestBody = {
      message: 'Test with user',
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: requestBody,
    });

    const mockUser = {
      id: 'user-456',
      email: 'user@example.com',
      role: 'manager',
    };

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
      user: mockUser,
    };

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(data.data.user).toEqual(mockUser);
  });

  it('should validate message length constraints', async () => {
    // Test minimum length
    const shortMessage = {
      message: '', // Too short
    };

    const request1 = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: shortMessage,
    });

    (request1 as RequestWithContext).context = {
      requestId: 'test-request-id-1',
      timestamp: new Date().toISOString(),
    };

    await expect(
      POST(request1, { params: Promise.resolve({}) })
    ).rejects.toThrow();

    // Test maximum length
    const longMessage = {
      message: 'a'.repeat(101), // Too long (max 100 chars)
    };

    const request2 = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: longMessage,
    });

    (request2 as RequestWithContext).context = {
      requestId: 'test-request-id-2',
      timestamp: new Date().toISOString(),
    };

    await expect(
      POST(request2, { params: Promise.resolve({}) })
    ).rejects.toThrow();
  });

  it('should handle complex data structures', async () => {
    const complexData = {
      message: 'Complex data test',
      data: {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
          boolean: true,
          null: null,
        },
        string: 'test',
        number: 123.45,
      },
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: complexData,
    });

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.receivedData).toEqual(complexData.data);
  });

  it('should maintain consistent response format', async () => {
    const requestBody = {
      message: 'Format test',
    };

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/test',
      body: requestBody,
    });

    (request as RequestWithContext).context = {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('meta');

    // Verify data structure
    expect(data.data).toHaveProperty('message');
    expect(data.data).toHaveProperty('timestamp');
    expect(data.data).toHaveProperty('requestId');

    // Verify meta structure
    expect(data.meta).toHaveProperty('timestamp');
    expect(data.meta).toHaveProperty('version');
    expect(data.meta).toHaveProperty('requestId');
  });
});
