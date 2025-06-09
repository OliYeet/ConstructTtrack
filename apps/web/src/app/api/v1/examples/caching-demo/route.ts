/**
 * API Caching Demo Endpoint
 * Demonstrates different caching strategies and configurations
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';

// Demo endpoint with short-term caching (1 minute)
export const GET = withApiMiddleware(
  {
    GET: async (request: NextRequest) => {
      const url = new URL(request.url);
      const delay = parseInt(url.searchParams.get('delay') || '0', 10);

      // Simulate processing time
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return createSuccessResponse({
        message: 'Short-term caching demo',
        timestamp: new Date().toISOString(),
        processingTime: delay,
        note: 'This response is cached for 1 minute',
        cacheInfo: {
          strategy: 'cache-first',
          ttl: '60 seconds',
          staleWhileRevalidate: '30 seconds',
        },
      });
    },
  },
  { cache: 'short' }
);

// Demo endpoint with medium-term caching (5 minutes)
export const POST = withApiMiddleware(
  {
    POST: async (request: NextRequest) => {
      const body = await request.json();

      return createSuccessResponse({
        message: 'Medium-term caching demo',
        receivedData: body,
        timestamp: new Date().toISOString(),
        note: 'This response is cached for 5 minutes',
        cacheInfo: {
          strategy: 'cache-first',
          ttl: '300 seconds (5 minutes)',
          staleWhileRevalidate: '60 seconds',
        },
      });
    },
  },
  { cache: 'medium' }
);

// Demo endpoint with long-term caching (1 hour)
export const PUT = withApiMiddleware(
  {
    PUT: async (request: NextRequest) => {
      const body = await request.json();

      return createSuccessResponse({
        message: 'Long-term caching demo',
        data: body,
        timestamp: new Date().toISOString(),
        note: 'This response is cached for 1 hour',
        cacheInfo: {
          strategy: 'cache-first',
          ttl: '3600 seconds (1 hour)',
          staleWhileRevalidate: '300 seconds (5 minutes)',
        },
      });
    },
  },
  { cache: 'long' }
);

// Demo endpoint with static caching (24 hours)
export const PATCH = withApiMiddleware(
  {
    PATCH: async (_request: NextRequest) => {
      return createSuccessResponse({
        message: 'Static caching demo',
        timestamp: new Date().toISOString(),
        note: 'This response is cached for 24 hours',
        staticData: {
          version: '1.0.0',
          features: ['caching', 'rate-limiting', 'security'],
          documentation: '/docs/api/caching',
        },
        cacheInfo: {
          strategy: 'cache-first',
          ttl: '86400 seconds (24 hours)',
          staleWhileRevalidate: '3600 seconds (1 hour)',
        },
      });
    },
  },
  { cache: 'static' }
);

// Demo endpoint with user-specific caching
export const DELETE = withApiMiddleware(
  {
    DELETE: async (request: NextRequest) => {
      const user = (request as any).context?.user;

      return createSuccessResponse({
        message: 'User-specific caching demo',
        user: {
          id: user?.id || 'anonymous',
          role: user?.role || 'guest',
        },
        timestamp: new Date().toISOString(),
        note: 'This response is cached per user for 5 minutes',
        cacheInfo: {
          strategy: 'cache-first',
          ttl: '300 seconds (5 minutes)',
          scope: 'user-specific',
          private: true,
        },
      });
    },
  },
  {
    cache: 'user',
    requireAuth: true,
  }
);
