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

  forEach(callback: (_value: string, _key: string) => void) {
    this.map.forEach((_value, _key) => callback(_value, _key));
  }

  entries() {
    return this.map.entries();
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }
}

class MockNextResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: MockHeaders;
  private _body: unknown;

  private constructor(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {}
  ) {
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
  static json(
    body: unknown,
    init: { status?: number; headers?: Record<string, string> } = {}
  ) {
    return new MockNextResponse(body, init.status ?? 200, init.headers);
  }
}

/* A minimal placeholder – extend when tests require more surface area */
class MockNextRequest {
  public url: string;
  public method: string;
  public headers: MockHeaders;
  private _body: unknown;

  constructor(
    url: string,
    init: {
      method?: string;
      headers?: MockHeaders | Record<string, string>;
      body?: unknown;
    } = {}
  ) {
    // Canonical constructor form - always requires a URL string
    this.url = url;
    this.method = init.method || 'GET';
    this.headers =
      init.headers instanceof MockHeaders
        ? init.headers
        : new MockHeaders(init.headers || {});
    this._body = init.body;
  }

  // Static helper method for legacy info-object pattern
  static fromInfo(
    info: {
      url?: string;
      method?: string;
      headers?: MockHeaders | Record<string, string>;
      body?: unknown;
    } = {}
  ): MockNextRequest {
    const url = info.url || 'http://localhost:3000/api/test';
    return new MockNextRequest(url, {
      method: info.method,
      headers: info.headers,
      body: info.body,
    });
  }

  async json() {
    return this._body || {};
  }
}

/* Make mocks globally visible for convenience (optional) */
// Only polyfill Headers if the runtime does not already provide it
if (typeof (globalThis as { Headers?: unknown }).Headers === 'undefined') {
  (globalThis as { Headers: typeof MockHeaders }).Headers = MockHeaders;
}
(globalThis as { NextResponse: typeof MockNextResponse }).NextResponse =
  MockNextResponse;
(globalThis as { NextRequest: typeof MockNextRequest }).NextRequest =
  MockNextRequest;

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

// Polyfill static Response.json (not provided by JSDOM fetch polyfill)
// Next.js' `NextResponse.json` helper relies on `Response.json` existing.
if (
  typeof Response !== 'undefined' &&
  typeof (Response as { json?: unknown }).json !== 'function'
) {
  (
    Response as { json: (_data: unknown, _init?: ResponseInit) => Response }
  ).json = function json(_data: unknown, _init?: ResponseInit) {
    // Create headers with default content type
    const defaultHeaders = [['Content-Type', 'application/json']] as [
      string,
      string,
    ][];
    const headers = new Headers(defaultHeaders);

    // Add any additional headers from _init
    if (_init?.headers) {
      if (Array.isArray(_init.headers)) {
        _init.headers.forEach(([key, value]) => headers.set(key, value));
      } else if (_init.headers instanceof Headers) {
        _init.headers.forEach((value, key) => headers.set(key, value));
      } else {
        Object.entries(_init.headers).forEach(([key, value]) =>
          headers.set(key, value)
        );
      }
    }

    return new Response(JSON.stringify(_data), {
      ..._init,
      headers: headers as HeadersInit,
    });
  };
}

// Global type declarations for Jest and browser APIs
/* eslint-disable no-unused-vars */
declare const jest: {
  fn: (
    implementation?: (...args: unknown[]) => unknown
  ) => jest.MockedFunction<(...args: unknown[]) => unknown>;
  mock: (moduleName: string, factory: () => unknown) => void;
  clearAllMocks: () => void;
};

declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const afterAll: (fn: () => void) => void;
declare const expect: {
  extend: (matchers: Record<string, unknown>) => void;
} & jest.Matchers<unknown>;

declare const Headers: {
  new (init?: [string, string][]): {
    get: (name: string) => string | null;
    set: (name: string, value: string) => void;
    forEach: (callback: (value: string, key: string) => void) => void;
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
  toBeValidApiResponse(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof obj.success === 'boolean' &&
      obj.success === true &&
      obj.data !== undefined &&
      typeof obj.meta === 'object' &&
      obj.meta !== null &&
      typeof (obj.meta as Record<string, unknown>).timestamp === 'string' &&
      typeof (obj.meta as Record<string, unknown>).version === 'string';

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

  toBeValidApiError(received: unknown) {
    const obj = received as Record<string, unknown>;
    const pass =
      typeof received === 'object' &&
      received !== null &&
      typeof obj.success === 'boolean' &&
      obj.success === false &&
      typeof obj.error === 'object' &&
      obj.error !== null &&
      typeof (obj.error as Record<string, unknown>).code === 'string' &&
      typeof (obj.error as Record<string, unknown>).message === 'string' &&
      typeof (obj.error as Record<string, unknown>).statusCode === 'number' &&
      typeof obj.meta === 'object' &&
      obj.meta !== null &&
      typeof (obj.meta as Record<string, unknown>).timestamp === 'string' &&
      typeof (obj.meta as Record<string, unknown>).version === 'string';

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

// Mock fetch for tests with proper Response-like object
globalThis.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['content-type', 'application/json']]),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    clone: function () {
      return this;
    },
  } as Response)
) as jest.MockedFunction<typeof fetch>;

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

  // Create a proper Headers object
  const headersObj = new MockHeaders({
    'content-type': 'application/json',
    ...headers,
  });

  // Use the new NextRequest(url, options) pattern
  return new MockNextRequest(url, {
    method,
    headers: headersObj,
    body,
  }) as unknown as NextRequest;
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
