/**
 * Advanced Rate Limiting and Throttling System
 * Implements multiple rate limiting strategies for API protection
 */

import { NextRequest } from 'next/server';
import { getLogger } from '@/lib/logging';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableHeaders?: boolean;
  message?: string;
  statusCode?: number;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Rate limit store interface
export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// In-memory rate limit store
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void> {
    this.store.set(key, value);
    this.setExpiration(key, ttl);
  }

  async increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime <= now) {
      // Create new entry
      const resetTime = now + ttl;
      const value = { count: 1, resetTime };
      this.store.set(key, value);
      this.setExpiration(key, ttl);
      return value;
    } else {
      // Increment existing entry
      existing.count++;
      this.store.set(key, existing);
      return existing;
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  private setExpiration(key: string, ttl: number): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }
}

// Redis rate limit store (for production)
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any; // Redis client - using any for flexibility with different Redis clients

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis get error', error);
      return null;
    }
  }

  async set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, Math.ceil(ttl / 1000), JSON.stringify(value));
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis set error', error);
    }
  }

  async increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const resetTime = now + ttl;

    try {
      const script = `
        local current = redis.call('HINCRBY', KEYS[1], 'count', 1)
        redis.call('HSETNX', KEYS[1], 'resetTime', ARGV[1])
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return current
      `;
      const count: number = await this.redis.eval(script, 1, key, resetTime, ttl);
      return { count, resetTime };
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis increment error', error);
      // Fallback to basic increment
      return { count: 1, resetTime };
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis delete error', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      const logger = getLogger();
      logger.error('Redis clear error', error);
    }
  }
}

// Rate limiter class
export class RateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    this.config = config;
    this.store = store || new MemoryRateLimitStore();
  }

  async checkLimit(request: NextRequest): Promise<RateLimitResult> {
    const key = this.generateKey(request);
    const now = Date.now();

    try {
      const result = await this.store.increment(key, this.config.windowMs);
      
      const allowed = result.count <= this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - result.count);
      const retryAfter = allowed ? undefined : Math.ceil((result.resetTime - now) / 1000);

      return {
        allowed,
        limit: this.config.maxRequests,
        remaining,
        resetTime: result.resetTime,
        retryAfter,
      };
    } catch (error) {
      const logger = getLogger();
      logger.error('Rate limit check failed', error, {
        metadata: { key, config: this.config },
      });

      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }
  }

  private generateKey(request: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default key generation based on IP and endpoint
    const ip = this.getClientIP(request);
    const endpoint = new URL(request.url).pathname;
    return `rate_limit:${ip}:${endpoint}`;
  }

  private getClientIP(request: NextRequest): string {
    // Try various headers for client IP
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    return 'unknown';
  }
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    enableHeaders: true,
    message: 'Too many API requests, please try again later.',
    statusCode: 429,
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    enableHeaders: true,
    message: 'Too many authentication attempts, please try again later.',
    statusCode: 429,
    keyGenerator: (request: NextRequest) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
      return `auth_limit:${ip}`;
    },
  },

  // Password reset endpoints
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    enableHeaders: true,
    message: 'Too many password reset attempts, please try again later.',
    statusCode: 429,
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    enableHeaders: true,
    message: 'Too many upload requests, please try again later.',
    statusCode: 429,
  },

  // Search endpoints
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    enableHeaders: true,
    message: 'Too many search requests, please try again later.',
    statusCode: 429,
  },

  // Admin endpoints
  admin: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20,
    enableHeaders: true,
    message: 'Too many admin requests, please try again later.',
    statusCode: 429,
    keyGenerator: (request: NextRequest) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
      const userId = request.headers.get('x-user-id') || 'anonymous';
      return `admin_limit:${ip}:${userId}`;
    },
  },

  // Strict rate limiting for sensitive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    enableHeaders: true,
    message: 'Rate limit exceeded for sensitive operation.',
    statusCode: 429,
  },
};

// Rate limiting middleware
export function createRateLimitMiddleware(
  configName: keyof typeof rateLimitConfigs | RateLimitConfig,
  store?: RateLimitStore
) {
  const config =
    typeof configName === 'string'
      ? rateLimitConfigs[configName]
      : configName;

  if (!config) {
    throw new Error(
      `Rate limit config '${String(configName)}' not found – check your call site.`
    );
  }
  const rateLimiter = new RateLimiter(config, store);

  return async function rateLimitMiddleware(request: NextRequest): Promise<{
    allowed: boolean;
    response?: Response;
    headers?: Record<string, string>;
  }> {
    const result = await rateLimiter.checkLimit(request);

    // Prepare headers
    const headers: Record<string, string> = {};
    if (config.enableHeaders) {
      headers['X-RateLimit-Limit'] = result.limit.toString();
      headers['X-RateLimit-Remaining'] = result.remaining.toString();
      headers['X-RateLimit-Reset'] = Math.ceil(result.resetTime / 1000).toString();
      
      if (result.retryAfter) {
        headers['Retry-After'] = result.retryAfter.toString();
      }
    }

    if (!result.allowed) {
      // Log rate limit violation
      const logger = getLogger();
      logger.warn('Rate limit exceeded', {
        metadata: {
          ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
          endpoint: new URL(request.url).pathname,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
        },
      });

      // Create rate limit response
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: config.message || 'Too many requests',
          retryAfter: result.retryAfter,
        }),
        {
          status: config.statusCode || 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }
      );

      return { allowed: false, response, headers };
    }

    return { allowed: true, headers };
  };
}

// Global rate limiter instance
const globalStore = new MemoryRateLimitStore();

// Export rate limiters for different use cases
export const apiRateLimiter = new RateLimiter(rateLimitConfigs.api, globalStore);
export const authRateLimiter = new RateLimiter(rateLimitConfigs.auth, globalStore);
export const uploadRateLimiter = new RateLimiter(rateLimitConfigs.upload, globalStore);
export const searchRateLimiter = new RateLimiter(rateLimitConfigs.search, globalStore);
export const adminRateLimiter = new RateLimiter(rateLimitConfigs.admin, globalStore);

// Utility function to check if request should be rate limited
export function shouldRateLimit(request: NextRequest): boolean {
  // Skip rate limiting for certain conditions
  const userAgent = request.headers.get('user-agent') || '';
  
  // Skip for health checks
  if (userAgent.includes('health-check') || userAgent.includes('monitoring')) {
    return false;
  }

  // Skip for internal requests
  const origin = request.headers.get('origin');
  if (origin && origin.includes('localhost')) {
    return false;
  }

  return true;
}
