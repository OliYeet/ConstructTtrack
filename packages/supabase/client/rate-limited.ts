import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js';
import { type RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './core';

// Rate limiting configuration
interface RateLimitConfig {
  enabled: boolean;
  onRateLimitExceeded?: (details: RateLimitDetails) => void;
}

interface RateLimitDetails {
  type: 'connection' | 'subscription' | 'message';
  channel?: string;
  timestamp: number;
}

// Global rate limit configuration
let rateLimitConfig: RateLimitConfig = {
  enabled: process.env.NODE_ENV === 'production',
};

/**
 * Configure rate limiting for Supabase realtime
 */
export function configureRealtimeRateLimit(
  config: Partial<RateLimitConfig>
): void {
  rateLimitConfig = { ...rateLimitConfig, ...config };
}

/**
 * Create a rate-limited channel that tracks usage
 */
export function createRateLimitedChannel(name: string): RealtimeChannel {
  const channel = supabase.channel(name);

  if (!rateLimitConfig.enabled) {
    return channel;
  }

  // Wrap the subscribe method to track rate limits
  const originalSubscribe = channel.subscribe.bind(channel);
  channel.subscribe = (
    callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void,
    timeout?: number
  ) => {
    // In a real implementation, this would check with the rate limiter
    // For now, we'll just track the subscription attempt
    if (typeof window !== 'undefined' && rateLimitConfig.onRateLimitExceeded) {
      // Client-side rate limit tracking would go here
      // This is a placeholder for the actual implementation
    }

    return originalSubscribe(callback, timeout);
  };

  return channel;
}

/**
 * Export a rate-limit aware version of the supabase client
 */
export const rateLimitedSupabase = new Proxy(supabase, {
  get(target, prop) {
    if (prop === 'channel') {
      return (name: string) => createRateLimitedChannel(name);
    }

    const value = (target as any)[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Hook for React components to get rate limit status
 */
export function useRealtimeRateLimit() {
  // This would be implemented as a React hook in the web app
  // For now, it's a placeholder
  return {
    isRateLimited: false,
    remainingConnections: 10,
    remainingSubscriptions: 20,
  };
}
