/**
 * Jest Test Setup
 * Global test configuration and setup for ConstructTrack tests
 */

const path = require('path');

const dotenv = require('dotenv');

// Load environment variables for testing
dotenv.config({ path: path.join(__dirname, '../.env.test') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set test environment variables
process.env.NODE_ENV = 'test';

// Default test database URL (local Supabase)
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'http://localhost:54321';
}

if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
}

// Global test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Helper to create test data
  createTestData: (overrides = {}) => ({
    id: 'test-id',
    name: 'Test Item',
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate unique test names
  generateTestName: (prefix = 'test') =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
};

// Console override for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  // Suppress info logs during tests unless explicitly enabled
  info: process.env.VERBOSE_TESTS ? originalConsole.info : () => {},
  debug: process.env.VERBOSE_TESTS ? originalConsole.debug : () => {},
  // Keep error and warn for debugging
  error: originalConsole.error,
  warn: originalConsole.warn,
  log: process.env.VERBOSE_TESTS ? originalConsole.log : () => {},
};

// Cleanup function for tests
global.afterEach(() => {
  // Reset any global state if needed
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock browser APIs
global.fetch = jest.fn();
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock Next.js Web APIs
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers);
    this.body = init.body;
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }

  async text() {
    return this.body || '';
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Headers(init.headers);
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }

  async text() {
    return this.body || '';
  }
};

global.Headers = class Headers {
  constructor(init = {}) {
    this.map = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.map.set(key.toLowerCase(), value);
      });
    }
  }

  get(name) {
    return this.map.get(name.toLowerCase());
  }

  set(name, value) {
    this.map.set(name.toLowerCase(), value);
  }

  has(name) {
    return this.map.has(name.toLowerCase());
  }
};

// Mock Next.js NextResponse
global.NextResponse = class NextResponse extends global.Response {
  static json(data, init = {}) {
    return new NextResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  }

  static redirect(url, init = {}) {
    return new NextResponse(null, {
      ...init,
      status: init.status || 302,
      headers: {
        location: url,
        ...init.headers,
      },
    });
  }
};

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextResponse: global.NextResponse,
  NextRequest: global.Request,
}));

module.exports = {};
