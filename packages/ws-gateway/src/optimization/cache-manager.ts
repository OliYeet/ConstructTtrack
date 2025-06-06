/**
 * Cache Manager
 *
 * Implements intelligent caching strategies for frequently accessed data
 * Supports in-memory caching with future Redis support
 *
 * Part of LUM-584 Performance Optimization Phase 1
 */

import { logger } from '../utils/logger';

import { performanceProfiler } from './performance-profiler';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    private readonly cacheConfig = {
      enabled: true,
      defaultTtl: 300000, // 5 minutes
      maxMemoryEntries: 1000,
      memoryCleanupInterval: 60000, // 1 minute
    }
  ) {
    // Start memory cleanup
    globalThis.setInterval(() => {
      this.cleanupMemoryCache();
    }, this.cacheConfig.memoryCleanupInterval);
  }

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.cacheConfig.enabled) {
      return null;
    }

    return performanceProfiler.timeAsyncOperation(
      'cache_get',
      async () => {
        // Try memory cache
        const memoryResult = this.getFromMemory<T>(key);
        if (memoryResult !== null) {
          this.stats.hits++;
          return memoryResult;
        }

        this.stats.misses++;
        return null;
      },
      { cacheKey: key }
    );
  }

  /**
   * Set value in cache
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.cacheConfig.enabled) {
      return;
    }

    return performanceProfiler.timeAsyncOperation(
      'cache_set',
      async () => {
        const cacheTtl = ttl || this.cacheConfig.defaultTtl;
        this.setInMemory(key, value, cacheTtl);
      },
      { cacheKey: key, ttl: ttl || this.cacheConfig.defaultTtl }
    );
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.cacheConfig.enabled) {
      return;
    }

    this.memoryCache.delete(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Calculate memory usage
    let memoryUsage = 0;
    for (const entry of this.memoryCache.values()) {
      memoryUsage += JSON.stringify(entry).length * 2; // Rough estimate
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalEntries: this.memoryCache.size,
      memoryUsage,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    // For now, just clear the cache
    await this.clear();
  }

  /**
   * Get value from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccessed = Date.now();

    return entry.data as T;
  }

  /**
   * Set value in memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): void {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.cacheConfig.maxMemoryEntries) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl,
      hitCount: 0,
      lastAccessed: Date.now(),
    };

    this.memoryCache.set(key, entry);
  }

  /**
   * Cleanup expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.memoryCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug('Cleaned up expired cache entries', {
        count: expiredKeys.length,
      });
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      logger.debug('Evicted LRU cache entry', { key: oldestKey });
    }
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();
