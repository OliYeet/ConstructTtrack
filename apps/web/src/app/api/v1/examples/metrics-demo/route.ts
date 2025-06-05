/**
 * Enhanced Metrics Demo API Route
 * Demonstrates different metrics collection levels and capabilities
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { BaseApiError } from '@/lib/errors/api-errors';

// Demo endpoint with basic metrics (default)
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const url = new URL(request.url);
    const delay = parseInt(url.searchParams.get('delay') || '0', 10);

    // Simulate processing time
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return createSuccessResponse({
      message: 'Basic metrics demo',
      delay,
      timestamp: new Date().toISOString(),
      note: 'This endpoint uses standard API metrics collection',
      metricsCollected: [
        'response_time',
        'request_count',
        'status_code_distribution',
        'endpoint_statistics',
      ],
    });
  },
});

// Demo endpoint with detailed metrics enabled
export const POST = withApiMiddleware(
  {
    POST: async (request: NextRequest) => {
      const body = await request.json();
      const responseSize = JSON.stringify(body).length * 2; // Approximate response size

      const response = createSuccessResponse({
        message: 'Detailed metrics demo',
        receivedData: body,
        timestamp: new Date().toISOString(),
        note: 'This endpoint collects detailed metrics including request/response sizes, user activity, and performance data',
        metricsCollected: [
          'request_size',
          'response_size',
          'user_activity',
          'endpoint_performance',
          'authentication_metrics',
          'organization_metrics',
        ],
      });

      // Set content-length for metrics collection
      response.headers.set('content-length', responseSize.toString());

      return response;
    },
  },
  { enableDetailedMetrics: true }
);

// Demo endpoint that simulates different response times for performance metrics
export const PUT = withApiMiddleware(
  {
    PUT: async (request: NextRequest) => {
      const url = new URL(request.url);
      const scenario = url.searchParams.get('scenario') || 'fast';

      let delay = 0;
      let message = '';

      switch (scenario) {
        case 'fast':
          delay = 50;
          message = 'Fast response (50ms)';
          break;
        case 'medium':
          delay = 500;
          message = 'Medium response (500ms)';
          break;
        case 'slow':
          delay = 2000;
          message = 'Slow response (2s) - will trigger slow request alert';
          break;
        case 'very-slow':
          delay = 5000;
          message = 'Very slow response (5s) - performance concern';
          break;
        default:
          delay = 100;
          message = 'Default response (100ms)';
      }

      await new Promise(resolve => setTimeout(resolve, delay));

      return createSuccessResponse({
        message,
        scenario,
        actualDelay: delay,
        timestamp: new Date().toISOString(),
        note: 'Use ?scenario=fast|medium|slow|very-slow to test different performance scenarios',
      });
    },
  },
  { enableDetailedMetrics: true }
);

// Demo endpoint for error metrics
export const PATCH = withApiMiddleware(
  {
    PATCH: async (request: NextRequest) => {
      const url = new URL(request.url);
      const errorType = url.searchParams.get('error');

      switch (errorType) {
        case 'client':
          throw new BaseApiError(
            'Client error for metrics demo',
            400,
            'CLIENT_ERROR_DEMO'
          );
        case 'unauthorized':
          throw new BaseApiError(
            'Unauthorized error for metrics demo',
            401,
            'UNAUTHORIZED_DEMO'
          );
        case 'forbidden':
          throw new BaseApiError(
            'Forbidden error for metrics demo',
            403,
            'FORBIDDEN_DEMO'
          );
        case 'notfound':
          throw new BaseApiError(
            'Not found error for metrics demo',
            404,
            'NOT_FOUND_DEMO'
          );
        case 'server':
          throw new BaseApiError(
            'Server error for metrics demo',
            500,
            'SERVER_ERROR_DEMO'
          );
        default:
          return createSuccessResponse({
            message: 'Error metrics demo',
            timestamp: new Date().toISOString(),
            note: 'Add ?error=client|unauthorized|forbidden|notfound|server to trigger different error types for metrics collection',
            errorMetricsCollected: [
              'api_error count',
              'error_type classification',
              'status_code_distribution',
              'error_rate_by_endpoint',
            ],
          });
      }
    },
  },
  { enableDetailedMetrics: true }
);

// Demo endpoint with authentication required for user activity metrics
export const DELETE = withApiMiddleware(
  {
    DELETE: async (request: NextRequest) => {
      const user = (request as any).context?.user;

      return createSuccessResponse({
        message: 'Authenticated metrics demo',
        user: {
          id: user?.id,
          role: user?.role,
        },
        timestamp: new Date().toISOString(),
        note: 'This endpoint requires authentication and collects user activity metrics',
        userMetricsCollected: [
          'user_activity count',
          'requests_by_user_role',
          'authenticated_vs_anonymous',
          'organization_activity',
        ],
      });
    },
  },
  {
    requireAuth: true,
    enableDetailedMetrics: true,
  }
);
