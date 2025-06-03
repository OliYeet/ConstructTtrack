/**
 * Enhanced Structured Logger
 * Builds upon the existing logger with structured logging, correlation tracking, and log aggregation
 */

import { NextRequest } from 'next/server';
import { RequestContext } from '@/types/api';

// Enhanced log levels with numeric values for comparison
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Structured log entry interface
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  service: string;
  environment: string;
  version: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
  request?: {
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
  };
  response?: {
    statusCode: number;
    contentLength?: number;
  };
}

// Log transport interface for different output destinations
export interface LogTransport {
  name: string;
  level: LogLevel;
  write(entry: StructuredLogEntry): Promise<void> | void;
}

// Console transport with enhanced formatting
export class ConsoleTransport implements LogTransport {
  name = 'console';
  level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  write(entry: StructuredLogEntry): void {
    if (entry.level > this.level) return;

    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '';
    
    let message = `${timestamp} ${levelName} ${correlationId} ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\nMetadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      message += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && process.env.NODE_ENV === 'development') {
        message += `\nStack: ${entry.error.stack}`;
      }
    }

    if (entry.performance?.duration) {
      message += `\nDuration: ${entry.performance.duration}ms`;
    }

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(message);
        break;
    }
  }
}

// File transport for persistent logging
export class FileTransport implements LogTransport {
  name = 'file';
  level: LogLevel;
  private filePath: string;
  private fs: typeof import('fs/promises') | null = null;

  constructor(filePath: string, level: LogLevel = LogLevel.INFO) {
    this.filePath = filePath;
    this.level = level;
  }

  private async getFs() {
    if (!this.fs) {
      // Only import fs in Node.js environment
      if (typeof window === 'undefined') {
        this.fs = await import('fs/promises');
      }
    }
    return this.fs;
  }

  async write(entry: StructuredLogEntry): Promise<void> {
    if (entry.level > this.level) return;

    try {
      const fs = await this.getFs();
      if (fs) {
        await fs.appendFile(this.filePath, JSON.stringify(entry) + '\n');
      } else {
        // Browser environment - fallback to console
        console.log('Log entry:', entry);
      }
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
      console.log('Log entry:', entry);
    }
  }
}

// Enhanced structured logger class
export class StructuredLogger {
  private transports: LogTransport[] = [];
  private service: string;
  private environment: string;
  private version: string;
  private defaultMetadata: Record<string, unknown> = {};

  constructor(options: {
    service: string;
    environment?: string;
    version?: string;
    transports?: LogTransport[];
    defaultMetadata?: Record<string, unknown>;
  }) {
    this.service = options.service;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.npm_package_version || '1.0.0';
    this.transports = options.transports || [new ConsoleTransport()];
    this.defaultMetadata = options.defaultMetadata || {};
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name);
  }

  private async writeToTransports(entry: StructuredLogEntry): Promise<void> {
    await Promise.allSettled(
      this.transports.map(async transport => {
        try {
          await transport.write(entry);
        } catch (error) {
          console.error(`Transport ${transport.name} failed:`, error);
        }
      }),
    );
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Partial<StructuredLogEntry>
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      version: this.version,
      metadata: { ...this.defaultMetadata, ...context?.metadata },
      ...context,
    };
  }

  async log(
    level: LogLevel,
    message: string,
    context?: Partial<StructuredLogEntry>
  ): Promise<void> {
    const entry = this.createLogEntry(level, message, context);
    await this.writeToTransports(entry);
  }

  async error(
    message: string,
    error?: Error | unknown,
    context?: Partial<StructuredLogEntry>
  ): Promise<void> {
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    await this.log(LogLevel.ERROR, message, {
      ...context,
      error: errorInfo,
    });
  }

  async warn(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.log(LogLevel.WARN, message, context);
  }

  async info(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.log(LogLevel.INFO, message, context);
  }

  async debug(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context);
  }

  async trace(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.log(LogLevel.TRACE, message, context);
  }

  // Convenience methods for API logging
  async logRequest(
    request: NextRequest,
    context?: RequestContext & { correlationId?: string }
  ): Promise<void> {
    await this.info('API Request', {
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      request: {
        method: request.method || 'GET',
        url: request.url,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown',
      },
    });
  }

  async logResponse(
    request: NextRequest,
    statusCode: number,
    duration: number,
    context?: RequestContext & { correlationId?: string }
  ): Promise<void> {
    const level = statusCode >= 500 ? LogLevel.ERROR :
                  statusCode >= 400 ? LogLevel.WARN :
                  LogLevel.INFO;

    await this.log(level, 'API Response', {
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      request: {
        method: request.method || 'GET',
        url: request.url,
      },
      response: {
        statusCode,
      },
      performance: {
        duration,
      },
    });
  }

  async logError(
    message: string,
    error: Error | unknown,
    request?: NextRequest,
    context?: RequestContext & { correlationId?: string }
  ): Promise<void> {
    await this.error(message, error, {
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.user?.id,
      organizationId: context?.organizationId,
      request: request ? {
        method: request.method || 'GET',
        url: request.url,
      } : undefined,
    });
  }

  // Performance logging
  async logPerformance(
    operation: string,
    duration: number,
    context?: Partial<StructuredLogEntry>
  ): Promise<void> {
    await this.info(`Performance: ${operation}`, {
      ...context,
      performance: {
        duration,
        memoryUsage: process.memoryUsage(),
        ...context?.performance,
      },
    });
  }

  // Create child logger with additional context
  child(additionalMetadata: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger({
      service: this.service,
      environment: this.environment,
      version: this.version,
      transports: this.transports,
      defaultMetadata: {
        ...this.defaultMetadata,
        ...additionalMetadata,
      },
    });
  }
}
