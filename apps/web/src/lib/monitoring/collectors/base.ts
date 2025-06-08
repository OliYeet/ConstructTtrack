/**
 * Base Real-time Metric Collector Interface
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { EventEmitter } from 'events';

// Real-time metric event structure
export interface RealtimeMetricEvent {
  id: string;
  timestamp: string; // ISO 8601
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string | number>;
  metadata?: Record<string, unknown>;
}

// Collector status
export type CollectorStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

// Collector statistics
export interface CollectorStats {
  id: string;
  status: CollectorStatus;
  startTime?: string;
  metricsCollected: number;
  errorsCount: number;
  lastMetricTime?: string;
  lastErrorTime?: string;
  lastError?: string;
}

// Base collector interface as specified by Charlie
export interface RealtimeMetricCollector {
  readonly id: string;
  start(): void;
  stop(): void;
  onMetric?(metric: RealtimeMetricEvent): void;
}

// Extended collector interface with additional functionality
export interface ExtendedRealtimeMetricCollector
  extends RealtimeMetricCollector {
  readonly status: CollectorStatus;
  readonly stats: CollectorStats;
  isRunning(): boolean;
  getStats(): CollectorStats;
  reset(): void;
}

// Abstract base collector class
export abstract class BaseRealtimeCollector
  extends EventEmitter
  implements ExtendedRealtimeMetricCollector
{
  public readonly id: string;
  protected _status: CollectorStatus = 'stopped';
  protected _stats: CollectorStats;
  protected _startTime?: Date;

  constructor(id: string) {
    super();
    this.id = id;
    this._stats = {
      id,
      status: 'stopped',
      metricsCollected: 0,
      errorsCount: 0,
    };
  }

  get status(): CollectorStatus {
    return this._status;
  }

  get stats(): CollectorStats {
    return { ...this._stats };
  }

  public isRunning(): boolean {
    return this._status === 'running';
  }

  public getStats(): CollectorStats {
    return {
      ...this._stats,
      status: this._status,
    };
  }

  public start(): void {
    if (this._status === 'running' || this._status === 'starting') {
      return;
    }

    this._status = 'starting';
    this._startTime = new Date();
    this._stats.startTime = this._startTime.toISOString();

    try {
      this.onStart();
      this._status = 'running';
      this.emit('started', this.id);
    } catch (error) {
      this._status = 'error';
      this._stats.errorsCount++;
      this._stats.lastError =
        error instanceof Error ? error.message : String(error);
      this._stats.lastErrorTime = new Date().toISOString();
      this.emit('error', error);
      throw error;
    }
  }

  public stop(): void {
    if (this._status === 'stopped' || this._status === 'stopping') {
      return;
    }

    this._status = 'stopping';

    try {
      this.onStop();
      this._status = 'stopped';
      this.emit('stopped', this.id);
    } catch (error) {
      this._status = 'error';
      this._stats.errorsCount++;
      this._stats.lastError =
        error instanceof Error ? error.message : String(error);
      this._stats.lastErrorTime = new Date().toISOString();
      this.emit('error', error);
      throw error;
    }
  }

  public reset(): void {
    if (this.isRunning()) {
      throw new Error('Cannot reset collector while running');
    }

    this._stats = {
      id: this.id,
      status: 'stopped',
      metricsCollected: 0,
      errorsCount: 0,
    };
    this._startTime = undefined;
  }

  // Optional callback for metric events
  public onMetric?(metric: RealtimeMetricEvent): void;

  // Protected methods for subclasses to implement
  protected abstract onStart(): void;
  protected abstract onStop(): void;

  // Helper method to emit metrics
  protected emitMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string | number> = {},
    metadata?: Record<string, unknown>
  ): void {
    const metric: RealtimeMetricEvent = {
      id: `${this.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      name,
      value,
      unit,
      tags: {
        collector: this.id,
        ...tags,
      },
      metadata,
    };

    this._stats.metricsCollected++;
    this._stats.lastMetricTime = metric.timestamp;

    // Call optional callback
    if (this.onMetric) {
      try {
        this.onMetric(metric);
      } catch (error) {
        this._stats.errorsCount++;
        this._stats.lastError =
          error instanceof Error ? error.message : String(error);
        this._stats.lastErrorTime = new Date().toISOString();
        this.emit('error', error);
      }
    }

    // Emit metric event
    this.emit('metric', metric);
  }

  // Helper method to handle errors
  protected handleError(error: Error | string, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

    this._stats.errorsCount++;
    this._stats.lastError = fullMessage;
    this._stats.lastErrorTime = new Date().toISOString();

    this.emit('error', new Error(fullMessage));
  }
}

// Collector factory interface
export interface CollectorFactory {
  create(id: string, config: Record<string, unknown>): RealtimeMetricCollector;
}

// Collector registry for managing multiple collectors
export class CollectorRegistry {
  private collectors = new Map<string, RealtimeMetricCollector>();

  register(collector: RealtimeMetricCollector): void {
    if (this.collectors.has(collector.id)) {
      throw new Error(`Collector with id '${collector.id}' already registered`);
    }
    this.collectors.set(collector.id, collector);
  }

  unregister(id: string): boolean {
    const collector = this.collectors.get(id);
    if (collector) {
      if ('stop' in collector && typeof collector.stop === 'function') {
        collector.stop();
      }
      return this.collectors.delete(id);
    }
    return false;
  }

  get(id: string): RealtimeMetricCollector | undefined {
    return this.collectors.get(id);
  }

  getAll(): RealtimeMetricCollector[] {
    return Array.from(this.collectors.values());
  }

  startAll(): void {
    for (const collector of this.collectors.values()) {
      collector.start();
    }
  }

  stopAll(): void {
    for (const collector of this.collectors.values()) {
      collector.stop();
    }
  }

  clear(): void {
    this.stopAll();
    this.collectors.clear();
  }
}
