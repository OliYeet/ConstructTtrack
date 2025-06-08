/**
 * Queue Depth Collector
 * Tracks WebSocket gateway queue depth and backlog metrics
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { realtimeConfig } from '../config/realtime-config';

import { BaseRealtimeCollector } from './base';

// Queue metrics
export interface QueueMetrics {
  queueName: string;
  depth: number;
  maxDepth: number;
  processingRate: number; // items per second
  averageWaitTime: number; // milliseconds
  oldestItemAge: number; // milliseconds
  totalProcessed: number;
  totalDropped: number;
  timestamp: string;
}

// Queue statistics
export interface QueueStats {
  samples: number;
  averageDepth: number;
  peakDepth: number;
  averageProcessingRate: number;
  peakProcessingRate: number;
  averageWaitTime: number;
  maxWaitTime: number;
  totalItemsProcessed: number;
  totalItemsDropped: number;
  queueFullEvents: number;
  lastSampleTime: string;
}

// Queue item for tracking
interface QueueItem {
  id: string;
  enqueuedAt: number;
  size?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export class QueueDepthCollector extends BaseRealtimeCollector {
  private queueStats: QueueStats;
  private config = realtimeConfig.collectors.queueDepth;
  private samplingInterval?: NodeJS.Timeout;
  private queues = new Map<string, QueueItem[]>();
  private queueMetrics = new Map<string, QueueStats>();
  private processingHistory = new Map<string, number[]>(); // Track processing rates

  constructor() {
    super('queue-depth-collector');
    this.queueStats = {
      samples: 0,
      averageDepth: 0,
      peakDepth: 0,
      averageProcessingRate: 0,
      peakProcessingRate: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      totalItemsProcessed: 0,
      totalItemsDropped: 0,
      queueFullEvents: 0,
      lastSampleTime: new Date().toISOString(),
    };
  }

  protected onStart(): void {
    this.resetStats();
    this.startSampling();
  }

  protected onStop(): void {
    this.stopSampling();
  }

  private startSampling(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
    }

    // Sample queue depths periodically
    this.samplingInterval = setInterval(() => {
      this.sampleQueueDepths();
    }, this.config.sampleInterval);

    // Take immediate sample
    this.sampleQueueDepths();
  }

  private stopSampling(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = undefined;
    }
  }

  private sampleQueueDepths(): void {
    try {
      for (const [queueName, queue] of this.queues.entries()) {
        const metrics = this.calculateQueueMetrics(queueName, queue);
        this.processQueueMetrics(queueName, metrics);
        this.emitQueueMetrics(queueName, metrics);
      }

      this.queueStats.samples++;
      this.queueStats.lastSampleTime = new Date().toISOString();
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'sampleQueueDepths'
      );
    }
  }

  private calculateQueueMetrics(
    queueName: string,
    queue: QueueItem[]
  ): QueueMetrics {
    const now = Date.now();
    const depth = queue.length;

    // Calculate average wait time
    let totalWaitTime = 0;
    let oldestItemAge = 0;

    if (queue.length > 0) {
      for (const item of queue) {
        const waitTime = now - item.enqueuedAt;
        totalWaitTime += waitTime;
        oldestItemAge = Math.max(oldestItemAge, waitTime);
      }
    }

    const averageWaitTime = queue.length > 0 ? totalWaitTime / queue.length : 0;

    // Get processing rate from history
    const processingRate = this.getProcessingRate(queueName);

    // Get queue stats
    const stats =
      this.queueMetrics.get(queueName) || this.createEmptyQueueStats();

    return {
      queueName,
      depth,
      maxDepth: Math.max(stats.peakDepth, depth),
      processingRate,
      averageWaitTime,
      oldestItemAge,
      totalProcessed: stats.totalItemsProcessed,
      totalDropped: stats.totalItemsDropped,
      timestamp: new Date().toISOString(),
    };
  }

  private processQueueMetrics(queueName: string, metrics: QueueMetrics): void {
    let stats = this.queueMetrics.get(queueName);

    if (!stats) {
      stats = this.createEmptyQueueStats();
      this.queueMetrics.set(queueName, stats);
    }

    // Update statistics
    stats.samples++;

    // Update depth statistics
    if (metrics.depth > stats.peakDepth) {
      stats.peakDepth = metrics.depth;
    }

    stats.averageDepth =
      (stats.averageDepth * (stats.samples - 1) + metrics.depth) /
      stats.samples;

    // Update processing rate statistics
    if (metrics.processingRate > stats.peakProcessingRate) {
      stats.peakProcessingRate = metrics.processingRate;
    }

    stats.averageProcessingRate =
      (stats.averageProcessingRate * (stats.samples - 1) +
        metrics.processingRate) /
      stats.samples;

    // Update wait time statistics
    if (metrics.averageWaitTime > stats.maxWaitTime) {
      stats.maxWaitTime = metrics.averageWaitTime;
    }

    stats.averageWaitTime =
      (stats.averageWaitTime * (stats.samples - 1) + metrics.averageWaitTime) /
      stats.samples;

    stats.lastSampleTime = metrics.timestamp;

    // Update global stats
    this.updateGlobalStats(metrics);
  }

  private updateGlobalStats(metrics: QueueMetrics): void {
    // Update global peak depth
    if (metrics.depth > this.queueStats.peakDepth) {
      this.queueStats.peakDepth = metrics.depth;
    }

    // Update global averages (simplified - could be more sophisticated)
    const totalSamples = this.queueStats.samples + 1;
    this.queueStats.averageDepth =
      (this.queueStats.averageDepth * this.queueStats.samples + metrics.depth) /
      totalSamples;

    this.queueStats.averageProcessingRate =
      (this.queueStats.averageProcessingRate * this.queueStats.samples +
        metrics.processingRate) /
      totalSamples;

    this.queueStats.averageWaitTime =
      (this.queueStats.averageWaitTime * this.queueStats.samples +
        metrics.averageWaitTime) /
      totalSamples;
  }

  private emitQueueMetrics(queueName: string, metrics: QueueMetrics): void {
    const tags = { queue_name: queueName };

    // Emit queue-specific metrics
    this.emitMetric('queue_depth', metrics.depth, 'count', tags);
    this.emitMetric('queue_max_depth', metrics.maxDepth, 'count', tags);
    this.emitMetric(
      'queue_processing_rate',
      metrics.processingRate,
      'rate',
      tags
    );
    this.emitMetric(
      'queue_average_wait_time',
      metrics.averageWaitTime,
      'ms',
      tags
    );
    this.emitMetric('queue_oldest_item_age', metrics.oldestItemAge, 'ms', tags);
    this.emitMetric(
      'queue_total_processed',
      metrics.totalProcessed,
      'count',
      tags
    );
    this.emitMetric('queue_total_dropped', metrics.totalDropped, 'count', tags);

    // Emit global metrics
    this.emitMetric(
      'queue_depth_global_average',
      this.queueStats.averageDepth,
      'count'
    );
    this.emitMetric(
      'queue_depth_global_peak',
      this.queueStats.peakDepth,
      'count'
    );
    this.emitMetric(
      'queue_processing_rate_global_average',
      this.queueStats.averageProcessingRate,
      'rate'
    );
  }

  private getProcessingRate(queueName: string): number {
    const history = this.processingHistory.get(queueName) || [];
    if (history.length < 2) {
      return 0;
    }

    // Calculate rate based on recent history (items processed per second)
    // Note: history stores items processed per sample interval, not cumulative counts
    const recentHistory = history.slice(-10); // Last 10 samples
    const timePeriod =
      recentHistory.length * (this.config.sampleInterval / 1000); // Convert to seconds
    const totalProcessed = recentHistory.reduce((sum, count) => sum + count, 0);

    return timePeriod > 0 ? totalProcessed / timePeriod : 0;
  }

  private createEmptyQueueStats(): QueueStats {
    return {
      samples: 0,
      averageDepth: 0,
      peakDepth: 0,
      averageProcessingRate: 0,
      peakProcessingRate: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      totalItemsProcessed: 0,
      totalItemsDropped: 0,
      queueFullEvents: 0,
      lastSampleTime: new Date().toISOString(),
    };
  }

  // Public methods for queue management
  public registerQueue(queueName: string): void {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
      this.processingHistory.set(queueName, []);
      this.queueMetrics.set(queueName, this.createEmptyQueueStats());
    }
  }

  public enqueueItem(
    queueName: string,
    itemId: string,
    size?: number,
    priority?: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.isRunning()) {
      return;
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      this.registerQueue(queueName);
      this.enqueueItem(queueName, itemId, size, priority, metadata);
      return;
    }

    const item: QueueItem = {
      id: itemId,
      enqueuedAt: Date.now(),
      size,
      priority,
      metadata,
    };

    queue.push(item);

    // Emit enqueue event
    this.emitMetric('queue_item_enqueued', 1, 'count', {
      queue_name: queueName,
      item_id: itemId,
      queue_depth: queue.length.toString(),
    });
  }

  public dequeueItem(
    queueName: string,
    itemId?: string
  ): QueueItem | undefined {
    if (!this.isRunning()) {
      return undefined;
    }

    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return undefined;
    }

    let item: QueueItem | undefined;

    if (itemId) {
      // Remove specific item
      const index = queue.findIndex(i => i.id === itemId);
      if (index >= 0) {
        item = queue.splice(index, 1)[0];
      }
    } else {
      // Remove first item (FIFO)
      item = queue.shift();
    }

    if (item) {
      const waitTime = Date.now() - item.enqueuedAt;

      // Update processing history
      const history = this.processingHistory.get(queueName) || [];
      history.push(1);
      if (history.length > 100) {
        history.shift(); // Keep only recent history
      }

      // Update stats
      const stats = this.queueMetrics.get(queueName);
      if (stats) {
        stats.totalItemsProcessed++;
      }

      // Emit dequeue event
      this.emitMetric('queue_item_dequeued', 1, 'count', {
        queue_name: queueName,
        item_id: item.id,
        wait_time: waitTime.toString(),
        queue_depth: queue.length.toString(),
      });

      this.emitMetric('queue_item_wait_time', waitTime, 'ms', {
        queue_name: queueName,
        item_id: item.id,
      });
    }

    return item;
  }

  public dropItem(queueName: string, itemId: string, reason?: string): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    const index = queue.findIndex(i => i.id === itemId);
    if (index >= 0) {
      queue.splice(index, 1);

      // Update stats
      const stats = this.queueMetrics.get(queueName);
      if (stats) {
        stats.totalItemsDropped++;
      }

      // Emit drop event
      this.emitMetric('queue_item_dropped', 1, 'count', {
        queue_name: queueName,
        item_id: itemId,
        reason: reason || 'unknown',
        queue_depth: queue.length.toString(),
      });

      return true;
    }

    return false;
  }

  private resetStats(): void {
    this.queueStats = {
      samples: 0,
      averageDepth: 0,
      peakDepth: 0,
      averageProcessingRate: 0,
      peakProcessingRate: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      totalItemsProcessed: 0,
      totalItemsDropped: 0,
      queueFullEvents: 0,
      lastSampleTime: new Date().toISOString(),
    };
    this.queues.clear();
    this.queueMetrics.clear();
    this.processingHistory.clear();
  }

  // Public getters
  public getQueueStats(queueName?: string): QueueStats {
    if (queueName) {
      return {
        ...(this.queueMetrics.get(queueName) || this.createEmptyQueueStats()),
      };
    }
    return { ...this.queueStats };
  }

  public getQueueDepth(queueName: string): number {
    const queue = this.queues.get(queueName);
    return queue ? queue.length : 0;
  }

  public getAllQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }
}
