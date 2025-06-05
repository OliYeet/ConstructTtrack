/**
 * Authentication Middleware Unit Tests
 * Validates token-based authentication enforcement using `withAuth`.
 */

import { jest } from '@jest/globals';
import { createSuccessResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware';
import type { NextRequest } from 'next/server';

import { supabase } from '@constructtrack/supabase/client';

interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Build a minimal NextRequest-like object for middleware testing
const buildRequest = (options: MockRequestOptions): NextRequest => {
  const {
    method = 'GET',
    url = 'http://localhost/api/test',
    headers = {},
    body,
  } = options;

  const hdrs = new Headers({
    'content-type': 'application/json',
    ...headers,
  });

  return {
    method,
    url,
    headers: hdrs,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
};

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
  });

  it('allows request with a valid token', async () => {
    // Mock Supabase auth & profile queries
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValueOnce({
        data: {
          role: 'field_worker',
          organization_id: 'org-123',
          full_name: 'Test User',
        },
        error: null,
      }),
    });

    const request = buildRequest({
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
    const request = buildRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/protected',
    });

    const response = await exec(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toBeValidApiError();
  });

  it('rejects request when token is invalid', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const request = buildRequest({
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
