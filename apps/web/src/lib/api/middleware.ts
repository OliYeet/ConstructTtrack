/**
 * API Middleware
 * Centralized middleware for request processing, error handling, and response formatting
 */

import { NextRequest, NextResponse } from 'next/server';

import { createRequestContext } from '@/lib/api/auth';
import { logRequest, logResponse, logError } from '@/lib/api/logger';
import {
  createErrorResponse,
  createMethodNotAllowedResponse,
  addCorsHeaders,
  addSecurityHeaders,
} from '@/lib/api/response';
import { BaseApiError, InternalServerError } from '@/lib/errors/api-errors';
import {
  logRequest as enhancedLogRequest,
  logResponse as enhancedLogResponse,
  logError as enhancedLogError,
} from '@/lib/logging';
import { apiMetricsTracker } from '@/lib/monitoring/api-metrics';
// import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { ApiHandler, RequestContext, HttpMethod } from '@/types/api';

// Rate limiting store
// TODO: Replace with Redis or other persistent storage for production
// WARNING: In-memory storage only works for single-instance deployments
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
  const ipHeader =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '';
  const clientIp = ipHeader.split(',')[0].trim() || 'unknown';
  return `rate_limit:${clientIp}`;
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
    rateLimit?: RateLimitConfig | false;
    cors?: boolean;
  } = {}
) {
  return async function handler(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> {
    const startTime = Date.now();
    let requestContext: RequestContext | undefined;

    try {
      // Create request context with authentication
      requestContext = await createRequestContext(request);

      // Log incoming request (both old and new systems)
      logRequest(request, requestContext);
      await enhancedLogRequest(request, requestContext);

      // Start API metrics tracking
      const requestId = apiMetricsTracker.recordRequestStart(
        request,
        requestContext
      );

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        const optionsResponse = new NextResponse(null, { status: 200 });
        if (options.cors !== false) addCorsHeaders(optionsResponse);
        addSecurityHeaders(optionsResponse);
        return optionsResponse;
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
        if (options.cors !== false) addCorsHeaders(response);
        // addSecurityHeaders(response);
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
          if (options.cors !== false) addCorsHeaders(response);
          // addSecurityHeaders(response);
          const duration = Date.now() - startTime;
          logResponse(request, 429, duration, requestContext);
          return response;
        }
      }

      // Authentication check
      if (options.requireAuth) {
        if (!requestContext.user) {
          const response = createErrorResponse(
            new BaseApiError('Authentication required', 401, 'UNAUTHORIZED'),
            requestContext.requestId
          );
          if (options.cors !== false) addCorsHeaders(response);
          // addSecurityHeaders(response);
          const duration = Date.now() - startTime;
          logResponse(request, 401, duration, requestContext);
          return response;
        }
      }

      // Role-based authorization check
      if (options.requireRoles && options.requireRoles.length > 0) {
        if (!requestContext.user) {
          const response = createErrorResponse(
            new BaseApiError('Authentication required', 401, 'UNAUTHORIZED'),
            requestContext.requestId
          );
          if (options.cors !== false) addCorsHeaders(response);
          // addSecurityHeaders(response);
          const duration = Date.now() - startTime;
          logResponse(request, 401, duration, requestContext);
          return response;
        }

        if (!options.requireRoles.includes(requestContext.user.role)) {
          const response = createErrorResponse(
            new BaseApiError(
              `Access denied. Required roles: ${options.requireRoles.join(', ')}`,
              403,
              'FORBIDDEN'
            ),
            requestContext.requestId
          );
          if (options.cors !== false) addCorsHeaders(response);
          // addSecurityHeaders(response);
          const duration = Date.now() - startTime;
          logResponse(request, 403, duration, requestContext);
          return response;
        }
      }

      // Add context to request headers for downstream use
      const headers = new Headers(request.headers);
      headers.set(
        'x-request-context',
        JSON.stringify({
          requestId: requestContext.requestId,
          userId: requestContext.user?.id,
          userRole: requestContext.user?.role,
        })
      );

      // Execute handler
      const params = await context.params;
      const response = await handler(
        request as NextRequest & { context: RequestContext },
        { params }
      );

      // Add CORS and security headers if enabled
      if (options.cors !== false) addCorsHeaders(response);
      addSecurityHeaders(response);

      // Log response (both old and new systems)
      const duration = Date.now() - startTime;
      logResponse(request, response.status, duration, requestContext);
      await enhancedLogResponse(
        request,
        response.status,
        duration,
        requestContext
      );

      // Record API metrics
      apiMetricsTracker.recordRequestEnd(
        request,
        response,
        requestId,
        requestContext
      );

      return response;
    } catch (error) {
      // Log error (both old and new systems)
      logError('API Error', error, request, requestContext);
      await enhancedLogError('API Error', error, request, requestContext);

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

      // Add CORS and security headers if enabled
      if (options.cors !== false) addCorsHeaders(response);
      // addSecurityHeaders(response);

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

// Alias for backward compatibility
export const withApiHandler = withApiMiddleware;
