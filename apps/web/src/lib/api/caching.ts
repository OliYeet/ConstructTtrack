/**
 * API Caching Strategies
 * Comprehensive caching system for the ConstructTrack API
 */

import { NextRequest, NextResponse } from 'next/server';

import { createSuccessResponse } from './response';

import { getLogger } from '@/lib/logging';

// Cache configuration
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // Stale-while-revalidate time in seconds
  tags?: readonly string[]; // Cache tags for invalidation
  vary?: readonly string[]; // Headers to vary cache by
  private?: boolean; // Whether cache is private (user-specific)
  revalidateOnStale?: boolean; // Whether to revalidate when stale
}

// Cache strategies
export enum CacheStrategy {
  NO_CACHE = 'no-cache',
  CACHE_FIRST = 'cache-first',
  NETWORK_FIRST = 'network-first',
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate',
  CACHE_ONLY = 'cache-only',
  NETWORK_ONLY = 'network-only',
}

// Cache entry
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
  etag: string;
  headers: Record<string, string>;
}

// Cache store interface
export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  invalidateByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
}

// Memory cache store (for development)
export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.store.delete(key);
      this.removeFromTagIndex(key, entry.tags);
      return null;
    }

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.store.set(key, entry);
    this.addToTagIndex(key, entry.tags);
  }

  async delete(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      this.removeFromTagIndex(key, entry.tags);
    }
    this.store.delete(key);
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of keys) {
        await this.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.tagIndex.clear();
  }

  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}

// Redis cache store (for production)
export class RedisCacheStore implements CacheStore {
  private redis: any; // Redis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis cache get error', error);
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const ttl = Math.ceil(entry.ttl);
      await this.redis.setex(key, ttl, JSON.stringify(entry));

      // Add to tag index
      for (const tag of entry.tags) {
        await this.redis.sadd(`tag:${tag}`, key);
        await this.redis.expire(`tag:${tag}`, ttl);
      }
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis cache set error', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Get entry to remove from tag index
      const entry = await this.get(key);
      if (entry) {
        for (const tag of entry.tags) {
          await this.redis.srem(`tag:${tag}`, key);
        }
      }
      await this.redis.del(key);
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis cache delete error', error);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
      }
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis cache invalidate by tag error', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis cache clear error', error);
    }
  }
}

// Cache manager
export class CacheManager {
  private store: CacheStore;

  constructor(store?: CacheStore) {
    this.store = store || new MemoryCacheStore();
  }

  // Generate cache key
  generateKey(request: NextRequest, additionalKeys: string[] = []): string {
    const url = new URL(request.url);
    const baseKey = `${request.method}:${url.pathname}`;

    // Add query parameters (sorted for consistency)
    const params = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const keyParts = [baseKey];
    if (params) keyParts.push(params);
    keyParts.push(...additionalKeys);

    return keyParts.join('|');
  }

  // Get cached response
  async get(key: string): Promise<CacheEntry | null> {
    return this.store.get(key);
  }

  // Set cached response
  async set(
    key: string,
    data: any,
    config: CacheConfig,
    headers: Record<string, string> = {}
  ): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl,
      tags: config.tags ? [...config.tags] : [],
      etag: await this.generateETag(data),
      headers,
    };

    await this.store.set(key, entry);
  }

  // Delete cached response
  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  // Invalidate by tag
  async invalidateByTag(tag: string): Promise<void> {
    await this.store.invalidateByTag(tag);
  }

  // Clear all cache entries
  async clear(): Promise<void> {
    await this.store.clear();
  }

  private async generateETag(data: unknown): Promise<string> {
    // Use dynamic import for crypto in browser-compatible way
    try {
      // Use dynamic import for security instead of require
      const crypto = await import('crypto');
      const hash = crypto
        .createHash('sha1')
        .update(JSON.stringify(data))
        .digest('hex');
      return `"${hash}"`; // Ensure consistent quoted format
    } catch {
      // Fallback for environments without crypto - plain string without extra quotes
      return `etag-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    }
  }

  // Check if entry is stale
  isStale(entry: CacheEntry, staleTime?: number): boolean {
    if (!staleTime) return false;
    const age = (Date.now() - entry.timestamp) / 1000;
    return age > staleTime;
  }

  // Create cached response
  createCachedResponse(
    entry: CacheEntry,
    isStale: boolean = false
  ): NextResponse {
    const response = createSuccessResponse(entry.data);

    // Add cache headers
    response.headers.set('ETag', entry.etag);
    response.headers.set(
      'Cache-Control',
      this.getCacheControlHeader(entry, isStale)
    );
    response.headers.set('X-Cache', isStale ? 'STALE' : 'HIT');
    response.headers.set(
      'X-Cache-Timestamp',
      new Date(entry.timestamp).toISOString()
    );

    // Add custom headers
    Object.entries(entry.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // Get cache control header
  getCacheControlHeader(entry: CacheEntry, isStale: boolean): string {
    const age = Math.floor((Date.now() - entry.timestamp) / 1000);
    const maxAge = entry.ttl - age;

    if (isStale) {
      return 'public, max-age=0, must-revalidate';
    }

    return `public, max-age=${Math.max(0, maxAge)}`;
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

// Predefined cache configurations
export const cacheConfigs = {
  // Short-term cache for frequently changing data
  short: {
    ttl: 60, // 1 minute
    staleWhileRevalidate: 30,
    revalidateOnStale: true,
  },

  // Medium-term cache for moderately stable data
  medium: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60,
    revalidateOnStale: true,
  },

  // Long-term cache for stable data
  long: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 300,
    revalidateOnStale: true,
  },

  // Static cache for rarely changing data
  static: {
    ttl: 86400, // 24 hours
    staleWhileRevalidate: 3600,
    revalidateOnStale: false,
  },

  // User-specific cache
  user: {
    ttl: 300, // 5 minutes
    private: true,
    tags: ['user'],
  },

  // Organization-specific cache
  organization: {
    ttl: 600, // 10 minutes
    tags: ['organization'],
  },
} as const;

// Caching middleware
export function withCaching(
  config: CacheConfig | keyof typeof cacheConfigs,
  strategy: CacheStrategy = CacheStrategy.CACHE_FIRST,
  customCacheManager?: CacheManager
) {
  return function cachingMiddleware(
    handler: (request: NextRequest) => Promise<NextResponse>
  ) {
    return async function cachedHandler(
      request: NextRequest
    ): Promise<NextResponse> {
      // Only cache GET requests
      if (request.method !== 'GET') {
        return handler(request);
      }

      const cacheConfig =
        typeof config === 'string' ? cacheConfigs[config] : config;
      const manager = customCacheManager || cacheManager;
      const logger = getLogger();

      try {
        // Generate cache key
        const additionalKeys: string[] = [];

        // Add user-specific key if private cache
        if ('private' in cacheConfig && cacheConfig.private) {
          const userId = (request as any).context?.user?.id;
          if (userId) additionalKeys.push(`user:${userId}`);
        }

        // Add organization key if organization cache
        if (
          'tags' in cacheConfig &&
          Array.isArray(cacheConfig.tags) &&
          cacheConfig.tags.includes('organization')
        ) {
          const orgId = (request as any).context?.organizationId;
          if (orgId) additionalKeys.push(`org:${orgId}`);
        }

        const cacheKey = manager.generateKey(request, additionalKeys);

        // Check for conditional requests (ETag)
        const ifNoneMatch = request.headers.get('if-none-match');

        // Try to get from cache
        const cachedEntry = await manager.get(cacheKey);

        if (cachedEntry) {
          // Check ETag for conditional requests
          if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
            return new NextResponse(null, { status: 304 });
          }

          const isStale = manager.isStale(
            cachedEntry,
            'staleWhileRevalidate' in cacheConfig
              ? cacheConfig.staleWhileRevalidate
              : undefined
          );

          // Handle different cache strategies
          switch (strategy) {
            case CacheStrategy.CACHE_FIRST:
              if (!isStale) {
                return manager.createCachedResponse(cachedEntry);
              }
              break;

            case CacheStrategy.STALE_WHILE_REVALIDATE:
              if (
                isStale &&
                'revalidateOnStale' in cacheConfig &&
                cacheConfig.revalidateOnStale
              ) {
                // Return stale data immediately, revalidate in background
                setImmediate(async () => {
                  try {
                    const freshResponse = await handler(request);
                    if (freshResponse.ok) {
                      const data = await freshResponse.json();
                      await manager.set(cacheKey, data, cacheConfig);
                    }
                  } catch (error) {
                    logger.error('Background revalidation failed', error);
                  }
                });
                return manager.createCachedResponse(cachedEntry, true);
              } else if (!isStale) {
                return manager.createCachedResponse(cachedEntry);
              }
              break;

            case CacheStrategy.CACHE_ONLY:
              return manager.createCachedResponse(cachedEntry, isStale);
          }
        }

        // Cache miss or stale - fetch fresh data
        if (strategy === CacheStrategy.CACHE_ONLY) {
          return new NextResponse(
            JSON.stringify({ error: 'Not found in cache' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const response = await handler(request);

        // Cache successful responses
        if (response.ok && response.status === 200) {
          try {
            // Clone response once for both caching and new response creation
            const responseClone = response.clone();
            const responseBody = await responseClone.text();

            // Parse data for caching
            let data;
            try {
              data = JSON.parse(responseBody);
            } catch {
              data = responseBody;
            }

            await manager.set(cacheKey, data, cacheConfig, {
              'Content-Type':
                response.headers.get('Content-Type') || 'application/json',
            });

            // Add cache headers to response by creating a new response
            const entry = await manager.get(cacheKey);
            if (entry) {
              const newHeaders = new Headers(response.headers);
              newHeaders.set('ETag', entry.etag);
              newHeaders.set('X-Cache', 'MISS');
              newHeaders.set(
                'Cache-Control',
                manager.getCacheControlHeader(entry, false)
              );

              // Create new response with cache headers
              return new NextResponse(responseBody, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
              });
            }
          } catch (error) {
            logger.error('Failed to cache response', error);
          }
        }

        return response;
      } catch (error) {
        logger.error('Caching middleware error', error);
        return handler(request);
      }
    };
  };
}
