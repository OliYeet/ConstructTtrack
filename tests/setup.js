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

module.exports = {};
