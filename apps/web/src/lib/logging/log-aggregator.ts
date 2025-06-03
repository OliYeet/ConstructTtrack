/**
 * Log Aggregation Service
 * Collects, buffers, and forwards logs to external services
 */

import { StructuredLogEntry, LogLevel } from './structured-logger';

// Log aggregation configuration
export interface LogAggregatorConfig {
  bufferSize: number;
  flushInterval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  enableCompression: boolean;
  endpoints: LogEndpoint[];
}

// External log endpoint configuration
export interface LogEndpoint {
  name: string;
  url: string;
  headers?: Record<string, string>;
  apiKey?: string;
  format: 'json' | 'text' | 'syslog';
  minLevel: LogLevel;
  enabled: boolean;
}

// Log batch for sending to external services
export interface LogBatch {
  timestamp: string;
  service: string;
  environment: string;
  entries: StructuredLogEntry[];
  metadata: {
    batchId: string;
    entryCount: number;
    totalSize: number;
  };
}

// Log aggregator class
export class LogAggregator {
  private config: LogAggregatorConfig;
  private buffer: StructuredLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: LogAggregatorConfig) {
    this.config = config;
    this.startFlushTimer();
  }

  // Add log entry to buffer
  async addEntry(entry: StructuredLogEntry): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  // Flush buffer to external endpoints
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    const batch = this.createBatch(entries);
    
    // Send to all enabled endpoints
    const promises = this.config.endpoints
      .filter(endpoint => endpoint.enabled)
      .map(endpoint => this.sendToEndpoint(batch, endpoint));

    await Promise.allSettled(promises);
  }

  // Create log batch
  private createBatch(entries: StructuredLogEntry[]): LogBatch {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const totalSize = JSON.stringify(entries).length;

    return {
      timestamp: new Date().toISOString(),
      service: entries[0]?.service || 'constructtrack',
      environment: entries[0]?.environment || 'development',
      entries,
      metadata: {
        batchId,
        entryCount: entries.length,
        totalSize,
      },
    };
  }

  // Send batch to external endpoint
  private async sendToEndpoint(batch: LogBatch, endpoint: LogEndpoint): Promise<void> {
    // Filter entries by minimum level
    const filteredEntries = batch.entries.filter(
      entry => entry.level <= endpoint.minLevel
    );

    if (filteredEntries.length === 0) {
      return;
    }

    let payload: string | Buffer = this.formatPayload(
      { ...batch, entries: filteredEntries },
      endpoint.format
    );

    if (this.config.enableCompression && typeof window === 'undefined') {
      try {
        const { gzipSync } = await import('zlib');
        payload = gzipSync(Buffer.from(payload));
      } catch (error) {
        // Compression failed, continue with uncompressed payload
        console.warn('Failed to compress log payload:', error);
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': this.getContentType(endpoint.format),
      'User-Agent': 'ConstructTrack-LogAggregator/1.0',
      ...endpoint.headers,
    };

    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    if (this.config.enableCompression) {
      headers['Content-Encoding'] = 'gzip';
    }

 let attempt = 0;
 while (attempt < this.config.retryAttempts) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: payload,
        });

        if (response.ok) {
          console.debug(`Log batch sent to ${endpoint.name}:`, batch.metadata);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        attempt++;
        console.error(`Failed to send logs to ${endpoint.name} (attempt ${attempt}):`, error);

        if (attempt <= this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    console.error(`Failed to send logs to ${endpoint.name} after ${this.config.retryAttempts} attempts`);
  }

  // Format payload based on endpoint format
  private formatPayload(batch: LogBatch, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(batch);
      
      case 'text':
        return batch.entries
          .map(entry => `${entry.timestamp} ${LogLevel[entry.level]} ${entry.message}`)
          .join('\n');
      
      case 'syslog':
        return batch.entries
          .map(entry => this.formatSyslog(entry))
          .join('\n');
      
      default:
        return JSON.stringify(batch);
    }
  }

  // Format entry as syslog
  private formatSyslog(entry: StructuredLogEntry): string {
    const priority = this.getSyslogPriority(entry.level);
    const timestamp = new Date(entry.timestamp).toISOString();
    const hostname = process.env.HOSTNAME || 'constructtrack';
    const tag = entry.service;
    
    return `<${priority}>${timestamp} ${hostname} ${tag}: ${entry.message}`;
  }

  // Get syslog priority for log level
  private getSyslogPriority(level: LogLevel): number {
    // Facility: 16 (local0), Severity based on log level
    const facility = 16;
    const severity = level <= LogLevel.ERROR ? 3 : // Error
                    level <= LogLevel.WARN ? 4 :   // Warning
                    level <= LogLevel.INFO ? 6 :   // Info
                    7; // Debug
    
    return facility * 8 + severity;
  }

  // Get content type for format
  private getContentType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'text':
      case 'syslog':
        return 'text/plain';
      default:
        return 'application/json';
    }
  }

  // Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start flush timer
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Error during scheduled flush:', error);
      });
    }, this.config.flushInterval);
  }

  // Stop flush timer
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopFlushTimer();
    
    // Flush remaining entries
    await this.flush();
  }

  // Get buffer status
  getStatus(): {
    bufferSize: number;
    bufferCapacity: number;
    isShuttingDown: boolean;
    endpoints: Array<{ name: string; enabled: boolean; minLevel: string }>;
  } {
    return {
      bufferSize: this.buffer.length,
      bufferCapacity: this.config.bufferSize,
      isShuttingDown: this.isShuttingDown,
      endpoints: this.config.endpoints.map(endpoint => ({
        name: endpoint.name,
        enabled: endpoint.enabled,
        minLevel: LogLevel[endpoint.minLevel],
      })),
    };
  }
}

// Default configuration
export const defaultAggregatorConfig: LogAggregatorConfig = {
  bufferSize: 100,
  flushInterval: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableCompression: false,
  endpoints: [],
};

// Create aggregator instance
export function createLogAggregator(config?: Partial<LogAggregatorConfig>): LogAggregator {
  const finalConfig = { ...defaultAggregatorConfig, ...config };
  return new LogAggregator(finalConfig);
}
