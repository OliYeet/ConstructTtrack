/**
 * Global Error Handler
 * Centralized error handling for unhandled errors and promise rejections
 */

import { getLogger } from '@/lib/logging';

// Error context interface
export interface ErrorContext {
  source: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  additionalData?: Record<string, unknown>;
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error classification
export interface ErrorClassification {
  type: 'javascript' | 'network' | 'api' | 'validation' | 'security' | 'unknown';
  severity: ErrorSeverity;
  category: string;
  recoverable: boolean;
}

// Global error handler class
export class GlobalErrorHandler {
  private isInitialized = false;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private maxQueueSize = 100;
  private userId?: string;
  private sessionId?: string;

  // Initialize global error handling
  initialize(options?: {
    userId?: string;
    sessionId?: string;
    maxQueueSize?: number;
  }): void {
    if (this.isInitialized) {
      return;
    }

    this.userId = options?.userId;
    this.sessionId = options?.sessionId;
    this.maxQueueSize = options?.maxQueueSize || 100;

    // Handle uncaught JavaScript errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleWindowError);
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    // Handle Node.js uncaught exceptions (server-side)
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', this.handleUncaughtException);
      process.on('unhandledRejection', this.handleUnhandledRejection);
    }

    this.isInitialized = true;
  }

  // Clean up event listeners
  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.handleWindowError);
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    if (typeof process !== 'undefined') {
      process.off('uncaughtException', this.handleUncaughtException);
      process.off('unhandledRejection', this.handleUnhandledRejection);
    }

    this.isInitialized = false;
  }

  // Handle window errors
  private handleWindowError = (event: ErrorEvent): void => {
    const error = event.error || new Error(event.message);
    const context: ErrorContext = {
      source: 'window.error',
      url: event.filename || window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      additionalData: {
        lineno: event.lineno,
        colno: event.colno,
        message: event.message,
      },
    };

    this.handleError(error, context);
  };

  // Handle unhandled promise rejections
  private handleUnhandledRejection = (event: PromiseRejectionEvent | any): void => {
    const error = event.reason instanceof Error ? 
      event.reason : 
      new Error(String(event.reason));

    const context: ErrorContext = {
      source: 'unhandledRejection',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      additionalData: {
        reason: event.reason,
      },
    };

    this.handleError(error, context);

    // Prevent default browser behavior
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  // Handle uncaught exceptions (Node.js)
  private handleUncaughtException = (error: Error): void => {
    const context: ErrorContext = {
      source: 'uncaughtException',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    this.handleError(error, context);
  };

  // Main error handling method
  private async handleError(error: Error, context: ErrorContext): Promise<void> {
    try {
      // Classify the error
      const classification = this.classifyError(error, context);
      
      // Add to queue if it's full, remove oldest
      if (this.errorQueue.length >= this.maxQueueSize) {
        this.errorQueue.shift();
      }
      this.errorQueue.push({ error, context });

      // Log the error
      const logger = getLogger();
      await logger.error('Global error caught', error, {
        metadata: {
          ...context,
          classification,
          queueSize: this.errorQueue.length,
        },
      });

      // Handle critical errors
      if (classification.severity === ErrorSeverity.CRITICAL) {
        await this.handleCriticalError(error, context, classification);
      }

      // Attempt recovery if possible
      if (classification.recoverable) {
        await this.attemptRecovery(error, context, classification);
      }

    } catch (handlingError) {
      // Fallback logging if our error handling fails
      console.error('Error in global error handler:', handlingError);
      console.error('Original error:', error);
    }
  }

  // Classify error type and severity
  private classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (message.includes('fetch') || message.includes('network') || 
        message.includes('connection') || message.includes('timeout')) {
      return {
        type: 'network',
        severity: ErrorSeverity.MEDIUM,
        category: 'connectivity',
        recoverable: true,
      };
    }

    // API errors
    if (message.includes('api') || message.includes('http') || 
        context.source.includes('api')) {
      return {
        type: 'api',
        severity: ErrorSeverity.MEDIUM,
        category: 'backend',
        recoverable: true,
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        message.includes('required')) {
      return {
        type: 'validation',
        severity: ErrorSeverity.LOW,
        category: 'user_input',
        recoverable: true,
      };
    }

    // Security errors
    if (message.includes('permission') || message.includes('unauthorized') ||
        message.includes('forbidden') || message.includes('security')) {
      return {
        type: 'security',
        severity: ErrorSeverity.HIGH,
        category: 'access_control',
        recoverable: false,
      };
    }

    // Critical JavaScript errors
    if (message.includes('cannot read property') || 
        message.includes('undefined is not a function') ||
        stack.includes('typeerror')) {
      return {
        type: 'javascript',
        severity: ErrorSeverity.HIGH,
        category: 'runtime',
        recoverable: false,
      };
    }

    // Default classification
    return {
      type: 'unknown',
      severity: ErrorSeverity.MEDIUM,
      category: 'general',
      recoverable: false,
    };
  }

  // Handle critical errors
  private async handleCriticalError(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification
  ): Promise<void> {
    // Log critical error with high priority
    const logger = getLogger();
    await logger.error('CRITICAL ERROR DETECTED', error, {
      metadata: {
        ...context,
        classification,
        priority: 'CRITICAL',
        requiresImmedateAttention: true,
      },
    });

    // Could trigger alerts, notifications, etc.
    // For now, we'll just ensure it's logged prominently
    console.error('🚨 CRITICAL ERROR:', error.message);
  }

  // Attempt error recovery
  private async attemptRecovery(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification
  ): Promise<void> {
    const logger = getLogger();

    switch (classification.type) {
      case 'network':
        // Could implement retry logic, offline mode, etc.
        await logger.info('Attempting network error recovery', {
          metadata: { ...context, recoveryType: 'network' },
        });
        break;

      case 'api':
        // Could implement API retry, fallback endpoints, etc.
        await logger.info('Attempting API error recovery', {
          metadata: { ...context, recoveryType: 'api' },
        });
        break;

      case 'validation':
        // Could clear invalid data, reset forms, etc.
        await logger.info('Attempting validation error recovery', {
          metadata: { ...context, recoveryType: 'validation' },
        });
        break;

      default:
        await logger.debug('No recovery strategy available', {
          metadata: { ...context, classification },
        });
    }
  }

  // Manual error reporting
  async reportError(
    error: Error,
    additionalContext?: Record<string, unknown>
  ): Promise<void> {
    const context: ErrorContext = {
      source: 'manual_report',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      additionalData: additionalContext,
    };

    await this.handleError(error, context);
  }

  // Get error statistics
  getErrorStats(): {
    totalErrors: number;
    recentErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const recentThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
    const recentErrors = this.errorQueue.filter(
      ({ context }) => new Date(context.timestamp).getTime() > recentThreshold
    );

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    this.errorQueue.forEach(({ error, context }) => {
      const classification = this.classifyError(error, context);
      errorsByType[classification.type] = (errorsByType[classification.type] || 0) + 1;
      errorsBySeverity[classification.severity] = (errorsBySeverity[classification.severity] || 0) + 1;
    });

    return {
      totalErrors: this.errorQueue.length,
      recentErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
    };
  }

  // Update user context
  updateUserContext(userId?: string, sessionId?: string): void {
    this.userId = userId;
    this.sessionId = sessionId;
  }
}

// Global instance
export const globalErrorHandler = new GlobalErrorHandler();

// Initialize on import in browser environment
if (typeof window !== 'undefined') {
  globalErrorHandler.initialize();
}
