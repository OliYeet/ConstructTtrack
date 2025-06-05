/**
 * Rate Limiting Demo API Route
 * Demonstrates different rate limiting configurations
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';

// Demo endpoint with default API rate limiting (100 requests per 15 minutes)
export const GET = withApiMiddleware({
  GET: async (_request: NextRequest) => {
    return createSuccessResponse({
      message: 'Default rate limiting demo',
      rateLimit: 'api (100 requests per 15 minutes)',
      timestamp: new Date().toISOString(),
    });
  },
});

// Demo endpoint with strict rate limiting (5 requests per minute)
export const POST = withApiMiddleware(
  {
    POST: async (_request: NextRequest) => {
      return createSuccessResponse({
        message: 'Strict rate limiting demo',
        rateLimit: 'strict (5 requests per minute)',
        timestamp: new Date().toISOString(),
      });
    },
  },
  { rateLimit: 'strict' }
);

// Demo endpoint with custom rate limiting (20 requests per 5 minutes)
export const PUT = withApiMiddleware(
  {
    PUT: async (_request: NextRequest) => {
      return createSuccessResponse({
        message: 'Custom rate limiting demo',
        rateLimit: 'custom (20 requests per 5 minutes)',
        timestamp: new Date().toISOString(),
      });
    },
  },
  {
    rateLimit: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 20,
      enableHeaders: true,
      message: 'Custom rate limit exceeded - try again in 5 minutes',
    },
  }
);

// Demo endpoint with no rate limiting
export const DELETE = withApiMiddleware(
  {
    DELETE: async (_request: NextRequest) => {
      return createSuccessResponse({
        message: 'No rate limiting demo',
        rateLimit: 'disabled',
        timestamp: new Date().toISOString(),
      });
    },
  },
  { rateLimit: false }
);
