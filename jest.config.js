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

  // Test match patterns - simplified to just unit tests
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{js,ts,tsx}',
    '<rootDir>/apps/*/src/**/*.test.{js,ts,tsx}',
  ],

  // Coverage settings - simplified for early development
  collectCoverageFrom: [
    'apps/web/src/**/*.{ts,tsx}',
    'tests/unit/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/node_modules/**',
  ],

  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: '<rootDir>/coverage',

  // Simplified coverage for early development - no strict thresholds yet
  // coverageThreshold: {
  //   global: {
  //     statements: 30,
  //     branches: 25,
  //     functions: 30,
  //     lines: 30,
  //   },
  // },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping - simplified for early development
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
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
