/**
 * API Error Classes and Utilities
 * Standardized error handling for the ConstructTrack API
 */

import { ApiError } from '@/types/api';

// Base API Error Class
export class BaseApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly field?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, any>,
    field?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.field = field;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
      statusCode: this.statusCode,
    };
  }
}

// Specific Error Classes
export class ValidationError extends BaseApiError {
  constructor(message: string, field?: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details, field);
  }
}

export class AuthenticationError extends BaseApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends BaseApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends BaseApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends BaseApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends BaseApiError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', {
      retryAfter,
    });
  }
}

export class InternalServerError extends BaseApiError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class DatabaseError extends BaseApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

export class ExternalServiceError extends BaseApiError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is unavailable`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    );
  }
}

// Error Factory Functions
export const createValidationError = (field: string, message: string) => {
  return new ValidationError(message, field);
};

export const createNotFoundError = (resource: string) => {
  return new NotFoundError(resource);
};

// Error Type Guards
export const isApiError = (error: any): error is BaseApiError => {
  return error instanceof BaseApiError;
};

export const isValidationError = (error: any): error is ValidationError => {
  return error instanceof ValidationError;
};

// Error Code Constants
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;
