/**
 * Event Sourcing Monitoring
 * Monitoring and metrics for the event sourcing system
 */

import type {
  EventStoreMetrics,
  EventProcessingResult,
  BatchProcessingResult,
} from './types';

export class EventSourcingMonitor {
  private metrics: EventStoreMetrics;
  private processingTimes: number[] = [];
  private errorCount = 0;
  private totalEvents = 0;

  constructor() {
    this.metrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      storageSize: 0,
      oldestEvent: new Date(),
      newestEvent: new Date(),
    };
  }

  /**
   * Record event processing result
   */
  recordEventProcessing(result: EventProcessingResult): void {
    this.totalEvents++;

    if (result.processingTime) {
      this.processingTimes.push(result.processingTime);

      // Keep only last 1000 processing times for memory efficiency
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }
    }

    if (!result.success) {
      this.errorCount++;
    }

    this.updateMetrics();
  }

  /**
   * Record batch processing result
   */
  recordBatchProcessing(result: BatchProcessingResult): void {
    this.totalEvents += result.totalEvents;
    this.errorCount += result.failedEvents;

    // Record individual processing times
    result.results.forEach(r => {
      if (r.processingTime) {
        this.processingTimes.push(r.processingTime);
      }
    });

    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000);
    }

    this.updateMetrics();
  }

  /**
   * Record event sourced (for integration with existing monitoring)
   */
  recordEventSourced(eventId: string, sourcedAt?: number): void {
    const processingTime = sourcedAt ? Date.now() - sourcedAt : undefined;

    this.recordEventProcessing({
      success: true,
      eventId,
      processingTime,
    });
  }

  /**
   * Record processing error (for integration with existing monitoring)
   */
  recordProcessingError(
    eventId: string,
    error: { code: string; message: string }
  ): void {
    this.recordEventProcessing({
      success: false,
      eventId,
      error: error.message,
    });
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    this.metrics.totalEvents = this.totalEvents;
    this.metrics.errorRate =
      this.totalEvents > 0 ? this.errorCount / this.totalEvents : 0;

    if (this.processingTimes.length > 0) {
      this.metrics.averageProcessingTime =
        this.processingTimes.reduce((sum, time) => sum + time, 0) /
        this.processingTimes.length;
    }

    // Calculate events per second (rough estimate based on recent processing times)
    if (this.processingTimes.length > 10) {
      const recentTimes = this.processingTimes.slice(-10);
      const avgRecentTime =
        recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
      this.metrics.eventsPerSecond =
        avgRecentTime > 0 ? 1000 / avgRecentTime : 0;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventStoreMetrics {
    return { ...this.metrics };
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    errorRate: number;
    averageProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
  } {
    const successfulEvents = this.totalEvents - this.errorCount;
    const sortedTimes = [...this.processingTimes].sort((a, b) => a - b);

    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      totalEvents: this.totalEvents,
      successfulEvents,
      failedEvents: this.errorCount,
      errorRate: this.metrics.errorRate,
      averageProcessingTime: this.metrics.averageProcessingTime,
      p95ProcessingTime: sortedTimes[p95Index] || 0,
      p99ProcessingTime: sortedTimes[p99Index] || 0,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      storageSize: 0,
      oldestEvent: new Date(),
      newestEvent: new Date(),
    };
    this.processingTimes = [];
    this.errorCount = 0;
    this.totalEvents = 0;
  }

  /**
   * Create monitoring report
   */
  createReport(): {
    timestamp: string;
    metrics: EventStoreMetrics;
    processingStats: ReturnType<typeof this.getProcessingStats>;
    health: 'healthy' | 'warning' | 'critical';
  } {
    const processingStats = this.getProcessingStats();

    // Determine health status
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (processingStats.errorRate > 0.1) {
      // > 10% error rate
      health = 'critical';
    } else if (
      processingStats.errorRate > 0.05 ||
      processingStats.averageProcessingTime > 1000
    ) {
      health = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      processingStats,
      health,
    };
  }
}

// Global monitor instance for integration with existing monitoring
export const eventSourcingMonitor = new EventSourcingMonitor();
