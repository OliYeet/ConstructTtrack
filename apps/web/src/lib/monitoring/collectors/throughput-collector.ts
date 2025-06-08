/**
 * Throughput Collector
 * Tracks events processed, bytes transferred, and message rates
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { realtimeConfig } from '../config/realtime-config';

import { BaseRealtimeCollector } from './base';

// Throughput event types
export type ThroughputEventType =
  | 'message_sent'
  | 'message_received'
  | 'event_processed'
  | 'bytes_transferred';

// Throughput event data
export interface ThroughputEvent {
  type: ThroughputEventType;
  size: number; // bytes or count
  channel?: string;
  messageType?: string;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Throughput statistics
export interface ThroughputStats {
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalEventsProcessed: number;
  totalBytesTransferred: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  averageMessageSize: number;
  peakMessagesPerSecond: number;
  peakBytesPerSecond: number;
}

// Time window for rate calculations
interface TimeWindow {
  startTime: number;
  messageCount: number;
  byteCount: number;
}

export class ThroughputCollector extends BaseRealtimeCollector {
  private throughputStats: ThroughputStats;
  private config = realtimeConfig.collectors.throughput;
  private timeWindows: TimeWindow[] = [];
  private aggregationInterval?: NodeJS.Timeout;
  private readonly windowSize = this.config.aggregationWindow; // 5 seconds by default

  constructor() {
    super('throughput-collector');
    this.throughputStats = {
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalEventsProcessed: 0,
      totalBytesTransferred: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      averageMessageSize: 0,
      peakMessagesPerSecond: 0,
      peakBytesPerSecond: 0,
    };
  }

  protected onStart(): void {
    this.resetStats();
    this.startAggregation();
  }

  protected onStop(): void {
    this.stopAggregation();
  }

  private startAggregation(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    // Aggregate and emit stats every window size
    this.aggregationInterval = setInterval(() => {
      this.aggregateAndEmitStats();
    }, this.windowSize);
  }

  private stopAggregation(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }
  }

  private aggregateAndEmitStats(): void {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Remove old windows (older than aggregation window)
    this.timeWindows = this.timeWindows.filter(
      window => window.startTime > windowStart
    );

    // Calculate current rates
    const totalMessages = this.timeWindows.reduce(
      (sum, window) => sum + window.messageCount,
      0
    );
    const totalBytes = this.timeWindows.reduce(
      (sum, window) => sum + window.byteCount,
      0
    );

    this.throughputStats.messagesPerSecond =
      totalMessages / (this.windowSize / 1000);
    this.throughputStats.bytesPerSecond = totalBytes / (this.windowSize / 1000);

    // Update peaks
    if (
      this.throughputStats.messagesPerSecond >
      this.throughputStats.peakMessagesPerSecond
    ) {
      this.throughputStats.peakMessagesPerSecond =
        this.throughputStats.messagesPerSecond;
    }

    if (
      this.throughputStats.bytesPerSecond >
      this.throughputStats.peakBytesPerSecond
    ) {
      this.throughputStats.peakBytesPerSecond =
        this.throughputStats.bytesPerSecond;
    }

    // Update average message size
    const totalMessagesForAverage =
      this.throughputStats.totalMessagesSent +
      this.throughputStats.totalMessagesReceived;
    if (totalMessagesForAverage > 0) {
      this.throughputStats.averageMessageSize =
        this.throughputStats.totalBytesTransferred / totalMessagesForAverage;
    }

    // Emit aggregated metrics
    this.emitAggregatedMetrics();
  }

  private emitAggregatedMetrics(): void {
    // Rate metrics
    this.emitMetric(
      'messages_per_second',
      this.throughputStats.messagesPerSecond,
      'rate'
    );
    this.emitMetric(
      'bytes_per_second',
      this.throughputStats.bytesPerSecond,
      'rate'
    );

    // Total metrics
    this.emitMetric(
      'messages_sent_total',
      this.throughputStats.totalMessagesSent,
      'count'
    );
    this.emitMetric(
      'messages_received_total',
      this.throughputStats.totalMessagesReceived,
      'count'
    );
    this.emitMetric(
      'events_processed_total',
      this.throughputStats.totalEventsProcessed,
      'count'
    );
    this.emitMetric(
      'bytes_transferred_total',
      this.throughputStats.totalBytesTransferred,
      'bytes'
    );

    // Average and peak metrics
    this.emitMetric(
      'message_size_average',
      this.throughputStats.averageMessageSize,
      'bytes'
    );
    this.emitMetric(
      'messages_per_second_peak',
      this.throughputStats.peakMessagesPerSecond,
      'rate'
    );
    this.emitMetric(
      'bytes_per_second_peak',
      this.throughputStats.peakBytesPerSecond,
      'rate'
    );
  }

  // Public methods for tracking throughput events
  public trackThroughput(event: ThroughputEvent): void {
    if (!this.isRunning() || !this.shouldSample()) {
      return;
    }

    try {
      this.processThroughputEvent(event);
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'trackThroughput'
      );
    }
  }

  private processThroughputEvent(event: ThroughputEvent): void {
    const { type, size, channel, messageType, userId, metadata } = event;

    // Update statistics based on event type
    switch (type) {
      case 'message_sent':
        this.throughputStats.totalMessagesSent++;
        this.throughputStats.totalBytesTransferred += size;
        break;
      case 'message_received':
        this.throughputStats.totalMessagesReceived++;
        this.throughputStats.totalBytesTransferred += size;
        break;
      case 'event_processed':
        this.throughputStats.totalEventsProcessed++;
        break;
      case 'bytes_transferred':
        this.throughputStats.totalBytesTransferred += size;
        break;
    }

    // Add to current time window
    this.addToTimeWindow(size);

    // Emit the raw throughput event as a metric
    this.emitMetric(
      `throughput_${type}`,
      size,
      type === 'event_processed' ? 'count' : 'bytes',
      {
        channel: channel || 'unknown',
        message_type: messageType || 'unknown',
        user_id: userId || 'anonymous',
      },
      metadata
    );
  }

  private addToTimeWindow(size: number): void {
    const now = Date.now();
    const currentWindow = this.getCurrentTimeWindow(now);

    currentWindow.messageCount++;
    currentWindow.byteCount += size;
  }

  private getCurrentTimeWindow(timestamp: number): TimeWindow {
    // Find or create current time window
    const windowStart =
      Math.floor(timestamp / this.windowSize) * this.windowSize;

    let currentWindow = this.timeWindows.find(
      window => window.startTime === windowStart
    );

    if (!currentWindow) {
      currentWindow = {
        startTime: windowStart,
        messageCount: 0,
        byteCount: 0,
      };
      this.timeWindows.push(currentWindow);
    }

    return currentWindow;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private resetStats(): void {
    this.throughputStats = {
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalEventsProcessed: 0,
      totalBytesTransferred: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      averageMessageSize: 0,
      peakMessagesPerSecond: 0,
      peakBytesPerSecond: 0,
    };
    this.timeWindows = [];
  }

  // Convenience methods for common tracking scenarios
  public trackMessageSent(
    size: number,
    channel?: string,
    messageType?: string,
    userId?: string
  ): void {
    this.trackThroughput({
      type: 'message_sent',
      size,
      channel,
      messageType,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  public trackMessageReceived(
    size: number,
    channel?: string,
    messageType?: string,
    userId?: string
  ): void {
    this.trackThroughput({
      type: 'message_received',
      size,
      channel,
      messageType,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  public trackEventProcessed(
    channel?: string,
    eventType?: string,
    userId?: string
  ): void {
    this.trackThroughput({
      type: 'event_processed',
      size: 1,
      channel,
      messageType: eventType,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  public trackBytesTransferred(
    bytes: number,
    channel?: string,
    userId?: string
  ): void {
    this.trackThroughput({
      type: 'bytes_transferred',
      size: bytes,
      channel,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Public getters for statistics
  public getThroughputStats(): ThroughputStats {
    return { ...this.throughputStats };
  }

  public getCurrentRates(): {
    messagesPerSecond: number;
    bytesPerSecond: number;
  } {
    return {
      messagesPerSecond: this.throughputStats.messagesPerSecond,
      bytesPerSecond: this.throughputStats.bytesPerSecond,
    };
  }
}
