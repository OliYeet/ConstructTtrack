/**
 * Simple API Logger
 * Basic logging utility for API requests and responses
 */

import { NextRequest } from 'next/server';

import { RequestContext } from '@/types/api';

// Log levels
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

// Log entry structure
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: Error | unknown;
  metadata?: Record<string, unknown>;
}

// Simple logger class
class ApiLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase();

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
    ];
    const currentLevelIndex = levels.indexOf(this.logLevel as LogLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): string {
    const {
      level,
      message,
      timestamp,
      requestId,
      userId,
      method,
      url,
      statusCode,
      duration,
      error,
      metadata,
    } = entry;

    let logMessage = `[${timestamp}] ${level}: ${message}`;

    if (requestId) logMessage += ` | RequestID: ${requestId}`;
    if (userId) logMessage += ` | UserID: ${userId}`;
    if (method && url) logMessage += ` | ${method} ${url}`;
    if (statusCode) logMessage += ` | Status: ${statusCode}`;
    if (duration) logMessage += ` | Duration: ${duration}ms`;

    if (error && this.isDevelopment) {
      if (error instanceof Error) {
        logMessage += `\nError: ${error.message}`;
        if (error.stack) logMessage += `\nStack: ${error.stack}`;
      } else {
        logMessage += `\nError: ${String(error)}`;
      }
    }

    if (metadata && Object.keys(metadata).length > 0) {
      logMessage += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
    }

    return logMessage;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formattedMessage = this.formatLog(entry);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
    }
  }

  error(
    message: string,
    error?: Error | unknown,
    context?: Partial<LogEntry>
  ): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      error,
      ...context,
    });
  }

  warn(message: string, context?: Partial<LogEntry>): void {
    this.log({
      level: LogLevel.WARN,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  info(message: string, context?: Partial<LogEntry>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  debug(message: string, context?: Partial<LogEntry>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  // Log API request
  logRequest(request: NextRequest, context?: RequestContext): void {
    this.info('API Request', {
      requestId: context?.requestId,
      userId: context?.user?.id,
      method: request.method,
      url: request.url,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
      },
    });
  }

  // Log API response
  logResponse(
    request: NextRequest,
    statusCode: number,
    duration: number,
    context?: RequestContext
  ): void {
    const level =
      statusCode >= 500
        ? LogLevel.ERROR
        : statusCode >= 400
          ? LogLevel.WARN
          : LogLevel.INFO;

    this.log({
      level,
      message: 'API Response',
      timestamp: new Date().toISOString(),
      requestId: context?.requestId,
      userId: context?.user?.id,
      method: request.method,
      url: request.url,
      statusCode,
      duration,
    });
  }

  // Log API error
  logError(
    message: string,
    error: Error | unknown,
    request?: NextRequest,
    context?: RequestContext
  ): void {
    this.error(message, error, {
      requestId: context?.requestId,
      userId: context?.user?.id,
      method: request?.method,
      url: request?.url,
    });
  }

  // Log database operation
  logDatabase(
    operation: string,
    table: string,
    duration?: number,
    context?: RequestContext
  ): void {
    this.debug(`Database ${operation}`, {
      requestId: context?.requestId,
      userId: context?.user?.id,
      duration,
      metadata: { table, operation },
    });
  }

  // Log external service call
  logExternalService(
    service: string,
    operation: string,
    duration?: number,
    context?: RequestContext
  ): void {
    this.info(`External Service Call: ${service}`, {
      requestId: context?.requestId,
      userId: context?.user?.id,
      duration,
      metadata: { service, operation },
    });
  }
}

// Export singleton instance
export const logger = new ApiLogger();

// Export utility functions
export const logRequest = (request: NextRequest, context?: RequestContext) => {
  logger.logRequest(request, context);
};

export const logResponse = (
  request: NextRequest,
  statusCode: number,
  duration: number,
  context?: RequestContext
) => {
  logger.logResponse(request, statusCode, duration, context);
};

export const logError = (
  message: string,
  error: Error | unknown,
  request?: NextRequest,
  context?: RequestContext
) => {
  logger.logError(message, error, request, context);
};
