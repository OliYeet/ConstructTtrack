/**
 * Jest Configuration for ConstructTrack
 * Comprehensive testing setup for unit, integration, and e2e tests
 * @type {import('jest').Config}
 */

// Base configuration
const baseConfig = {
  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Test match patterns (default)
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts,tsx}',
    '<rootDir>/tests/**/*.spec.{js,ts,tsx}',
  ],

  // Coverage settings
  collectCoverageFrom: [
    'apps/web/src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
    'scripts/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
  ],

  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageDirectory: '<rootDir>/coverage',

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@constructtrack/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@constructtrack/supabase/(.*)$': '<rootDir>/packages/supabase/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // ES modules support
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/.next/'],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};

// Configuration for different test types
const testType = process.env.TEST_TYPE || 'unit';

const configs = {
  unit: {
    ...baseConfig,
    displayName: 'Unit Tests',
    testMatch: [
      '<rootDir>/tests/unit/**/*.test.{js,ts,tsx}',
      '<rootDir>/apps/*/src/**/*.test.{js,ts,tsx}',
      '<rootDir>/packages/*/src/**/*.test.{js,ts,tsx}',
    ],
    testEnvironment: 'jsdom',
  },

  integration: {
    ...baseConfig,
    displayName: 'Integration Tests',
    testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts,tsx}'],
    testTimeout: 60000,
  },

  e2e: {
    ...baseConfig,
    displayName: 'E2E Tests',
    testMatch: ['<rootDir>/tests/e2e/**/*.test.{js,ts,tsx}'],
    testTimeout: 120000,
    maxWorkers: 1,
  },

  smoke: {
    ...baseConfig,
    displayName: 'Smoke Tests',
    testMatch: ['<rootDir>/tests/smoke/**/*.test.{ts,tsx}'],
    testTimeout: 60000,
  },

  performance: {
    ...baseConfig,
    displayName: 'Performance Tests',
    testMatch: ['<rootDir>/tests/performance/**/*.test.{ts,tsx}'],
    testTimeout: 180000,
  },

  a11y: {
    ...baseConfig,
    displayName: 'Accessibility Tests',
    testMatch: ['<rootDir>/tests/accessibility/**/*.test.{ts,tsx}'],
    testEnvironment: 'jsdom',
  },
};

// Export configuration based on test type
let config;
if (testType === 'all') {
  config = {
    projects: Object.values(configs),
    coverageDirectory: '<rootDir>/coverage',
    collectCoverageFrom: baseConfig.collectCoverageFrom,
    coverageReporters: baseConfig.coverageReporters,
  };
} else {
  config = configs[testType] || configs.unit;
}

export default config;
