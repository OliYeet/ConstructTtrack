/**
 * Enhanced Logging System
 * Main entry point for the enhanced logging infrastructure
 */

import { NextRequest } from 'next/server';
import { RequestContext } from '@/types/api';
import {
  StructuredLogger,
  LogLevel,
  ConsoleTransport,
  FileTransport,
  StructuredLogEntry,
} from './structured-logger';
import {
  createCorrelationContext,
  createEnhancedRequestContext,
  createCorrelationMetadata,
  generateCorrelationId,
  generateRequestId,
  withCorrelation,
} from './correlation';
import {
  LogAggregator,
  createLogAggregator,
  defaultAggregatorConfig,
  LogAggregatorConfig,
} from './log-aggregator';

// Enhanced logger configuration
export interface EnhancedLoggerConfig {
  service: string;
  environment?: string;
  version?: string;
  enableFileLogging?: boolean;
  logFilePath?: string;
  enableAggregation?: boolean;
  aggregatorConfig?: Partial<LogAggregatorConfig>;
  defaultMetadata?: Record<string, unknown>;
}

// Transport that sends logs to aggregator
class AggregatorTransport {
  name = 'aggregator';
  level: LogLevel;
  private aggregator: LogAggregator;

  constructor(aggregator: LogAggregator, level: LogLevel = LogLevel.INFO) {
    this.aggregator = aggregator;
    this.level = level;
  }

  async write(entry: StructuredLogEntry): Promise<void> {
    if (entry.level <= this.level) {
      await this.aggregator.addEntry(entry);
    }
  }
}

// Enhanced logger instance
class EnhancedLoggerInstance {
  private logger: StructuredLogger;
  private aggregator?: LogAggregator;
  private config: EnhancedLoggerConfig;

  constructor(config: EnhancedLoggerConfig) {
    this.config = config;
    
    // Create transports
    const transports = [new ConsoleTransport()];
    
    // Add file transport if enabled
    if (config.enableFileLogging && config.logFilePath) {
      transports.push(new FileTransport(config.logFilePath));
    }
    
    // Create aggregator if enabled
    if (config.enableAggregation) {
      this.aggregator = createLogAggregator(config.aggregatorConfig);
      transports.push(new AggregatorTransport(this.aggregator));
    }
    
    // Create structured logger
    this.logger = new StructuredLogger({
      service: config.service,
      environment: config.environment,
      version: config.version,
      transports,
      defaultMetadata: config.defaultMetadata,
    });
  }

  // Get the underlying logger
  getLogger(): StructuredLogger {
    return this.logger;
  }

  // Get aggregator status
  getAggregatorStatus() {
    return this.aggregator?.getStatus();
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.aggregator) {
      await this.aggregator.shutdown();
    }
  }

  // Enhanced API logging methods
  async logRequest(request: NextRequest, context?: RequestContext): Promise<void> {
    const enhancedContext = createEnhancedRequestContext(request, context);
    await this.logger.logRequest(request, enhancedContext);
  }

  async logResponse(
    request: NextRequest,
    statusCode: number,
    duration: number,
    context?: RequestContext
  ): Promise<void> {
    const enhancedContext = createEnhancedRequestContext(request, context);
    await this.logger.logResponse(request, statusCode, duration, enhancedContext);
  }

  async logError(
    message: string,
    error: Error | unknown,
    request?: NextRequest,
    context?: RequestContext
  ): Promise<void> {
    const enhancedContext = request ? 
      createEnhancedRequestContext(request, context) : 
      context;
    await this.logger.logError(message, error, request, enhancedContext);
  }

  // Direct logging methods
  async error(message: string, error?: Error | unknown, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.logger.error(message, error, context);
  }

  async warn(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.logger.warn(message, context);
  }

  async info(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.logger.info(message, context);
  }

  async debug(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.logger.debug(message, context);
  }

  async trace(message: string, context?: Partial<StructuredLogEntry>): Promise<void> {
    await this.logger.trace(message, context);
  }

  // Performance logging
  async logPerformance(
    operation: string,
    duration: number,
    context?: Partial<StructuredLogEntry>
  ): Promise<void> {
    await this.logger.logPerformance(operation, duration, context);
  }

  // Create child logger
  child(additionalMetadata: Record<string, unknown>): StructuredLogger {
    return this.logger.child(additionalMetadata);
  }
}

// Default configuration
const defaultConfig: EnhancedLoggerConfig = {
  service: 'constructtrack-web',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  enableFileLogging: process.env.NODE_ENV === 'production',
  logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
  enableAggregation: process.env.ENABLE_LOG_AGGREGATION === 'true',
  aggregatorConfig: {
    ...defaultAggregatorConfig,
    endpoints: process.env.LOG_ENDPOINTS ? 
      JSON.parse(process.env.LOG_ENDPOINTS) : 
      [],
  },
};

// Global logger instance
let globalLogger: EnhancedLoggerInstance;

// Initialize logger
export function initializeLogger(config?: Partial<EnhancedLoggerConfig>): EnhancedLoggerInstance {
  const finalConfig = { ...defaultConfig, ...config };
  globalLogger = new EnhancedLoggerInstance(finalConfig);
  return globalLogger;
}

// Get logger instance
export function getLogger(): EnhancedLoggerInstance {
  if (!globalLogger) {
    globalLogger = initializeLogger();
  }
  return globalLogger;
}

// Convenience functions that use the global logger
export async function logRequest(request: NextRequest, context?: RequestContext): Promise<void> {
  await getLogger().logRequest(request, context);
}

export async function logResponse(
  request: NextRequest,
  statusCode: number,
  duration: number,
  context?: RequestContext
): Promise<void> {
  await getLogger().logResponse(request, statusCode, duration, context);
}

export async function logError(
  message: string,
  error: Error | unknown,
  request?: NextRequest,
  context?: RequestContext
): Promise<void> {
  await getLogger().logError(message, error, request, context);
}

export async function logPerformance(
  operation: string,
  duration: number,
  context?: Partial<StructuredLogEntry>
): Promise<void> {
  await getLogger().logPerformance(operation, duration, context);
}

// Export types and utilities
export {
  LogLevel,
  StructuredLogEntry,
  StructuredLogger,
  ConsoleTransport,
  FileTransport,
  LogAggregator,
  createLogAggregator,
  generateCorrelationId,
  generateRequestId,
  createCorrelationContext,
  createEnhancedRequestContext,
  createCorrelationMetadata,
  withCorrelation,
};

export type { EnhancedLoggerConfig, LogAggregatorConfig };

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  if (globalLogger) {
    await globalLogger.shutdown();
  }
});

process.on('SIGINT', async () => {
  if (globalLogger) {
    await globalLogger.shutdown();
  }
});
