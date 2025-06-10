/**
 * Simple Jest Configuration for Web App - Early Development
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-node',
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,ts,tsx}',
  ],
  
  // No coverage thresholds for early development
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  
  clearMocks: true,
  restoreMocks: true,
};

module.exports = createJestConfig(customJestConfig);