/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'node',

  // Node.js globals
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts}',
    '<rootDir>/tests/**/*.spec.{js,ts}',
  ],

  // Coverage settings
  collectCoverageFrom: [
    'scripts/**/*.{js,ts}',
    'packages/**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@constructtrack/(.*)$': '<rootDir>/packages/$1',
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // ES modules support
  extensionsToTreatAsEsm: ['.ts'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/apps/', '/dist/', '/build/'],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};

module.exports = config;
