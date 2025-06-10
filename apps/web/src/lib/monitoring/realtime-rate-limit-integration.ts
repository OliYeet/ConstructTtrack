/**
 * Realtime Rate Limit Integration
 *
 * Integrates WebSocket rate limiting with Supabase Realtime monitoring.
 * Tracks and enforces rate limits for realtime connections.
 */

import {
  RealtimeChannel,
  RealtimeClient,
  REALTIME_SUBSCRIBE_STATES,
} from '@supabase/supabase-js';

import { getLogger } from '../logging';
import {
  getWebSocketRateLimiter,
  type ConnectionInfo,
} from '../security/websocket-rate-limiting';

import { realtimePerformanceMonitor } from './realtime-performance-monitor';

export interface RateLimitedRealtimeOptions {
  enableRateLimiting?: boolean;
  logViolations?: boolean;
  blockOnViolation?: boolean;
}

export class RealtimeRateLimitIntegration {
  private rateLimiter = getWebSocketRateLimiter();
  private logger = getLogger();
  private connectionMap = new Map<string, string>(); // realtimeId -> connectionId

  constructor(private options: RateLimitedRealtimeOptions = {}) {
    this.options = {
      enableRateLimiting: true,
      logViolations: true,
      blockOnViolation: true,
      ...options,
    };
  }

  /**
   * Wrap a Supabase Realtime client with rate limiting
   */
  wrapRealtimeClient(
    client: RealtimeClient,
    ipAddress: string,
    userId?: string
  ): RealtimeClient {
    if (!this.options.enableRateLimiting) {
      return client;
    }

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Override connect method
    const originalConnect = client.connect.bind(client);
    client.connect = async () => {
      // Check connection rate limit
      const canConnect = await this.rateLimiter.canConnect(ipAddress);
      if (!canConnect) {
        this.handleRateLimitViolation('connection', { ipAddress, userId });
        if (this.options.blockOnViolation) {
          throw new Error('Connection rate limit exceeded');
        }
      }

      // Register connection
      this.rateLimiter.registerConnection({
        connectionId,
        ipAddress,
        userId,
        establishedAt: Date.now(),
        subscriptions: new Set(),
      });

      // Track in performance monitor
      realtimePerformanceMonitor.recordConnectionMetric({
        connectionId,
        userId,
        timestamps: {
          connectionStart: Date.now(),
          lastActivity: Date.now(),
        },
        status: 'connecting',
      });

      try {
        const result = await originalConnect();

        // Update connection status
        realtimePerformanceMonitor.recordConnectionMetric({
          connectionId,
          timestamps: {
            connectionStart: Date.now(),
            connectionEstablished: Date.now(),
            lastActivity: Date.now(),
          },
          status: 'connected',
        });

        return result;
      } catch (error) {
        // Clean up on connection failure
        this.rateLimiter.unregisterConnection(connectionId);
        throw error;
      }
    };

    // Override disconnect method
    const originalDisconnect = client.disconnect.bind(client);
    client.disconnect = async () => {
      this.rateLimiter.unregisterConnection(connectionId);

      // Track disconnection
      realtimePerformanceMonitor.recordConnectionMetric({
        connectionId,
        timestamps: {
          connectionStart: Date.now(),
          lastActivity: Date.now(),
          disconnected: Date.now(),
        },
        status: 'disconnected',
      });

      return originalDisconnect();
    };

    // Track client for channel wrapping
    const token =
      typeof client.accessToken === 'function' ? '' : client.accessToken || '';
    this.connectionMap.set(token, connectionId);

    return client;
  }

  /**
   * Wrap a Supabase Realtime channel with rate limiting
   */
  wrapRealtimeChannel(
    channel: RealtimeChannel,
    connectionId: string
  ): RealtimeChannel {
    if (!this.options.enableRateLimiting) {
      return channel;
    }

    // Override subscribe method
    const originalSubscribe = channel.subscribe.bind(channel);
    channel.subscribe = (
      callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void,
      timeout?: number
    ) => {
      // Check subscription limit
      const canSubscribe = this.rateLimiter.canSubscribe(
        connectionId,
        channel.topic
      );
      if (!canSubscribe) {
        this.handleRateLimitViolation('subscription', {
          connectionId,
          channel: channel.topic,
        });
        if (this.options.blockOnViolation) {
          throw new Error('Subscription rate limit exceeded');
        }
      }

      // Register subscription
      this.rateLimiter.registerSubscription(connectionId, channel.topic);

      // Track subscription
      realtimePerformanceMonitor.recordSubscriptionMetric({
        subscriptionId: `${connectionId}_${channel.topic}`,
        channel: channel.topic,
        timestamps: { subscribed: Date.now() },
        status: 'active',
      });

      return originalSubscribe(callback, timeout);
    };

    // Override unsubscribe method
    const originalUnsubscribe = channel.unsubscribe.bind(channel);
    channel.unsubscribe = async () => {
      this.rateLimiter.unregisterSubscription(connectionId, channel.topic);

      // Track unsubscription
      realtimePerformanceMonitor.recordSubscriptionMetric({
        subscriptionId: `${connectionId}_${channel.topic}`,
        channel: channel.topic,
        timestamps: {
          subscribed: Date.now(),
          unsubscribed: Date.now(),
        },
        status: 'inactive',
      });

      return originalUnsubscribe();
    };

    // Override send method for message rate limiting
    const originalSend = channel.send.bind(channel);
    channel.send = async (payload: any) => {
      // Check message rate limit
      const canSend = await this.rateLimiter.canSendMessage(connectionId);
      if (!canSend) {
        this.handleRateLimitViolation('message', {
          connectionId,
          channel: channel.topic,
        });
        if (this.options.blockOnViolation) {
          throw new Error('Message rate limit exceeded');
        }
      }

      return originalSend(payload);
    };

    return channel;
  }

  /**
   * Get IP address from request headers
   */
  getIpFromHeaders(headers: Headers): string {
    // Check various headers for IP address
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    const cfConnectingIp = headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    return 'unknown';
  }

  /**
   * Handle rate limit violations
   */
  private handleRateLimitViolation(
    type: 'connection' | 'message' | 'subscription',
    details: Record<string, unknown>
  ): void {
    if (this.options.logViolations) {
      this.logger.warn('WebSocket rate limit violation', {
        metadata: {
          type,
          ...details,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Record in performance monitor
    realtimePerformanceMonitor.recordErrorMetric({
      type: type as 'connection' | 'message' | 'subscription',
      severity: 'warning',
      code: `RATE_LIMIT_${type.toUpperCase()}`,
      message: `Rate limit exceeded for ${type}`,
      context: {
        userId: details.userId as string | undefined,
        organizationId: details.organizationId as string | undefined,
        connectionId: details.connectionId as string | undefined,
        eventId: details.eventId as string | undefined,
        channel: details.channel as string | undefined,
      },
    });
  }

  /**
   * Get rate limit statistics
   */
  getStats(identifier: string): {
    connection?: ConnectionInfo;
    ip?: {
      connectionCount: number;
      totalSubscriptions: number;
      totalMessages: number;
    };
  } {
    const stats: {
      connection?: ConnectionInfo;
      ip?: {
        connectionCount: number;
        totalSubscriptions: number;
        totalMessages: number;
      };
    } = {};

    // Check if identifier is a connection ID
    const connectionStats = this.rateLimiter.getConnectionStats(identifier);
    if (connectionStats) {
      stats.connection = connectionStats;
    }

    // Check if identifier is an IP address
    const ipStats = this.rateLimiter.getIpStats(identifier);
    if (ipStats.connectionCount > 0) {
      stats.ip = ipStats;
    }

    return stats;
  }

  /**
   * Reset rate limits (for testing)
   */
  reset(): void {
    this.rateLimiter.reset();
    this.connectionMap.clear();
  }
}

// Singleton instance
let instance: RealtimeRateLimitIntegration | null = null;

/**
 * Get or create the realtime rate limit integration instance
 */
export function getRealtimeRateLimitIntegration(
  options?: RateLimitedRealtimeOptions
): RealtimeRateLimitIntegration {
  if (!instance) {
    instance = new RealtimeRateLimitIntegration(options);
  }
  return instance;
}

/**
 * Middleware for Next.js API routes to extract IP and apply rate limiting
 */
export function withRealtimeRateLimit(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async function wrappedHandler(req: Request) {
    const integration = getRealtimeRateLimitIntegration();
    const ipAddress = integration.getIpFromHeaders(req.headers);

    // Store IP in request context for later use
    (req as any).clientIp = ipAddress;

    return handler(req);
  };
}
