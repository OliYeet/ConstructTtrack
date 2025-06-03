/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

import { NextRequest } from 'next/server';

// Set test environment variables
// NODE_ENV is set by the test runner
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.API_VERSION = '1.0.0-test';

// Mock console methods in tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset console mocks before each test
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods after each test
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidApiResponse(): R;
      toBeValidApiError(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidApiResponse(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean' &&
      received.success === true &&
      received.data !== undefined &&
      typeof received.meta === 'object' &&
      typeof received.meta.timestamp === 'string' &&
      typeof received.meta.version === 'string';

    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid API response`,
        pass: false,
      };
    }
  },

  toBeValidApiError(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean' &&
      received.success === false &&
      typeof received.error === 'object' &&
      typeof received.error.code === 'string' &&
      typeof received.error.message === 'string' &&
      typeof received.error.statusCode === 'number' &&
      typeof received.meta === 'object' &&
      typeof received.meta.timestamp === 'string' &&
      typeof received.meta.version === 'string';

    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be a valid API error`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid API error`,
        pass: false,
      };
    }
  },
});

// Mock fetch for tests
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
});

// Mock Supabase client
jest.mock('@constructtrack/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  },
}));

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'field_worker',
  organizationId: 'test-org-id',
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'test-project-id',
  organizationId: 'test-org-id',
  name: 'Test Project',
  description: 'A test project',
  status: 'planning',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockRequestContext = (overrides = {}) => ({
  user: createMockUser(),
  organizationId: 'test-org-id',
  requestId: 'test-request-id',
  timestamp: new Date().toISOString(),
  ...overrides,
});

// Test helpers
export const createMockRequest = (
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) => {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body,
  } = options;

  const request = {
    method,
    url,
    headers: new Headers(
      Object.entries({
        'content-type': 'application/json',
        ...headers,
      }).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    json: jest.fn().mockResolvedValue(body),
  };

  // Add headers.get method
  (
    request.headers as Map<string, string> & {
      get: (key: string) => string | undefined;
    }
  ).get = (key: string) => {
    return (request.headers as Map<string, string>).get(key.toLowerCase());
  };

  return request as unknown as NextRequest;
};

export const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  headers: {
    set: jest.fn(),
  },
});

// Cleanup after all tests
afterAll(() => {
  jest.clearAllMocks();
});
