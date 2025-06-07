/**
 * Cache Management API Endpoint
 * Provides cache statistics, invalidation, and management capabilities
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { cacheManager } from '@/lib/api/caching';

// GET /api/v1/cache - Get cache statistics and information
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      // Get specific cache entry
      const entry = await cacheManager.get(key);

      if (!entry) {
        return createSuccessResponse({
          message: 'Cache entry not found',
          key,
          exists: false,
        });
      }

      const age = Math.floor((Date.now() - entry.timestamp) / 1000);
      const remaining = Math.max(0, entry.ttl - age);

      return createSuccessResponse({
        message: 'Cache entry found',
        key,
        exists: true,
        entry: {
          etag: entry.etag,
          timestamp: new Date(entry.timestamp).toISOString(),
          ttl: entry.ttl,
          age,
          remaining,
          tags: entry.tags,
          headers: entry.headers,
          dataSize: JSON.stringify(entry.data).length,
        },
      });
    }

    // Return general cache information
    return createSuccessResponse({
      message: 'Cache management information',
      cacheStrategies: [
        'cache-first',
        'network-first',
        'stale-while-revalidate',
        'cache-only',
        'network-only',
      ],
      cacheConfigurations: {
        short: { ttl: 60, description: '1 minute cache' },
        medium: { ttl: 300, description: '5 minute cache' },
        long: { ttl: 3600, description: '1 hour cache' },
        static: { ttl: 86400, description: '24 hour cache' },
        user: { ttl: 300, description: 'User-specific 5 minute cache' },
        organization: {
          ttl: 600,
          description: 'Organization-specific 10 minute cache',
        },
      },
      operations: {
        get: 'GET /api/v1/cache?key={cacheKey} - Get cache entry info',
        invalidateTag: 'DELETE /api/v1/cache?tag={tagName} - Invalidate by tag',
        invalidateKey:
          'DELETE /api/v1/cache?key={cacheKey} - Invalidate specific key',
        clear: 'DELETE /api/v1/cache?action=clear - Clear all cache',
      },
    });
  },
});

// DELETE /api/v1/cache - Cache invalidation operations
export const DELETE = withApiMiddleware(
  {
    DELETE: async (request: NextRequest) => {
      const url = new URL(request.url);
      const key = url.searchParams.get('key');
      const tag = url.searchParams.get('tag');
      const action = url.searchParams.get('action');

      if (key) {
        // Invalidate specific cache key
        await cacheManager.delete(key);

        return createSuccessResponse({
          message: 'Cache key invalidated',
          key,
          action: 'key_invalidated',
        });
      }

      if (tag) {
        // Invalidate by tag
        await cacheManager.invalidateByTag(tag);

        return createSuccessResponse({
          message: 'Cache entries invalidated by tag',
          tag,
          action: 'tag_invalidated',
        });
      }

      if (action === 'clear') {
        // Clear all cache
        await (
          cacheManager as { store: { clear(): Promise<void> } }
        ).store.clear();

        return createSuccessResponse({
          message: 'All cache entries cleared',
          action: 'cache_cleared',
        });
      }

      return createSuccessResponse({
        message: 'No cache operation specified',
        availableOperations: [
          'key={cacheKey} - Invalidate specific key',
          'tag={tagName} - Invalidate by tag',
          'action=clear - Clear all cache',
        ],
      });
    },
  },
  { requireAuth: true, requireRoles: ['admin'] }
);

// POST /api/v1/cache/test - Test cache functionality
export const POST = withApiMiddleware(
  {
    POST: async (request: NextRequest) => {
      const body = await request.json();
      const { operation, key, data, config } = body;

      switch (operation) {
        case 'set': {
          if (!key || !data || !config) {
            return createSuccessResponse({
              error: 'Missing required fields: key, data, config',
            });
          }

          await cacheManager.set(key, data, config);

          return createSuccessResponse({
            message: 'Cache entry set successfully',
            key,
            operation: 'set',
          });
        }

        case 'get': {
          if (!key) {
            return createSuccessResponse({
              error: 'Missing required field: key',
            });
          }

          const entry = await cacheManager.get(key);

          return createSuccessResponse({
            message: entry ? 'Cache entry found' : 'Cache entry not found',
            key,
            operation: 'get',
            found: !!entry,
            entry: entry
              ? {
                  data: entry.data,
                  timestamp: new Date(entry.timestamp).toISOString(),
                  ttl: entry.ttl,
                  tags: entry.tags,
                  etag: entry.etag,
                }
              : null,
          });
        }

        default:
          return createSuccessResponse({
            message: 'Cache test operations',
            availableOperations: {
              set: {
                description: 'Set cache entry',
                payload: {
                  operation: 'set',
                  key: 'test-key',
                  data: { message: 'test data' },
                  config: { ttl: 300, tags: ['test'] },
                },
              },
              get: {
                description: 'Get cache entry',
                payload: {
                  operation: 'get',
                  key: 'test-key',
                },
              },
            },
          });
      }
    },
  },
  { requireAuth: true, requireRoles: ['admin'] }
);
