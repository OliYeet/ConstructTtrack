/**
 * API Errors Unit Tests
 * Tests for error handling classes and utilities
 */

import {
  BaseApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  DatabaseError,
  ExternalServiceError,
  createValidationError,
  createNotFoundError,
  isApiError,
  isValidationError,
  ERROR_CODES,
} from '../api-errors';

describe('BaseApiError', () => {
  it('should create a base API error with all properties', () => {
    const error = new BaseApiError(
      'Test error',
      400,
      'TEST_ERROR',
      { detail: 'test' },
      'testField'
    );

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error.field).toBe('testField');
    expect(error.name).toBe('BaseApiError');
  });

  it('should convert to API error format', () => {
    const error = new BaseApiError('Test error', 400, 'TEST_ERROR');
    const apiError = error.toApiError();

    expect(apiError).toEqual({
      code: 'TEST_ERROR',
      message: 'Test error',
      statusCode: 400,
      details: undefined,
      field: undefined,
    });
  });
});

describe('ValidationError', () => {
  it('should create a validation error with correct defaults', () => {
    const error = new ValidationError('Invalid input', undefined, 'email');

    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.field).toBe('email');
  });

  it('should include details when provided', () => {
    const details = { zodError: [] };
    const error = new ValidationError('Invalid input', details, 'email');

    expect(error.details).toEqual(details);
    expect(error.field).toBe('email');
  });
});

describe('AuthenticationError', () => {
  it('should create an authentication error with default message', () => {
    const error = new AuthenticationError();

    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('should create an authentication error with custom message', () => {
    const error = new AuthenticationError('Invalid token');

    expect(error.message).toBe('Invalid token');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });
});

describe('AuthorizationError', () => {
  it('should create an authorization error with default message', () => {
    const error = new AuthorizationError();

    expect(error.message).toBe('Insufficient permissions');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('should create an authorization error with custom message', () => {
    const error = new AuthorizationError('Access denied');

    expect(error.message).toBe('Access denied');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('NotFoundError', () => {
  it('should create a not found error with default resource', () => {
    const error = new NotFoundError();

    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should create a not found error with custom resource', () => {
    const error = new NotFoundError('User');

    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('should create a conflict error', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.message).toBe('Resource already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });
});

describe('RateLimitError', () => {
  it('should create a rate limit error', () => {
    const error = new RateLimitError(60);

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.details).toEqual({ retryAfter: 60 });
  });
});

describe('InternalServerError', () => {
  it('should create an internal server error with default message', () => {
    const error = new InternalServerError();

    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should create an internal server error with custom message', () => {
    const error = new InternalServerError('Database connection failed');

    expect(error.message).toBe('Database connection failed');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('DatabaseError', () => {
  it('should create a database error', () => {
    const error = new DatabaseError('Connection timeout');

    expect(error.message).toBe('Connection timeout');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('DATABASE_ERROR');
  });
});

describe('ExternalServiceError', () => {
  it('should create an external service error with default message', () => {
    const error = new ExternalServiceError('PaymentService');

    expect(error.message).toBe(
      'External service PaymentService is unavailable'
    );
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.details).toEqual({ service: 'PaymentService' });
  });

  it('should create an external service error with custom message', () => {
    const error = new ExternalServiceError('PaymentService', 'Service is down');

    expect(error.message).toBe('Service is down');
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.details).toEqual({ service: 'PaymentService' });
  });
});

describe('Error Factory Functions', () => {
  it('should create validation error using factory', () => {
    const error = createValidationError('email', 'Invalid email format');

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.field).toBe('email');
    expect(error.message).toBe('Invalid email format');
  });

  it('should create not found error using factory', () => {
    const error = createNotFoundError('Project');

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Project not found');
  });
});

describe('Type Guards', () => {
  it('should identify API errors correctly', () => {
    const apiError = new ValidationError('Test error');
    const regularError = new Error('Regular error');

    expect(isApiError(apiError)).toBe(true);
    expect(isApiError(regularError)).toBe(false);
  });

  it('should identify validation errors correctly', () => {
    const validationError = new ValidationError('Test error');
    const authError = new AuthenticationError('Test error');
    const regularError = new Error('Regular error');

    expect(isValidationError(validationError)).toBe(true);
    expect(isValidationError(authError)).toBe(false);
    expect(isValidationError(regularError)).toBe(false);
  });
});

describe('Error Codes', () => {
  it('should have all expected error codes', () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ERROR_CODES.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
    expect(ERROR_CODES.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
    expect(ERROR_CODES.CONFLICT).toBe('CONFLICT');
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ERROR_CODES.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    expect(ERROR_CODES.DATABASE_ERROR).toBe('DATABASE_ERROR');
    expect(ERROR_CODES.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
  });
});
