/**
 * Connection Lifecycle Collector
 * Tracks WebSocket connections, disconnections, and errors
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { realtimeConfig } from '../config/realtime-config';

import { BaseRealtimeCollector } from './base';

// Connection event types
export type ConnectionEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'auth_failed'
  | 'reconnect_attempt';

// Connection event data
export interface ConnectionEvent {
  type: ConnectionEventType;
  connectionId: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Connection statistics
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  totalDisconnections: number;
  totalErrors: number;
  authFailures: number;
  reconnectAttempts: number;
  averageConnectionDuration: number;
  peakConnections: number;
}

export class ConnectionCollector extends BaseRealtimeCollector {
  private connectionStats: ConnectionStats;
  private activeConnections = new Map<
    string,
    { startTime: Date; userId?: string }
  >();
  private config = realtimeConfig.collectors.connection;

  constructor() {
    super('connection-collector');
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      authFailures: 0,
      reconnectAttempts: 0,
      averageConnectionDuration: 0,
      peakConnections: 0,
    };
  }

  protected onStart(): void {
    // Initialize connection tracking
    this.resetStats();

    // Set up periodic stats emission
    this.startStatsEmission();
  }

  protected onStop(): void {
    // Clean up any intervals or listeners
    this.stopStatsEmission();
  }

  private statsInterval?: NodeJS.Timeout;

  private startStatsEmission(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Emit connection stats every 30 seconds
    this.statsInterval = setInterval(() => {
      this.emitConnectionStats();
    }, 30000);
  }

  private stopStatsEmission(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
  }

  private emitConnectionStats(): void {
    // Update active connections count
    this.connectionStats.activeConnections = this.activeConnections.size;

    // Emit individual metrics
    this.emitMetric(
      'connection_count_total',
      this.connectionStats.totalConnections,
      'count'
    );
    this.emitMetric(
      'connection_count_active',
      this.connectionStats.activeConnections,
      'count'
    );
    this.emitMetric(
      'connection_count_peak',
      this.connectionStats.peakConnections,
      'count'
    );
    this.emitMetric(
      'disconnection_count_total',
      this.connectionStats.totalDisconnections,
      'count'
    );
    this.emitMetric(
      'connection_error_count',
      this.connectionStats.totalErrors,
      'count'
    );
    this.emitMetric(
      'auth_failure_count',
      this.connectionStats.authFailures,
      'count'
    );
    this.emitMetric(
      'reconnect_attempt_count',
      this.connectionStats.reconnectAttempts,
      'count'
    );
    this.emitMetric(
      'connection_duration_avg',
      this.connectionStats.averageConnectionDuration,
      'ms'
    );
  }

  // Public methods for tracking connection events
  public trackConnection(event: ConnectionEvent): void {
    if (!this.isRunning() || !this.shouldSample()) {
      return;
    }

    try {
      this.processConnectionEvent(event);
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'trackConnection'
      );
    }
  }

  private processConnectionEvent(event: ConnectionEvent): void {
    const { type, connectionId, userId, userAgent, ipAddress, metadata } =
      event;

    switch (type) {
      case 'connected':
        this.handleConnectionEstablished(
          connectionId,
          userId,
          userAgent,
          ipAddress,
          metadata
        );
        break;
      case 'disconnected':
        this.handleConnectionClosed(connectionId, metadata);
        break;
      case 'error':
        this.handleConnectionError(connectionId, metadata);
        break;
      case 'auth_failed':
        this.handleAuthFailure(connectionId, metadata);
        break;
      case 'reconnect_attempt':
        this.handleReconnectAttempt(connectionId, metadata);
        break;
    }

    // Emit the raw connection event as a metric
    this.emitMetric(
      `connection_event_${type}`,
      1,
      'count',
      {
        connection_id: connectionId,
        user_id: userId || 'anonymous',
        user_agent: userAgent || 'unknown',
        ip_address: ipAddress || 'unknown',
      },
      metadata
    );
  }

  private handleConnectionEstablished(
    connectionId: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
    metadata?: Record<string, unknown>
  ): void {
    // Track the new connection
    this.activeConnections.set(connectionId, {
      startTime: new Date(),
      userId,
    });

    // Update statistics
    this.connectionStats.totalConnections++;
    this.connectionStats.activeConnections = this.activeConnections.size;

    if (
      this.connectionStats.activeConnections >
      this.connectionStats.peakConnections
    ) {
      this.connectionStats.peakConnections =
        this.connectionStats.activeConnections;
    }

    // Emit specific metrics
    this.emitMetric(
      'connection_established',
      1,
      'count',
      {
        connection_id: connectionId,
        user_id: userId || 'anonymous',
        user_agent: userAgent || 'unknown',
        ip_address: ipAddress || 'unknown',
      },
      metadata
    );
  }

  private handleConnectionClosed(
    connectionId: string,
    metadata?: Record<string, unknown>
  ): void {
    const connection = this.activeConnections.get(connectionId);

    if (connection) {
      // Calculate connection duration
      const duration = Date.now() - connection.startTime.getTime();

      // Update average duration
      this.updateAverageConnectionDuration(duration);

      // Remove from active connections
      this.activeConnections.delete(connectionId);

      // Update statistics
      this.connectionStats.totalDisconnections++;
      this.connectionStats.activeConnections = this.activeConnections.size;

      // Emit metrics
      this.emitMetric(
        'connection_closed',
        1,
        'count',
        {
          connection_id: connectionId,
          user_id: connection.userId || 'anonymous',
          duration: duration.toString(),
        },
        metadata
      );

      this.emitMetric('connection_duration', duration, 'ms', {
        connection_id: connectionId,
        user_id: connection.userId || 'anonymous',
      });
    }
  }

  private handleConnectionError(
    connectionId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.connectionStats.totalErrors++;

    this.emitMetric(
      'connection_error',
      1,
      'count',
      {
        connection_id: connectionId,
        error_type: (metadata?.errorType as string) || 'unknown',
      },
      metadata
    );
  }

  private handleAuthFailure(
    connectionId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.connectionStats.authFailures++;

    this.emitMetric(
      'auth_failure',
      1,
      'count',
      {
        connection_id: connectionId,
        reason: (metadata?.reason as string) || 'unknown',
      },
      metadata
    );
  }

  private handleReconnectAttempt(
    connectionId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.connectionStats.reconnectAttempts++;

    this.emitMetric(
      'reconnect_attempt',
      1,
      'count',
      {
        connection_id: connectionId,
        attempt_number: (metadata?.attemptNumber as string) || '1',
      },
      metadata
    );
  }

  private updateAverageConnectionDuration(newDuration: number): void {
    const totalConnections = this.connectionStats.totalDisconnections;
    const currentAverage = this.connectionStats.averageConnectionDuration;

    // Calculate running average
    this.connectionStats.averageConnectionDuration =
      (currentAverage * (totalConnections - 1) + newDuration) /
      totalConnections;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private resetStats(): void {
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      authFailures: 0,
      reconnectAttempts: 0,
      averageConnectionDuration: 0,
      peakConnections: 0,
    };
    this.activeConnections.clear();
  }

  // Public getters for statistics
  public getConnectionStats(): ConnectionStats {
    return { ...this.connectionStats };
  }

  public getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  public getActiveConnections(): Array<{
    connectionId: string;
    userId?: string;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeConnections.entries()).map(
      ([connectionId, connection]) => ({
        connectionId,
        userId: connection.userId,
        duration: now - connection.startTime.getTime(),
      })
    );
  }
}
