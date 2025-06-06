/**
 * Connection Optimizer
 *
 * Optimizes WebSocket connection management, heartbeat intervals,
 * and connection pooling for better performance
 *
 * Part of LUM-584 Performance Optimization Phase 2
 */

import { logger } from '../utils/logger';

import { performanceProfiler } from './performance-profiler';

export interface ConnectionMetrics {
  connectionId: string;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  bytesTransferred: number;
  latency: number;
  isHealthy: boolean;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  averageLatency: number;
  throughput: number;
  errorRate: number;
}

export class ConnectionOptimizer {
  private connectionMetrics = new Map<string, ConnectionMetrics>();
  private heartbeatInterval: ReturnType<typeof globalThis.setInterval> | null =
    null;
  private optimizationInterval: ReturnType<
    typeof globalThis.setInterval
  > | null = null;

  constructor(
    private readonly config = {
      enabled: true,
      heartbeatInterval: 25000, // 25 seconds (optimized from 30s)
      connectionTimeout: 60000, // 60 seconds
      maxIdleTime: 300000, // 5 minutes
      latencyThreshold: 1000, // 1 second
      optimizationInterval: 30000, // 30 seconds
      adaptiveHeartbeat: true,
    }
  ) {}

  /**
   * Start connection optimization
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    // Start adaptive heartbeat optimization
    if (this.config.adaptiveHeartbeat) {
      this.optimizationInterval = globalThis.setInterval(() => {
        this.optimizeHeartbeatIntervals();
      }, this.config.optimizationInterval);
    }

    logger.info('Connection optimizer started', {
      heartbeatInterval: this.config.heartbeatInterval,
      adaptiveHeartbeat: this.config.adaptiveHeartbeat,
    });
  }

  /**
   * Stop connection optimization
   */
  stop(): void {
    if (this.heartbeatInterval) {
      globalThis.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.optimizationInterval) {
      globalThis.clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    logger.info('Connection optimizer stopped');
  }

  /**
   * Track connection metrics
   */
  trackConnection(connectionId: string): void {
    const metrics: ConnectionMetrics = {
      connectionId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      bytesTransferred: 0,
      latency: 0,
      isHealthy: true,
    };

    this.connectionMetrics.set(connectionId, metrics);
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string, messageSize: number = 0): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.lastActivity = Date.now();
      metrics.messageCount++;
      metrics.bytesTransferred += messageSize;
    }
  }

  /**
   * Update connection latency
   */
  updateLatency(connectionId: string, latency: number): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.latency = latency;
      metrics.isHealthy = latency < this.config.latencyThreshold;
    }
  }

  /**
   * Remove connection tracking
   */
  removeConnection(connectionId: string): void {
    this.connectionMetrics.delete(connectionId);
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): ConnectionPoolStats {
    const now = Date.now();
    const connections = Array.from(this.connectionMetrics.values());

    const activeConnections = connections.filter(
      conn => now - conn.lastActivity < this.config.connectionTimeout
    );

    const idleConnections = connections.filter(
      conn =>
        now - conn.lastActivity >= this.config.connectionTimeout &&
        now - conn.lastActivity < this.config.maxIdleTime
    );

    const totalLatency = connections.reduce(
      (sum, conn) => sum + conn.latency,
      0
    );
    const averageLatency =
      connections.length > 0 ? totalLatency / connections.length : 0;

    const totalBytes = connections.reduce(
      (sum, conn) => sum + conn.bytesTransferred,
      0
    );
    const totalTime = connections.reduce(
      (sum, conn) => sum + (now - conn.connectedAt),
      0
    );
    const throughput = totalTime > 0 ? (totalBytes / totalTime) * 1000 : 0; // bytes per second

    const unhealthyConnections = connections.filter(conn => !conn.isHealthy);
    const errorRate =
      connections.length > 0
        ? unhealthyConnections.length / connections.length
        : 0;

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      idleConnections: idleConnections.length,
      averageLatency,
      throughput,
      errorRate,
    };
  }

  /**
   * Get stale connections that should be cleaned up
   */
  getStaleConnections(): string[] {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, metrics] of this.connectionMetrics.entries()) {
      if (now - metrics.lastActivity > this.config.maxIdleTime) {
        staleConnections.push(connectionId);
      }
    }

    return staleConnections;
  }

  /**
   * Get optimal heartbeat interval based on connection health
   */
  getOptimalHeartbeatInterval(): number {
    if (!this.config.adaptiveHeartbeat) {
      return this.config.heartbeatInterval;
    }

    const stats = this.getPoolStats();

    // Increase heartbeat frequency for unhealthy connections
    if (stats.errorRate > 0.1) {
      // More than 10% error rate
      return Math.max(this.config.heartbeatInterval * 0.5, 10000); // Min 10 seconds
    }

    // Decrease heartbeat frequency for very healthy connections
    if (stats.errorRate < 0.01 && stats.averageLatency < 100) {
      // Less than 1% error, low latency
      return Math.min(this.config.heartbeatInterval * 1.5, 60000); // Max 60 seconds
    }

    return this.config.heartbeatInterval;
  }

  /**
   * Optimize heartbeat intervals based on connection health
   */
  private optimizeHeartbeatIntervals(): void {
    performanceProfiler.timeOperation('connection_optimization', () => {
      const optimalInterval = this.getOptimalHeartbeatInterval();
      const stats = this.getPoolStats();

      logger.debug('Connection optimization analysis', {
        currentInterval: this.config.heartbeatInterval,
        optimalInterval,
        stats,
      });

      // Update heartbeat interval if significantly different
      if (Math.abs(optimalInterval - this.config.heartbeatInterval) > 5000) {
        logger.info('Adjusting heartbeat interval', {
          from: this.config.heartbeatInterval,
          to: optimalInterval,
          reason: stats.errorRate > 0.1 ? 'high_error_rate' : 'optimization',
        });

        // Note: In a real implementation, this would update the actual heartbeat timer
        // For now, we just log the recommendation
      }
    });
  }

  /**
   * Get connection health recommendations
   */
  getHealthRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getPoolStats();

    if (stats.errorRate > 0.05) {
      recommendations.push(
        'High error rate detected - consider reducing heartbeat interval'
      );
    }

    if (stats.averageLatency > 500) {
      recommendations.push('High average latency - check network conditions');
    }

    if (stats.idleConnections > stats.activeConnections * 0.5) {
      recommendations.push(
        'Many idle connections - consider implementing connection cleanup'
      );
    }

    if (stats.totalConnections > 1000) {
      recommendations.push(
        'High connection count - consider implementing connection pooling'
      );
    }

    return recommendations;
  }
}

// Global connection optimizer instance
export const connectionOptimizer = new ConnectionOptimizer();
