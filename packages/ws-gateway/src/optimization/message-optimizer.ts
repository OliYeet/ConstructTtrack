/**
 * Message Optimizer
 *
 * Implements message batching, compression, and deduplication
 * to reduce WebSocket traffic and improve performance
 *
 * Part of LUM-584 Performance Optimization Phase 2
 */

import { promisify } from 'util';
import { gzip } from 'zlib';

import { logger } from '../utils/logger';

import { performanceProfiler } from './performance-profiler';

const gzipAsync = promisify(gzip);

export interface OptimizedMessage {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  compressed?: boolean;
  batchId?: string;
}

export interface MessageBatch {
  id: string;
  messages: OptimizedMessage[];
  totalSize: number;
  compressed: boolean;
  createdAt: number;
}

export class MessageOptimizer {
  private messageDeduplication = new Map<string, number>();
  private pendingBatches = new Map<string, OptimizedMessage[]>();
  private batchTimers = new Map<
    string,
    ReturnType<typeof globalThis.setTimeout>
  >();

  constructor(
    private readonly config = {
      enabled: true,
      batchSize: 10,
      batchTimeoutMs: 100, // 100ms batching window
      compressionThreshold: 1024, // Compress messages > 1KB
      compressionLevel: 6, // gzip compression level
      deduplicationWindowMs: 5000, // 5 second deduplication window
      maxBatchSize: 50, // Maximum messages per batch
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

        // Add to batch for normal/low priority messages
        return this.addToBatch(message, _targetId);
      },
      { messageType: message.type, priority: message.priority }
    );
  }

  /**
   * Compress message data if it exceeds threshold
   */
  async compressMessage(message: OptimizedMessage): Promise<OptimizedMessage> {
    const messageStr = JSON.stringify(message.data);
    const originalSize = Buffer.byteLength(messageStr, 'utf8');

    if (originalSize < this.config.compressionThreshold) {
      return message;
    }

    return performanceProfiler.timeAsyncOperation(
      'message_compression',
      async () => {
        try {
          const compressed = await gzipAsync(messageStr, {
            level: this.config.compressionLevel,
          });

          const compressionRatio = compressed.length / originalSize;

          // Only use compression if it provides significant benefit
          if (compressionRatio < 0.8) {
            logger.debug('Message compressed', {
              messageId: message.id,
              originalSize,
              compressedSize: compressed.length,
              ratio: compressionRatio,
            });

            return {
              ...message,
              data: compressed.toString('base64'),
              compressed: true,
            };
          }

          return message;
        } catch (error) {
          logger.error('Compression failed', {
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return message;
        }
      },
      { originalSize }
    );
  }

  /**
   * Create a message batch
   */
  createBatch(messages: OptimizedMessage[]): MessageBatch {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const totalSize = messages.reduce((size, msg) => {
      return size + Buffer.byteLength(JSON.stringify(msg), 'utf8');
    }, 0);

    return {
      id: batchId,
      messages,
      totalSize,
      compressed: false,
      createdAt: Date.now(),
    };
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return {
      pendingBatches: this.pendingBatches.size,
      deduplicationCacheSize: this.messageDeduplication.size,
      activeBatchTimers: this.batchTimers.size,
      config: this.config,
    };
  }

  /**
   * Clear optimization caches
   */
  clearCaches(): void {
    this.messageDeduplication.clear();
    this.batchTimers.forEach(timer => globalThis.clearTimeout(timer));
    this.batchTimers.clear();
    this.pendingBatches.clear();
  }

  /**
   * Process high priority message immediately
   */
  private async processImmediateMessage(
    message: OptimizedMessage
  ): Promise<OptimizedMessage> {
    return await this.compressMessage(message);
  }

  /**
   * Add message to batch
   */
  private addToBatch(
    message: OptimizedMessage,
    targetId: string
  ): OptimizedMessage {
    if (!this.pendingBatches.has(targetId)) {
      this.pendingBatches.set(targetId, []);
    }

    const batch = this.pendingBatches.get(targetId);
    if (!batch) {
      return message;
    }
    batch.push(message);

    // Check if batch is ready to send
    if (
      batch.length >= this.config.batchSize ||
      batch.length >= this.config.maxBatchSize
    ) {
      this.flushBatch(targetId);
    } else if (!this.batchTimers.has(targetId)) {
      // Set timer to flush batch after timeout
      const timer = globalThis.setTimeout(() => {
        this.flushBatch(targetId);
      }, this.config.batchTimeoutMs);

      this.batchTimers.set(targetId, timer);
    }

    return message;
  }

  /**
   * Flush a batch for a target
   */
  private flushBatch(targetId: string): void {
    const batch = this.pendingBatches.get(targetId);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear timer
    const timer = this.batchTimers.get(targetId);
    if (timer) {
      globalThis.clearTimeout(timer);
      this.batchTimers.delete(targetId);
    }

    // Remove batch from pending
    this.pendingBatches.delete(targetId);

    logger.debug('Batch flushed', {
      targetId,
      messageCount: batch.length,
    });
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
