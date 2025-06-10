/**
 * Real-time Monitoring Integration
 * Single facade for managing real-time metric collectors
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { EventEmitter } from 'events';

import {
  RealtimeMetricCollector,
  RealtimeMetricEvent,
  CollectorRegistry,
  defaultCollectors,
  startAllCollectors,
  stopAllCollectors,
  getAllCollectorStats,
  checkAllCollectorsHealth,
} from './collectors';
import {
  realtimeConfig,
  isRealtimeMonitoringEnabled,
} from './config/realtime-config';
import { performanceMonitor } from './performance-monitor';

// Integration status
export type IntegrationStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

// Integration statistics
export interface IntegrationStats {
  status: IntegrationStatus;
  startTime?: string;
  collectorsRegistered: number;
  collectorsRunning: number;
  totalMetricsCollected: number;
  totalErrors: number;
  lastError?: string;
  lastErrorTime?: string;
}

// Integration events
export interface IntegrationEvents {
  started: () => void;
  stopped: () => void;
  error: (error: Error) => void;
  metric: (metric: RealtimeMetricEvent) => void;
  collectorRegistered: (collectorId: string) => void;
  collectorUnregistered: (collectorId: string) => void;
}

export class RealtimeMonitoringIntegration extends EventEmitter {
  private _status: IntegrationStatus = 'stopped';
  private _stats: IntegrationStats;
  private _startTime?: Date;
  private collectorRegistry: CollectorRegistry;
  private metricsBuffer: RealtimeMetricEvent[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.collectorRegistry = new CollectorRegistry();
    this._stats = {
      status: 'stopped',
      collectorsRegistered: 0,
      collectorsRunning: 0,
      totalMetricsCollected: 0,
      totalErrors: 0,
    };

    // Register default collectors if monitoring is enabled
    if (isRealtimeMonitoringEnabled()) {
      this.registerDefaultCollectors();
    }
  }

  get status(): IntegrationStatus {
    return this._status;
  }

  get stats(): IntegrationStats {
    return { ...this._stats };
  }

  // Initialize the monitoring integration
  public async initialize(): Promise<void> {
    if (this._status === 'running' || this._status === 'starting') {
      return;
    }

    if (!isRealtimeMonitoringEnabled()) {
      throw new Error('Real-time monitoring is disabled');
    }

    this._status = 'starting';
    this._startTime = new Date();
    this._stats.startTime = this._startTime.toISOString();

    try {
      // Start all registered collectors
      startAllCollectors(this.collectorRegistry);

      // Start metrics buffering and flushing
      this.startMetricsProcessing();

      // Update status
      this._status = 'running';
      this._stats.status = 'running';
      this._stats.collectorsRunning = this.getRunningCollectorCount();

      this.emit('started');
    } catch (error) {
      this._status = 'error';
      this._stats.status = 'error';
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Shutdown the monitoring integration
  public async shutdown(): Promise<void> {
    if (this._status === 'stopped' || this._status === 'stopping') {
      return;
    }

    this._status = 'stopping';

    try {
      // Stop metrics processing
      this.stopMetricsProcessing();

      // Stop all collectors
      stopAllCollectors(this.collectorRegistry);

      // Flush remaining metrics
      await this.flushMetrics();

      // Update status
      this._status = 'stopped';
      this._stats.status = 'stopped';
      this._stats.collectorsRunning = 0;

      this.emit('stopped');
    } catch (error) {
      this._status = 'error';
      this._stats.status = 'error';
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Register a collector (Charlie's specified method)
  public registerCollector(collector: RealtimeMetricCollector): void {
    try {
      // Set up metric callback to route to performance monitor
      collector.onMetric = (metric: RealtimeMetricEvent) => {
        this.handleMetric(metric);
      };

      this.collectorRegistry.register(collector);
      this._stats.collectorsRegistered = this.collectorRegistry.getAll().length;

      this.emit('collectorRegistered', collector.id);
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Unregister a collector
  public unregisterCollector(collectorId: string): boolean {
    try {
      const success = this.collectorRegistry.unregister(collectorId);
      if (success) {
        this._stats.collectorsRegistered =
          this.collectorRegistry.getAll().length;
        this._stats.collectorsRunning = this.getRunningCollectorCount();
        this.emit('collectorUnregistered', collectorId);
      }
      return success;
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  // Get a specific collector
  public getCollector(
    collectorId: string
  ): RealtimeMetricCollector | undefined {
    return this.collectorRegistry.get(collectorId);
  }

  // Get all collectors
  public getAllCollectors(): RealtimeMetricCollector[] {
    return this.collectorRegistry.getAll();
  }

  // Get collector statistics
  public getCollectorStats(): Record<string, unknown> {
    return getAllCollectorStats(this.collectorRegistry);
  }

  // Health check
  public getHealthStatus(): {
    healthy: boolean;
    status: IntegrationStatus;
    collectors: Array<{ id: string; healthy: boolean; status?: string }>;
  } {
    const collectorHealth = checkAllCollectorsHealth(this.collectorRegistry);
    const healthy =
      this._status === 'running' && collectorHealth.every(c => c.healthy);

    return {
      healthy,
      status: this._status,
      collectors: collectorHealth,
    };
  }

  // Register default collectors
  private registerDefaultCollectors(): void {
    const config = realtimeConfig.collectors;

    // Register collectors based on configuration
    if (config.connection.enabled) {
      this.registerCollector(defaultCollectors.connection);
    }

    if (config.throughput.enabled) {
      this.registerCollector(defaultCollectors.throughput);
    }

    if (config.resource.enabled) {
      this.registerCollector(defaultCollectors.resource);
    }

    if (config.queueDepth.enabled) {
      this.registerCollector(defaultCollectors['queue-depth']);
    }
  }

  // Handle incoming metrics
  private handleMetric(metric: RealtimeMetricEvent): void {
    try {
      // Add to buffer
      this.metricsBuffer.push(metric);
      this._stats.totalMetricsCollected++;

      // Route to existing performance monitor
      performanceMonitor.recordMetric(
        metric.name,
        metric.value,
        metric.unit,
        metric.tags as Record<string, string>,
        metric.metadata
      );

      // Emit metric event
      this.emit('metric', metric);

      // Check if buffer needs flushing
      if (this.metricsBuffer.length >= realtimeConfig.metrics.bufferSize) {
        this.flushMetrics();
      }
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Start metrics processing
  private startMetricsProcessing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, realtimeConfig.metrics.flushInterval);
  }

  // Stop metrics processing
  private stopMetricsProcessing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
  }

  // Flush metrics buffer
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      // For now, metrics are already routed to performance monitor
      // In the future, this could also persist to TimescaleDB

      // Clear the buffer
      this.metricsBuffer = [];
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Get running collector count
  private getRunningCollectorCount(): number {
    return this.collectorRegistry.getAll().filter(collector => {
      return 'isRunning' in collector &&
        typeof collector.isRunning === 'function'
        ? collector.isRunning()
        : false;
    }).length;
  }

  // Handle errors
  private handleError(error: Error): void {
    this._stats.totalErrors++;
    this._stats.lastError = error.message;
    this._stats.lastErrorTime = new Date().toISOString();
    this.emit('error', error);
  }

  // Public convenience methods for accessing default collectors
  public get connectionCollector() {
    return this.getCollector('connection-collector');
  }

  public get throughputCollector() {
    return this.getCollector('throughput-collector');
  }

  public get resourceCollector() {
    return this.getCollector('resource-collector');
  }

  public get queueDepthCollector() {
    return this.getCollector('queue-depth-collector');
  }
}

// Global instance
export const realtimeMonitoringIntegration =
  new RealtimeMonitoringIntegration();

// Auto-initialize if enabled
if (isRealtimeMonitoringEnabled()) {
  realtimeMonitoringIntegration.initialize().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize real-time monitoring:', error);
  });
}
