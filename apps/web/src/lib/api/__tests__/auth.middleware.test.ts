/**
 * Authentication Middleware Unit Tests
 * Validates token-based authentication enforcement using `withAuth`.
 */

import { jest } from '@jest/globals';
import { createSuccessResponse } from '../response';
import { withAuth } from '../middleware';
import type { NextRequest } from 'next/server';
import { createMockRequest } from '../../../tests/setup';

// Import the mocked supabase client
import { supabase } from '@constructtrack/supabase/client';

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
    const mockGetUser = supabase.auth.getUser as jest.MockedFunction<
      typeof supabase.auth.getUser
    >;
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    } as any);

    const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
    const mockChain = {
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
    };
    mockFrom.mockReturnValueOnce(mockChain as any);

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
    const mockGetUser = supabase.auth.getUser as jest.MockedFunction<
      typeof supabase.auth.getUser
    >;
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    } as any);

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
