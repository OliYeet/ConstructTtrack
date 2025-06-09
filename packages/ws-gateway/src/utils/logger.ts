/**
 * Simple logger utility for WebSocket Gateway
 * Following user preference for simple custom logger over Winston dependency
 */

/* eslint-disable no-console */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logLevel: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    data?: unknown
  ): string {
    const timestamp = new Date().toISOString();

    if (data) {
      try {
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(data)}`;
      } catch (error) {
        return `[${timestamp}] ${level.toUpperCase()}: ${message} [Data serialization failed: ${error.message}]`;
      }
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
}

// Create singleton logger instance
export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || 'info');
