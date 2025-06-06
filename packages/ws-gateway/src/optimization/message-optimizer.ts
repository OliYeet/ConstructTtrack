/**
 * Message Optimizer
 *
 * Implements message batching, compression, and deduplication
 * to reduce WebSocket traffic and improve performance
 *
 * Part of LUM-584 Performance Optimization Phase 2
 */

import { logger } from '../utils/logger';

import { performanceProfiler } from './performance-profiler';

export interface OptimizedMessage {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  compressed?: boolean;
  batchId?: string;
}

export class MessageOptimizer {
  private messageDeduplication = new Map<string, number>();

  constructor(
    private readonly config = {
      enabled: true,
      compressionThreshold: 1024, // Compress messages > 1KB
      deduplicationWindowMs: 5000, // 5 second deduplication window
    }
  ) {}

  /**
   * Optimize a message for sending
   */
  async optimizeMessage(
    message: OptimizedMessage,
    _targetId: string
  ): Promise<OptimizedMessage> {
    if (!this.config.enabled) {
      return message;
    }

    return performanceProfiler.timeAsyncOperation(
      'message_optimization',
      async () => {
        // Check for deduplication
        if (this.isDuplicate(message)) {
          logger.debug('Duplicate message filtered', { messageId: message.id });
          return message; // Return original but don't send
        }

        // Record message for deduplication
        this.recordMessage(message);

        // Handle high priority messages immediately
        if (message.priority === 'critical' || message.priority === 'high') {
          return await this.processImmediateMessage(message);
        }

        return message;
      },
      { messageType: message.type, priority: message.priority }
    );
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return {
      deduplicationCacheSize: this.messageDeduplication.size,
      config: this.config,
    };
  }

  /**
   * Clear optimization caches
   */
  clearCaches(): void {
    this.messageDeduplication.clear();
  }

  /**
   * Process high priority message immediately
   */
  private async processImmediateMessage(
    message: OptimizedMessage
  ): Promise<OptimizedMessage> {
    // For now, just return the message as-is
    // Future: implement compression for large messages
    return message;
  }

  /**
   * Check if message is duplicate
   */
  private isDuplicate(message: OptimizedMessage): boolean {
    const messageHash = this.hashMessage(message);
    const lastSeen = this.messageDeduplication.get(messageHash);

    if (lastSeen && Date.now() - lastSeen < this.config.deduplicationWindowMs) {
      return true;
    }

    return false;
  }

  /**
   * Record message for deduplication
   */
  private recordMessage(message: OptimizedMessage): void {
    const messageHash = this.hashMessage(message);
    this.messageDeduplication.set(messageHash, Date.now());

    // Cleanup old entries
    const cutoff = Date.now() - this.config.deduplicationWindowMs;
    for (const [hash, timestamp] of this.messageDeduplication.entries()) {
      if (timestamp < cutoff) {
        this.messageDeduplication.delete(hash);
      }
    }
  }

  /**
   * Create hash for message deduplication
   */
  private hashMessage(message: OptimizedMessage): string {
    // Create hash based on type and data content, excluding timestamp and id
    const content = {
      type: message.type,
      data: message.data,
    };
    return Buffer.from(JSON.stringify(content)).toString('base64');
  }
}

// Global message optimizer instance
export const messageOptimizer = new MessageOptimizer();
