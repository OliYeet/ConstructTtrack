/**
 * WebSocket/Realtime Rate Limiting
 *
 * Provides rate limiting for Supabase realtime connections to prevent abuse.
 * Implements both connection-level and IP-based rate limiting.
 */

import { NextRequest } from 'next/server';

import { RateLimiter } from './rate-limiting';

export interface WebSocketRateLimiterOptions {
  // Connection limits
  maxConnectionsPerIp: number;
  connectionWindowMs: number;

  // Message limits
  maxMessagesPerConnection: number;
  messageWindowMs: number;

  // Subscription limits
  maxSubscriptionsPerConnection: number;
  maxChannelsPerIp: number;

  // Reconnection limits
  maxReconnectsPerIp: number;
  reconnectWindowMs: number;

  // Enable/disable specific limits
  enableConnectionLimit?: boolean;
  enableMessageLimit?: boolean;
  enableSubscriptionLimit?: boolean;
  enableReconnectLimit?: boolean;
}

export interface ConnectionInfo {
  connectionId: string;
  ipAddress: string;
  userId?: string;
  organizationId?: string;
  establishedAt: number;
  subscriptions: Set<string>;
  messageCount: number;
  lastActivity: number;
}

export class WebSocketRateLimiter {
  private connectionLimiter: RateLimiter;
  private messageLimiter: RateLimiter;
  private reconnectLimiter: RateLimiter;
  private activeConnections: Map<string, ConnectionInfo> = new Map();
  private ipConnectionCount: Map<string, Set<string>> = new Map();

  constructor(private options: WebSocketRateLimiterOptions) {
    // Initialize connection limiter
    this.connectionLimiter = new RateLimiter({
      windowMs: options.connectionWindowMs,
      maxRequests: options.maxConnectionsPerIp,
      keyGenerator: req => {
        const url = new URL(req.url);
        const ip = url.searchParams.get('ip') || 'unknown';
        return `ws_conn:${ip}`;
      },
    });

    // Initialize message limiter
    this.messageLimiter = new RateLimiter({
      windowMs: options.messageWindowMs,
      maxRequests: options.maxMessagesPerConnection,
      keyGenerator: req => {
        const url = new URL(req.url);
        const connectionId = url.searchParams.get('connectionId') || 'unknown';
        return `ws_msg:${connectionId}`;
      },
    });

    // Initialize reconnect limiter
    this.reconnectLimiter = new RateLimiter({
      windowMs: options.reconnectWindowMs,
      maxRequests: options.maxReconnectsPerIp,
      keyGenerator: req => {
        const url = new URL(req.url);
        const ip = url.searchParams.get('ip') || 'unknown';
        return `ws_reconnect:${ip}`;
      },
    });
  }

  /**
   * Check if a new connection is allowed
   */
  async canConnect(ipAddress: string): Promise<boolean> {
    if (!this.options.enableConnectionLimit) {
      return true;
    }

    // Check connection rate limit
    const mockReq = {
      headers: new Headers(),
      url: `ws://localhost?ip=${ipAddress}`,
    } as NextRequest;
    const result = await this.connectionLimiter.checkLimit(mockReq);
    const canProceed = result.allowed;

    if (!canProceed) {
      return false;
    }

    // Check total connections per IP
    const ipConnections = this.ipConnectionCount.get(ipAddress) || new Set();
    return ipConnections.size < this.options.maxConnectionsPerIp;
  }

  /**
   * Register a new connection
   */
  registerConnection(
    connectionInfo: Omit<ConnectionInfo, 'messageCount' | 'lastActivity'>
  ): void {
    const fullInfo: ConnectionInfo = {
      ...connectionInfo,
      messageCount: 0,
      lastActivity: Date.now(),
    };

    this.activeConnections.set(connectionInfo.connectionId, fullInfo);

    // Track IP connections
    const ipConnections =
      this.ipConnectionCount.get(connectionInfo.ipAddress) || new Set();
    ipConnections.add(connectionInfo.connectionId);
    this.ipConnectionCount.set(connectionInfo.ipAddress, ipConnections);
  }

  /**
   * Check if a message is allowed
   */
  async canSendMessage(connectionId: string): Promise<boolean> {
    if (!this.options.enableMessageLimit) {
      return true;
    }

    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    const mockReq = {
      headers: new Headers(),
      url: `ws://localhost?connectionId=${connectionId}`,
    } as NextRequest;
    const result = await this.messageLimiter.checkLimit(mockReq);
    const canProceed = result.allowed;

    if (canProceed) {
      connection.messageCount++;
      connection.lastActivity = Date.now();
    }

    return canProceed;
  }

  /**
   * Check if a subscription is allowed
   */
  canSubscribe(connectionId: string, channel: string): boolean {
    if (!this.options.enableSubscriptionLimit) {
      return true;
    }

    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Check subscription limit per connection
    if (
      connection.subscriptions.size >=
      this.options.maxSubscriptionsPerConnection
    ) {
      return false;
    }

    // Check total channels per IP
    const ipConnections =
      this.ipConnectionCount.get(connection.ipAddress) || new Set();
    let totalChannels = 0;

    for (const connId of ipConnections) {
      const conn = this.activeConnections.get(connId);
      if (conn) {
        totalChannels += conn.subscriptions.size;
      }
    }

    return totalChannels < this.options.maxChannelsPerIp;
  }

  /**
   * Register a subscription
   */
  registerSubscription(connectionId: string, channel: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.subscriptions.add(channel);
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Unregister a subscription
   */
  unregisterSubscription(connectionId: string, channel: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.subscriptions.delete(channel);
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Check if a reconnection is allowed
   */
  async canReconnect(ipAddress: string): Promise<boolean> {
    if (!this.options.enableReconnectLimit) {
      return true;
    }

    const mockReq = {
      headers: new Headers(),
      url: `ws://localhost?ip=${ipAddress}`,
    } as NextRequest;
    const result = await this.reconnectLimiter.checkLimit(mockReq);
    return result.allowed;
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from active connections
    this.activeConnections.delete(connectionId);

    // Remove from IP tracking
    const ipConnections = this.ipConnectionCount.get(connection.ipAddress);
    if (ipConnections) {
      ipConnections.delete(connectionId);
      if (ipConnections.size === 0) {
        this.ipConnectionCount.delete(connection.ipAddress);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(connectionId: string): ConnectionInfo | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Get IP statistics
   */
  getIpStats(ipAddress: string): {
    connectionCount: number;
    totalSubscriptions: number;
    totalMessages: number;
  } {
    const ipConnections = this.ipConnectionCount.get(ipAddress) || new Set();
    let totalSubscriptions = 0;
    let totalMessages = 0;

    for (const connId of ipConnections) {
      const conn = this.activeConnections.get(connId);
      if (conn) {
        totalSubscriptions += conn.subscriptions.size;
        totalMessages += conn.messageCount;
      }
    }

    return {
      connectionCount: ipConnections.size,
      totalSubscriptions,
      totalMessages,
    };
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(maxInactivityMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [connectionId, connection] of this.activeConnections) {
      if (now - connection.lastActivity > maxInactivityMs) {
        connectionsToRemove.push(connectionId);
      }
    }

    for (const connectionId of connectionsToRemove) {
      this.unregisterConnection(connectionId);
    }
  }

  /**
   * Reset all limits (for testing)
   */
  async reset(): Promise<void> {
    this.activeConnections.clear();
    this.ipConnectionCount.clear();
    // Clear the underlying stores of the rate limiters
    // Access the private store property through bracket notation to avoid TypeScript errors
    await (
      this.connectionLimiter as { store: { clear(): Promise<void> } }
    ).store.clear();
    await (
      this.messageLimiter as { store: { clear(): Promise<void> } }
    ).store.clear();
    await (
      this.reconnectLimiter as { store: { clear(): Promise<void> } }
    ).store.clear();
  }
}

// Default configuration for production use
export const defaultWebSocketRateLimiterOptions: WebSocketRateLimiterOptions = {
  // Allow 10 connections per IP per 5 minutes
  maxConnectionsPerIp: 10,
  connectionWindowMs: 5 * 60 * 1000,

  // Allow 100 messages per connection per minute
  maxMessagesPerConnection: 100,
  messageWindowMs: 60 * 1000,

  // Allow 20 subscriptions per connection, 50 total per IP
  maxSubscriptionsPerConnection: 20,
  maxChannelsPerIp: 50,

  // Allow 5 reconnections per IP per minute (for unstable connections)
  maxReconnectsPerIp: 5,
  reconnectWindowMs: 60 * 1000,

  // Enable all limits by default
  enableConnectionLimit: true,
  enableMessageLimit: true,
  enableSubscriptionLimit: true,
  enableReconnectLimit: true,
};

// Singleton instance
let wsRateLimiter: WebSocketRateLimiter | null = null;

/**
 * Get or create the WebSocket rate limiter instance
 */
export function getWebSocketRateLimiter(
  options?: Partial<WebSocketRateLimiterOptions>
): WebSocketRateLimiter {
  if (!wsRateLimiter) {
    wsRateLimiter = new WebSocketRateLimiter({
      ...defaultWebSocketRateLimiterOptions,
      ...options,
    });

    // Set up periodic cleanup
    setInterval(
      () => {
        wsRateLimiter?.cleanupInactiveConnections();
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  return wsRateLimiter;
}
