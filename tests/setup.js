/**
 * Simplified Jest Test Setup
 * Essential test configuration for ConstructTrack
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables for testing
dotenv.config({ path: path.join(__dirname, '../.env.test') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Set test environment
process.env.NODE_ENV = 'test';

// Default Supabase test configuration
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'http://localhost:54321';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
}

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

// Suppress console logs during tests unless verbose
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: console.warn, // Keep warnings
    error: console.error, // Keep errors
  };
}

// Basic mocks for browser APIs
global.fetch = jest.fn();
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock Next.js NextResponse for API tests
global.NextResponse = {
  json: (data, init = {}) => ({
    json: () => Promise.resolve(data),
    status: init.status || 200,
    headers: init.headers || {},
  }),
};

// Mock Next.js NextRequest for API tests
global.NextRequest = class NextRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map();
    this.body = init.body || null;

    // Add required NextRequest properties
    this.cookies = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };
    this.nextUrl = new URL(url);
    this.page = undefined;
    this.ua = {};
    this.INTERNALS = Symbol('NextRequest internals');
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
};

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextResponse: global.NextResponse,
  NextRequest: global.NextRequest,
}));

module.exports = {};
