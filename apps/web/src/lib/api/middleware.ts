/**
 * API Middleware
 * Centralized middleware for request processing, error handling, and response formatting
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiHandler, RequestContext, HttpMethod } from '@/types/api';
import { BaseApiError, InternalServerError } from '@/lib/errors/api-errors';
import {
  createErrorResponse,
  createMethodNotAllowedResponse,
  addCorsHeaders,
} from '@/lib/api/response';
import { logRequest, logResponse, logError } from '@/lib/api/logger';

// Rate limiting store (in-memory for development, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

// Default rate limit configuration
const defaultRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
};

// Generate rate limit key
function generateRateLimitKey(
  request: NextRequest,
  config: RateLimitConfig
): string {
  if (config.keyGenerator) {
    return config.keyGenerator(request);
  }

  // Use IP address as default key
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `rate_limit:${ip}`;
}

// Check rate limit
function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = defaultRateLimit
): boolean {
  const key = generateRateLimitKey(request, config);
  const now = Date.now();

  // Get current rate limit data
  const current = rateLimitStore.get(key);

  if (!current || current.resetTime <= now) {
    // Reset or initialize rate limit
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  if (current.count >= config.maxRequests) {
    return false; // Rate limit exceeded
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);
  return true;
}

// API route wrapper with middleware
export function withApiMiddleware(
  handlers: Partial<Record<HttpMethod, ApiHandler>>,
  options: {
    requireAuth?: boolean;
    requireRoles?: string[];
    rateLimit?: RateLimitConfig;
    cors?: boolean;
  } = {}
) {
  return async function handler(
    request: NextRequest,
    context: { params?: Record<string, string> }
  ): Promise<NextResponse> {
    const startTime = Date.now();
    let requestContext: RequestContext | undefined;

    try {
      // Create basic request context (without auth for now)
      requestContext = {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      };

      // Log incoming request
      logRequest(request, requestContext);

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        if (options.cors !== false) {
          return addCorsHeaders(new NextResponse(null, { status: 200 }));
        }
      }

      // Check if method is allowed
      const method = request.method as HttpMethod;
      const handler = handlers[method];

      if (!handler) {
        const allowedMethods = Object.keys(handlers);
        const response = createMethodNotAllowedResponse(
          allowedMethods,
          requestContext.requestId
        );

        if (options.cors !== false) {
          addCorsHeaders(response);
        }

        const duration = Date.now() - startTime;
        logResponse(request, 405, duration, requestContext);
        return response;
      }

      // Rate limiting
      if (options.rateLimit !== false) {
        const rateLimitConfig = options.rateLimit || defaultRateLimit;
        if (!checkRateLimit(request, rateLimitConfig)) {
          const response = createErrorResponse(
            new BaseApiError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'),
            requestContext.requestId
          );

          if (options.cors !== false) {
            addCorsHeaders(response);
          }

          const duration = Date.now() - startTime;
          logResponse(request, 429, duration, requestContext);
          return response;
        }
      }

      // Authentication check (simplified for now)
      if (options.requireAuth) {
        // TODO: Implement proper authentication check
        // For now, we'll skip authentication to get the basic API structure working
        const response = createErrorResponse(
          new BaseApiError(
            'Authentication not yet implemented',
            501,
            'NOT_IMPLEMENTED'
          ),
          requestContext.requestId
        );

        if (options.cors !== false) {
          addCorsHeaders(response);
        }

        const duration = Date.now() - startTime;
        logResponse(request, 501, duration, requestContext);
        return response;
      }

      // Add context to request
      (request as NextRequest & { context: RequestContext }).context =
        requestContext;

      // Execute handler
      const response = await handler(
        request as NextRequest & { context: RequestContext },
        context
      );

      // Add CORS headers if enabled
      if (options.cors !== false) {
        addCorsHeaders(response);
      }

      // Log response
      const duration = Date.now() - startTime;
      logResponse(request, response.status, duration, requestContext);

      return response;
    } catch (error) {
      // Log error
      logError('API Error', error, request, requestContext);

      // Handle known API errors
      let apiError: BaseApiError;
      if (error instanceof BaseApiError) {
        apiError = error;
      } else {
        // Wrap unknown errors
        apiError = new InternalServerError(
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : 'Internal server error'
        );
      }

      const response = createErrorResponse(apiError, requestContext?.requestId);

      // Add CORS headers if enabled
      if (options.cors !== false) {
        addCorsHeaders(response);
      }

      // Log error response
      const duration = Date.now() - startTime;
      logResponse(request, response.status, duration, requestContext);

      return response;
    }
  };
}

// Convenience wrapper for authenticated routes
export function withAuth(
  handlers: Partial<Record<HttpMethod, ApiHandler>>,
  options: Omit<Parameters<typeof withApiMiddleware>[1], 'requireAuth'> = {}
) {
  return withApiMiddleware(handlers, { ...options, requireAuth: true });
}

// Convenience wrapper for admin-only routes
export function withAdmin(
  handlers: Partial<Record<HttpMethod, ApiHandler>>,
  options: Omit<
    Parameters<typeof withApiMiddleware>[1],
    'requireAuth' | 'requireRoles'
  > = {}
) {
  return withApiMiddleware(handlers, {
    ...options,
    requireAuth: true,
    requireRoles: ['admin'],
  });
}

// Convenience wrapper for manager+ routes
export function withManager(
  handlers: Partial<Record<HttpMethod, ApiHandler>>,
  options: Omit<
    Parameters<typeof withApiMiddleware>[1],
    'requireAuth' | 'requireRoles'
  > = {}
) {
  return withApiMiddleware(handlers, {
    ...options,
    requireAuth: true,
    requireRoles: ['admin', 'manager'],
  });
}
