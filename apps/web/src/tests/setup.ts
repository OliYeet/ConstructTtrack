/* -------------------------------------------------------------------------- */
/*  Local mocks for Next.js server APIs                                       */
/* -------------------------------------------------------------------------- */

class MockHeaders {
  private map: Map<string, string>;

  constructor(init: Record<string, string> | [string, string][] = []) {
    this.map = new Map(
      Array.isArray(init)
        ? init.map(([k, v]) => [k.toLowerCase(), v])
        : Object.entries(init).map(([k, v]) => [k.toLowerCase(), v])
    );
  }

  get(name: string): string | null {
    return this.map.get(name.toLowerCase()) ?? null;
  }

  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), value);
  }

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }
}

class MockNextResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: MockHeaders;
  private _body: unknown;

  private constructor(body: unknown, status = 200, headers: Record<string, string> = {}) {
    this.ok = status >= 200 && status < 300;
    this.status = status;
    this._body = body;
    this.headers = new MockHeaders(headers);
  }

  /* Mirrors native Response.json() instance method */
  async json() {
    return this._body;
  }

  /* Mimics NextResponse.json() static helper */
  static json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    return new MockNextResponse(body, init.status ?? 200, init.headers);
  }
}

/* A minimal placeholder – extend when tests require more surface area */
class MockNextRequest {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  constructor(public _info: any = {}) {}
}

/* Make mocks globally visible for convenience (optional) */
(global as any).Headers = MockHeaders;
(global as any).NextResponse = MockNextResponse;
(global as any).NextRequest = MockNextRequest;

/* Provide module mock so `import { NextResponse } from 'next/server'` resolves */
jest.mock('next/server', () => ({
  Headers: MockHeaders,
  NextResponse: MockNextResponse,
  NextRequest: MockNextRequest,
}));

/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

import { NextRequest } from 'next/server';

// Global type declarations for Jest and browser APIs
/* eslint-disable no-unused-vars */
declare const jest: {
  fn: (implementation?: any) => any;
  mock: (moduleName: string, factory: () => any) => void;
  clearAllMocks: () => void;
};

declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const afterAll: (fn: () => void) => void;
declare const expect: {
  extend: (matchers: any) => void;
} & any;
declare const global: any;

declare const Headers: {
  new (init?: [string, string][]): {
    get: (name: string) => string | null;
  };
};
/* eslint-enable no-unused-vars */

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
  toBeValidApiResponse(received: any) {
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

  toBeValidApiError(received: any) {
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
      }).map(([k, v]) => [k.toLowerCase(), v] as [string, string])
    ),
    json: jest.fn().mockResolvedValue(body),
  };

  // Add headers.get method
  (
    request.headers as Map<string, string> & {
      get: (_key: string) => string | undefined;
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
