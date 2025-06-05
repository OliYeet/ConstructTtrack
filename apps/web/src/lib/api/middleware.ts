/**
 * API Middleware
 * Centralized middleware for request processing, error handling, and response formatting
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  CacheConfig,
  CacheStrategy,
  cacheConfigs,
  cacheManager,
} from './caching';

import { createRequestContext } from '@/lib/api/auth';
import { logRequest, logResponse, logError } from '@/lib/api/logger';
import {
  createErrorResponse,
  createMethodNotAllowedResponse,
  addCorsHeaders,
} from '@/lib/api/response';
import { BaseApiError, InternalServerError } from '@/lib/errors/api-errors';
import {
  logRequest as enhancedLogRequest,
  logResponse as enhancedLogResponse,
  logError as enhancedLogError,
  getLogger,
} from '@/lib/logging';
import { apiMetricsTracker } from '@/lib/monitoring/api-metrics';
// import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import {
  applySecurityHeaders,
  defaultSecurityConfig,
} from '@/lib/security/headers';
import {
  createRateLimitMiddleware,
  rateLimitConfigs,
  type RateLimitConfig as AdvancedRateLimitConfig,
} from '@/lib/security/rate-limiting';
import { ApiHandler, RequestContext, HttpMethod } from '@/types/api';

// Legacy rate limiting configuration (kept for backward compatibility)
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

// Helper function to apply all headers (CORS + Security)
function applyApiHeaders(
  response: NextResponse,
  enableCors: boolean = true
): NextResponse {
  // Apply security headers
  applySecurityHeaders(response, defaultSecurityConfig);

  // Apply CORS headers if enabled
  if (enableCors) {
    addCorsHeaders(response);
  }

  return response;
}

// Detailed request logging function
async function logDetailedRequest(
  request: NextRequest,
  context?: RequestContext
): Promise<void> {
  try {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};

    // Collect headers (excluding sensitive ones)
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    request.headers.forEach((value, key) => {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        headers[key] = value;
      } else {
        headers[key] = '[REDACTED]';
      }
    });

    // Try to read request body for POST/PUT/PATCH requests
    let body: any = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        // Clone the request to avoid consuming the original body
        const clonedRequest = request.clone();
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          body = await clonedRequest.json();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await clonedRequest.formData();
          body = Object.fromEntries(formData.entries());
        } else if (contentType.includes('text/')) {
          body = await clonedRequest.text();
        }
      } catch {
        body = '[Unable to parse body]';
      }
    }

    // Use the structured logger directly for detailed logging
    const logger = getLogger();
    await logger.info('Detailed API Request', {
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      metadata: {
        detailedLogging: true,
        url: {
          pathname: url.pathname,
          search: url.search,
          searchParams: Object.fromEntries(url.searchParams.entries()),
        },
        headers,
        body: body
          ? typeof body === 'string'
            ? body.substring(0, 1000)
            : body
          : null,
        contentLength: request.headers.get('content-length'),
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
      },
    });
  } catch (error) {
    await enhancedLogError(
      'Failed to log detailed request',
      error,
      request,
      context
    );
  }
}

// Detailed response logging function
async function logDetailedResponse(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  context?: RequestContext
): Promise<void> {
  try {
    const responseHeaders: Record<string, string> = {};

    // Collect response headers
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Try to read response body for logging (non-destructive)
    let responseBody: any = null;
    let contentLength = 0;

    try {
      const contentType = response.headers.get('content-type') || '';
      const contentLengthHeader = response.headers.get('content-length');
      contentLength = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : 0;

      // Only log response body for small JSON responses to avoid memory issues
      if (contentType.includes('application/json') && contentLength < 10000) {
        // Clone response to avoid consuming the original
        const clonedResponse = response.clone();
        responseBody = await clonedResponse.json();
      }
    } catch {
      responseBody = '[Unable to parse response body]';
    }

    // Use the structured logger directly for detailed response logging
    const logger = getLogger();
    await logger.info('Detailed API Response', {
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      response: {
        statusCode: response.status,
        contentLength,
      },
      performance: {
        duration,
        memoryUsage:
          typeof process !== 'undefined' ? process.memoryUsage() : undefined,
      },
      metadata: {
        detailedLogging: true,
        responseDetails: {
          headers: responseHeaders,
          body: responseBody,
          contentType: response.headers.get('content-type'),
        },
      },
    });
  } catch (error) {
    await enhancedLogError(
      'Failed to log detailed response',
      error,
      request,
      context
    );
  }
}

// Detailed metrics collection function
async function recordDetailedMetrics(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  context?: RequestContext
): Promise<void> {
  try {
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;

    // Enhanced metrics with additional context
    const tags = {
      endpoint,
      method,
      status: response.status.toString(),
      authenticated: context?.user ? 'true' : 'false',
      userRole: context?.user?.role || 'anonymous',
      organizationId: context?.organizationId || 'unknown',
    };

    // Request size metrics
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const logger = getLogger();
      await logger.info('API Metric: Request Size', {
        requestId: context?.requestId,
        userId: context?.user?.id,
        organizationId: context?.organizationId,
        metadata: {
          metricType: 'request_size',
          value: parseInt(contentLength, 10),
          unit: 'bytes',
          tags,
        },
      });
    }

    // Response size metrics
    const responseSize = response.headers.get('content-length');
    if (responseSize) {
      const logger = getLogger();
      await logger.info('API Metric: Response Size', {
        requestId: context?.requestId,
        userId: context?.user?.id,
        organizationId: context?.organizationId,
        metadata: {
          metricType: 'response_size',
          value: parseInt(responseSize, 10),
          unit: 'bytes',
          tags,
        },
      });
    }

    // User activity metrics
    if (context?.user) {
      const logger = getLogger();
      await logger.info('API Metric: User Activity', {
        requestId: context?.requestId,
        userId: context?.user?.id,
        organizationId: context?.organizationId,
        metadata: {
          metricType: 'user_activity',
          value: 1,
          unit: 'count',
          tags: {
            ...tags,
            userId: context.user.id,
            userRole: context.user.role,
          },
        },
      });
    }

    // Error rate metrics
    if (response.status >= 400) {
      const logger = getLogger();
      await logger.info('API Metric: Error Rate', {
        requestId: context?.requestId,
        userId: context?.user?.id,
        organizationId: context?.organizationId,
        metadata: {
          metricType: 'api_error',
          value: 1,
          unit: 'count',
          tags: {
            ...tags,
            errorType: response.status >= 500 ? 'server_error' : 'client_error',
          },
        },
      });
    }

    // Performance metrics by endpoint
    const logger = getLogger();
    await logger.info('API Metric: Endpoint Performance', {
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      performance: {
        duration,
        memoryUsage:
          typeof process !== 'undefined' ? process.memoryUsage() : undefined,
      },
      metadata: {
        metricType: 'endpoint_performance',
        value: duration,
        unit: 'ms',
        tags,
      },
    });

    // Rate limiting metrics (if rate limited)
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining) {
      const logger = getLogger();
      await logger.info('API Metric: Rate Limit Usage', {
        requestId: context?.requestId,
        userId: context?.user?.id,
        organizationId: context?.organizationId,
        metadata: {
          metricType: 'rate_limit_usage',
          value: parseInt(rateLimitRemaining, 10),
          unit: 'remaining',
          tags,
        },
      });
    }
  } catch (error) {
    await enhancedLogError(
      'Failed to record detailed metrics',
      error,
      request,
      context
    );
  }
}

// API route wrapper with middleware
export function withApiMiddleware(
  handlers: Partial<Record<HttpMethod, ApiHandler>>,
  options: {
    requireAuth?: boolean;
    requireRoles?: string[];
    rateLimit?:
      | RateLimitConfig
      | AdvancedRateLimitConfig
      | keyof typeof rateLimitConfigs
      | false;
    cors?: boolean;
    enableDetailedLogging?: boolean; // New option for detailed request/response logging
    enableDetailedMetrics?: boolean; // New option for detailed metrics collection
    cache?: CacheConfig | keyof typeof cacheConfigs | false; // New option for API caching
    cacheStrategy?: CacheStrategy; // Cache strategy
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

      // Detailed request logging if enabled
      if (options.enableDetailedLogging) {
        await logDetailedRequest(request, requestContext);
      }

      // Start API metrics tracking
      const requestId = apiMetricsTracker.recordRequestStart(
        request,
        requestContext
      );

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        if (options.cors !== false) {
          return applyApiHeaders(new NextResponse(null, { status: 200 }), true);
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

        applyApiHeaders(response, options.cors !== false);

        const duration = Date.now() - startTime;
        logResponse(request, 405, duration, requestContext);
        return response;
      }

      // Advanced rate limiting
      if (options.rateLimit !== false) {
        let rateLimitMiddleware;

        if (typeof options.rateLimit === 'string') {
          // Use predefined configuration
          rateLimitMiddleware = createRateLimitMiddleware(options.rateLimit);
        } else if (options.rateLimit && typeof options.rateLimit === 'object') {
          // Use custom configuration
          rateLimitMiddleware = createRateLimitMiddleware(options.rateLimit);
        } else {
          // Use default API rate limiting
          rateLimitMiddleware = createRateLimitMiddleware('api');
        }

        const rateLimitResult = await rateLimitMiddleware(request);

        if (!rateLimitResult.allowed && rateLimitResult.response) {
          // Apply security headers to rate limit response
          const response = new NextResponse(rateLimitResult.response.body, {
            status: rateLimitResult.response.status,
            headers: rateLimitResult.response.headers,
          });

          applyApiHeaders(response, options.cors !== false);

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

          applyApiHeaders(response, options.cors !== false);

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

          applyApiHeaders(response, options.cors !== false);

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

          applyApiHeaders(response, options.cors !== false);

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

      // Check cache for GET requests
      if (request.method === 'GET' && options.cache !== false) {
        const cacheConfig =
          typeof options.cache === 'string'
            ? cacheConfigs[options.cache]
            : options.cache || cacheConfigs.medium;

        const cacheStrategy =
          options.cacheStrategy || CacheStrategy.CACHE_FIRST;

        // Generate cache key
        const additionalKeys: string[] = [];

        if (
          'private' in cacheConfig &&
          cacheConfig.private &&
          requestContext.user
        ) {
          additionalKeys.push(`user:${requestContext.user.id}`);
        }

        if (
          'tags' in cacheConfig &&
          (cacheConfig as any).tags?.includes('organization') &&
          requestContext.organizationId
        ) {
          additionalKeys.push(`org:${requestContext.organizationId}`);
        }

        const cacheKey = cacheManager.generateKey(request, additionalKeys);

        // Check for conditional requests (ETag)
        const ifNoneMatch = request.headers.get('if-none-match');

        // Try to get from cache
        const cachedEntry = await cacheManager.get(cacheKey);

        if (cachedEntry) {
          // Check ETag for conditional requests
          if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
            const notModifiedResponse = new NextResponse(null, { status: 304 });
            applyApiHeaders(notModifiedResponse, options.cors !== false);
            return notModifiedResponse;
          }

          const isStale = cacheManager.isStale(
            cachedEntry,
            'staleWhileRevalidate' in cacheConfig
              ? cacheConfig.staleWhileRevalidate
              : undefined
          );

          // Handle cache strategies
          if (cacheStrategy === CacheStrategy.CACHE_FIRST && !isStale) {
            const cachedResponse =
              cacheManager.createCachedResponse(cachedEntry);
            applyApiHeaders(cachedResponse, options.cors !== false);

            // Log cached response
            const duration = Date.now() - startTime;
            logResponse(
              request,
              cachedResponse.status,
              duration,
              requestContext
            );

            return cachedResponse;
          }

          if (cacheStrategy === CacheStrategy.STALE_WHILE_REVALIDATE) {
            if (
              isStale &&
              'revalidateOnStale' in cacheConfig &&
              cacheConfig.revalidateOnStale
            ) {
              // Return stale data immediately, revalidate in background
              setImmediate(async () => {
                try {
                  const params = await context.params;
                  const freshResponse = await handler(
                    request as NextRequest & { context: RequestContext },
                    { params }
                  );

                  if (freshResponse.ok && freshResponse.status === 200) {
                    const responseClone = freshResponse.clone();
                    const data = await responseClone.json();
                    await cacheManager.set(cacheKey, data, cacheConfig);
                  }
                } catch (error) {
                  await enhancedLogError(
                    'Background cache revalidation failed',
                    error,
                    request,
                    requestContext
                  );
                }
              });
            }

            if (
              !isStale ||
              ('revalidateOnStale' in cacheConfig &&
                cacheConfig.revalidateOnStale)
            ) {
              const cachedResponse = cacheManager.createCachedResponse(
                cachedEntry,
                isStale
              );
              applyApiHeaders(cachedResponse, options.cors !== false);

              // Log cached response
              const duration = Date.now() - startTime;
              logResponse(
                request,
                cachedResponse.status,
                duration,
                requestContext
              );

              return cachedResponse;
            }
          }
        }
      }

      // Execute handler
      const params = await context.params;
      const response = await handler(
        request as NextRequest & { context: RequestContext },
        { params }
      );

      // Cache successful GET responses
      if (
        request.method === 'GET' &&
        options.cache !== false &&
        response.ok &&
        response.status === 200
      ) {
        try {
          const cacheConfig =
            typeof options.cache === 'string'
              ? cacheConfigs[options.cache]
              : options.cache || cacheConfigs.medium;

          const additionalKeys: string[] = [];

          if (
            'private' in cacheConfig &&
            cacheConfig.private &&
            requestContext.user
          ) {
            additionalKeys.push(`user:${requestContext.user.id}`);
          }

          if (
            'tags' in cacheConfig &&
            (cacheConfig as any).tags?.includes('organization') &&
            requestContext.organizationId
          ) {
            additionalKeys.push(`org:${requestContext.organizationId}`);
          }

          const cacheKey = cacheManager.generateKey(request, additionalKeys);
          const responseClone = response.clone();
          const data = await responseClone.json();

          await cacheManager.set(cacheKey, data, cacheConfig, {
            'Content-Type':
              response.headers.get('Content-Type') || 'application/json',
          });

          // Add cache headers to response
          const entry = await cacheManager.get(cacheKey);
          if (entry) {
            response.headers.set('ETag', entry.etag);
            response.headers.set('X-Cache', 'MISS');
            response.headers.set(
              'Cache-Control',
              cacheManager.getCacheControlHeader(entry, false)
            );
          }
        } catch (error) {
          await enhancedLogError(
            'Failed to cache response',
            error,
            request,
            requestContext
          );
        }
      }

      // Apply security and CORS headers
      applyApiHeaders(response, options.cors !== false);

      // Log response (both old and new systems)
      const duration = Date.now() - startTime;
      logResponse(request, response.status, duration, requestContext);
      await enhancedLogResponse(
        request,
        response.status,
        duration,
        requestContext
      );

      // Detailed response logging if enabled
      if (options.enableDetailedLogging) {
        await logDetailedResponse(request, response, duration, requestContext);
      }

      // Record API metrics
      apiMetricsTracker.recordRequestEnd(
        request,
        response,
        requestId,
        requestContext
      );

      // Detailed metrics collection if enabled
      if (options.enableDetailedMetrics) {
        await recordDetailedMetrics(
          request,
          response,
          duration,
          requestContext
        );
      }

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

      // Apply security and CORS headers
      applyApiHeaders(response, options.cors !== false);

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
