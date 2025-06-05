/**
 * Enhanced Logging Demo API Route
 * Demonstrates different logging levels and detailed request/response logging
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { BaseApiError } from '@/lib/errors/api-errors';

// Demo endpoint with basic logging (default)
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const url = new URL(request.url);
    const logLevel = url.searchParams.get('level') || 'basic';

    return createSuccessResponse({
      message: 'Basic logging demo',
      logLevel,
      timestamp: new Date().toISOString(),
      note: 'This endpoint uses standard API logging',
    });
  },
});

// Demo endpoint with detailed logging enabled
export const POST = withApiMiddleware(
  {
    POST: async (_request: NextRequest) => {
      const body = await request.json();

      return createSuccessResponse({
        message: 'Detailed logging demo',
        receivedData: body,
        timestamp: new Date().toISOString(),
        note: 'This endpoint logs detailed request/response information including headers and body',
      });
    },
  },
  { enableDetailedLogging: true }
);

// Demo endpoint that simulates an error for error logging
export const PUT = withApiMiddleware(
  {
    PUT: async (request: NextRequest) => {
      const url = new URL(request.url);
      const shouldError = url.searchParams.get('error') === 'true';

      if (shouldError) {
        throw new BaseApiError(
          'Simulated error for logging demo',
          400,
          'DEMO_ERROR'
        );
      }

      return createSuccessResponse({
        message: 'Error logging demo',
        timestamp: new Date().toISOString(),
        note: 'Add ?error=true to trigger an error for error logging demonstration',
      });
    },
  },
  { enableDetailedLogging: true }
);

// Demo endpoint with authentication required and detailed logging
export const PATCH = withApiMiddleware(
  {
    PATCH: async (request: NextRequest) => {
      const body = await request.json();

      return createSuccessResponse({
        message: 'Authenticated detailed logging demo',
        user: (request as any).context?.user,
        receivedData: body,
        timestamp: new Date().toISOString(),
        note: 'This endpoint requires authentication and logs detailed information',
      });
    },
  },
  {
    requireAuth: true,
    enableDetailedLogging: true,
  }
);

// Demo endpoint that processes large payloads to test body truncation
export const DELETE = withApiMiddleware(
  {
    DELETE: async (_request: NextRequest) => {
      return createSuccessResponse({
        message: 'Large payload logging demo',
        timestamp: new Date().toISOString(),
        note: 'Send a large request body to test body truncation in logs',
        bodyTruncationLimit: '1000 characters',
      });
    },
  },
  { enableDetailedLogging: true }
);
