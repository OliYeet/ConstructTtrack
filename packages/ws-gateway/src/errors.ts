/**
 * Enhanced Error Handling for WebSocket Gateway
 * Implements comprehensive error management with security focus
 */

import type { ErrorResponse } from './types';

export class GatewayError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GatewayError);
    }
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends GatewayError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends GatewayError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'RATE_LIMIT_ERROR', 429, context);
    this.name = 'RateLimitError';
  }
}

export class ConnectionError extends GatewayError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', 503, context);
    this.name = 'ConnectionError';
  }
}

/**
 * Factory for creating standardized gateway errors
 */
export class ErrorFactory {
  static validation(
    message: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError(message, context);
  }

  static authentication(
    message: string,
    context?: Record<string, unknown>
  ): AuthenticationError {
    return new AuthenticationError(message, context);
  }

  static rateLimit(
    message: string,
    context?: Record<string, unknown>
  ): RateLimitError {
    return new RateLimitError(message, context);
  }

  static connection(
    message: string,
    context?: Record<string, unknown>
  ): ConnectionError {
    return new ConnectionError(message, context);
  }

  static generic(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, unknown>
  ): GatewayError {
    return new GatewayError(message, code, statusCode, context);
  }
}

/**
 * Centralized error handling utilities
 */
export class ErrorHandler {
  /**
   * Normalize any error into a GatewayError
   */
  static normalize(
    error: unknown,
    defaultMessage: string = 'Unknown error'
  ): GatewayError {
    if (error instanceof GatewayError) {
      return error;
    }

    if (error instanceof Error) {
      return new GatewayError(
        error.message || defaultMessage,
        'INTERNAL_ERROR',
        500,
        { originalError: error.name, stack: error.stack }
      );
    }

    if (typeof error === 'string') {
      return new GatewayError(error, 'INTERNAL_ERROR', 500);
    }

    return new GatewayError(defaultMessage, 'UNKNOWN_ERROR', 500, {
      originalError: String(error),
    });
  }

  /**
   * Convert error to structured log entry
   */
  static toLogEntry(
    error: GatewayError,
    connectionId?: string
  ): Record<string, unknown> {
    return {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        context: error.context,
        connectionId,
      },
    };
  }

  /**
   * Convert error to safe client response
   */
  static toClientResponse(error: GatewayError): ErrorResponse {
    // Don't expose internal error details to clients
    const safeMessage =
      error.statusCode >= 500 ? 'Internal server error' : error.message;

    return {
      type: 'error',
      code: error.code,
      message: safeMessage,
      timestamp: error.timestamp,
    };
  }

  /**
   * Check if error should be logged as warning vs error
   */
  static shouldLogAsWarning(error: GatewayError): boolean {
    return error.statusCode < 500;
  }

  /**
   * Extract safe error context for logging (removes sensitive data)
   */
  static getSafeContext(
    context?: Record<string, unknown>
  ): Record<string, unknown> {
    if (!context) return {};

    const safeContext = { ...context };

    // Remove potentially sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
    ];
    sensitiveFields.forEach(field => {
      if (field in safeContext) {
        safeContext[field] = '[REDACTED]';
      }
    });

    return safeContext;
  }
}
