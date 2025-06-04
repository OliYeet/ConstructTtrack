/**
 * Authentication Middleware Unit Tests
 * Validates token-based authentication enforcement using `withAuth`.
 */

import { jest } from '@jest/globals';
import { createMockRequest } from '@/tests/setup';
import { createSuccessResponse } from '@/lib/api/response';

// -----------------------------
// Mock `createRequestContext`
// -----------------------------

// We need to manipulate the behaviour of `createRequestContext` for different
// scenarios (valid token, missing token, invalid token). Jest hoists `jest.mock`
// calls so the mock is applied before the actual module under test is imported.

jest.mock('@/lib/api/auth', () => ({
  // We will override this implementation separately in each test case
  createRequestContext: jest.fn(),
}));

// Import after mocking so that the middleware picks up the mocked function
import { withAuth } from '@/lib/api/middleware';
import type { NextRequest } from 'next/server';

// Extract the mocked `createRequestContext` for easy reference/typing
import { createRequestContext } from '@/lib/api/auth';

const mockCreateRequestContext = createRequestContext as jest.MockedFunction<
  typeof createRequestContext
>;

// Minimal OK handler that will only be executed if authentication succeeded
const okHandler = async () => {
  return createSuccessResponse({ message: 'Authenticated' }, 'OK', 200);
};

// Wrap the handler with auth requirement
const wrappedHandler = withAuth({ GET: okHandler });

// Helper to execute the wrapped handler (matches Next.js routing signature)
const exec = (request: NextRequest) =>
  wrappedHandler(request, { params: Promise.resolve({}) });

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------

describe('Authentication middleware (`withAuth`)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows request with a valid token', async () => {
    mockCreateRequestContext.mockResolvedValueOnce({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'field_worker',
        organizationId: 'org-123',
      },
      organizationId: 'org-123',
      requestId: 'req_valid',
      timestamp: new Date().toISOString(),
    });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/protected',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await exec(request);
    const json = await response.json();

    // Handler should have run and response should be successful
    expect(response.status).toBe(200);
    expect(json).toBeValidApiResponse();
    expect(json.data.message).toBe('Authenticated');
  });

  it('rejects request when token is missing', async () => {
    mockCreateRequestContext.mockResolvedValueOnce({
      // No user information when token is missing
      user: undefined,
      organizationId: undefined,
      requestId: 'req_missing',
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
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects request when token is invalid', async () => {
    // Simulate token verification failure by returning undefined user
    mockCreateRequestContext.mockResolvedValueOnce({
      user: undefined,
      organizationId: undefined,
      requestId: 'req_invalid',
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
    expect(json.error.code).toBe('UNAUTHORIZED');
  });
});
