/**
 * Simplified Jest Configuration for ConstructTrack
 * Focus on unit and integration tests only
 * @type {import('jest').Config}
 */

const config = {
  // Test environment - use node for most tests, jsdom for React components
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

  // Test match patterns - simplified to just unit and integration
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{js,ts,tsx}',
    '<rootDir>/tests/integration/**/*.test.{js,ts,tsx}',
    '<rootDir>/apps/*/src/**/*.test.{js,ts,tsx}',
    '<rootDir>/packages/*/src/**/*.test.{js,ts,tsx}',
  ],

  // Coverage settings - no thresholds initially
  collectCoverageFrom: [
    'apps/web/src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
    'scripts/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
  ],

  coverageReporters: ['text', 'lcov'],
  coverageDirectory: '<rootDir>/coverage',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@constructtrack/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@constructtrack/supabase/(.*)$': '<rootDir>/packages/supabase/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Single timeout for all tests
  testTimeout: 30000,

  // ES modules support
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/.next/'],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output only in CI
  verbose: process.env.CI === 'true',
};

export default config;
