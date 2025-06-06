/**
 * Jest test setup
 */

/* eslint-env jest */
/* eslint-disable no-undef */

// Mock logger to reduce noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
