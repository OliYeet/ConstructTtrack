/**
 * Error Handling Hook
 * React hook for consistent error handling across components
 */

'use client';

import { useCallback, useState, useEffect } from 'react';

import { errorReporter } from '@/lib/errors/error-reporter';
import { ErrorSeverity } from '@/lib/errors/global-handler';
import { getLogger } from '@/lib/logging';

// Error state interface
export interface ErrorState {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  isRecoverable: boolean;
  retryCount: number;
}

// Error handler options
export interface ErrorHandlerOptions {
  maxRetries?: number;
  enableAutoRecovery?: boolean;
  enableReporting?: boolean;
  context?: Record<string, unknown>;
}

// Error handler hook
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    maxRetries = 3,
    enableAutoRecovery = true,
    enableReporting = true,
    context = {},
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    isRecoverable: false,
    retryCount: 0,
  });

  // Handle error function
  const handleError = useCallback(
    async (error: Error, additionalContext?: Record<string, unknown>) => {
      const errorId = `err_${Date.now()}_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)}`;

      // Classify error
      const isRecoverable = isErrorRecoverable(error);

      // Update error state
      setErrorState(prev => ({
        hasError: true,
        error,
        errorId,
        isRecoverable,
        retryCount: prev.retryCount,
      }));

      // Report error if enabled
      if (enableReporting) {
        try {
          await errorReporter.reportError(
            error,
            {
              source: 'useErrorHandler',
              url:
                typeof window !== 'undefined'
                  ? window.location.href
                  : undefined,
              userAgent:
                typeof window !== 'undefined' ? navigator.userAgent : undefined,
              additionalData: {
                ...context,
                ...additionalContext,
                errorId,
                retryCount: errorState.retryCount,
              },
            },
            {
              type: classifyErrorType(error),
              severity: classifyErrorSeverity(error),
              category: 'component',
              recoverable: isRecoverable,
            }
          );
        } catch (reportingError) {
          console.warn('Failed to report error:', reportingError);
        }
      }

      // Log error
      const logger = getLogger();
      await logger.error('Component error handled', error, {
        metadata: {
          errorId,
          isRecoverable,
          retryCount: errorState.retryCount,
          context: { ...context, ...additionalContext },
        },
      });
    },
    [context, enableReporting, errorState.retryCount]
  );

  // Retry function
  const retry = useCallback(async () => {
    if (errorState.retryCount >= maxRetries) {
      const logger = getLogger();
      await logger.warn('Max retries exceeded', {
        metadata: {
          errorId: errorState.errorId,
          maxRetries,
          retryCount: errorState.retryCount,
        },
      });
      return false;
    }

    setErrorState(prev => ({
      ...prev,
      hasError: false,
      error: undefined,
      retryCount: prev.retryCount + 1,
    }));

    const logger = getLogger();
    await logger.info('Error recovery attempted', {
      metadata: {
        errorId: errorState.errorId,
        retryCount: errorState.retryCount + 1,
      },
    });

    return true;
  }, [errorState.errorId, errorState.retryCount, maxRetries]);

  // Clear error function
  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      isRecoverable: false,
      retryCount: 0,
    });
  }, []);

  // Reset retry count
  const resetRetries = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      retryCount: 0,
    }));
  }, []);

  // Auto-recovery effect
  useEffect(() => {
    if (enableAutoRecovery && errorState.hasError && errorState.isRecoverable) {
      const timer = setTimeout(() => {
        retry();
      }, 2000); // Auto-retry after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [
    enableAutoRecovery,
    errorState.hasError,
    errorState.isRecoverable,
    retry,
  ]);

  return {
    errorState,
    handleError,
    retry,
    clearError,
    resetRetries,
    canRetry: errorState.retryCount < maxRetries,
    isMaxRetriesReached: errorState.retryCount >= maxRetries,
  };
}

// Async operation error handler hook
export function useAsyncErrorHandler(options: ErrorHandlerOptions = {}) {
  const { handleError, ...errorHandler } = useErrorHandler(options);
  const [isLoading, setIsLoading] = useState(false);

  // Wrap async function with error handling
  const executeAsync = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      context?: Record<string, unknown>
    ): Promise<T | null> => {
      setIsLoading(true);

      try {
        const result = await asyncFn();
        setIsLoading(false);
        return result;
      } catch (error) {
        setIsLoading(false);
        await handleError(
          error instanceof Error ? error : new Error(String(error)),
          context
        );
        return null;
      }
    },
    [handleError]
  );

  return {
    ...errorHandler,
    executeAsync,
    isLoading,
  };
}

// Form error handler hook
export function useFormErrorHandler(options: ErrorHandlerOptions = {}) {
  const { handleError, ...errorHandler } = useErrorHandler(options);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Handle form validation errors
  const handleFormError = useCallback(
    async (error: Error, field?: string, context?: Record<string, unknown>) => {
      if (field && isValidationError(error)) {
        setFieldErrors(prev => ({
          ...prev,
          [field]: error.message,
        }));
      } else {
        await handleError(error, context);
      }
    },
    [handleError]
  );

  // Clear field error
  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Clear all field errors
  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    ...errorHandler,
    fieldErrors,
    handleFormError,
    clearFieldError,
    clearAllFieldErrors,
    hasFieldErrors: Object.keys(fieldErrors).length > 0,
  };
}

// Utility functions
function isErrorRecoverable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Check error name first for more accurate classification
  if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
    return true;
  }

  // Check for specific error codes if available
  if ('code' in error) {
    const errorCode = (error as any).code;
    // Network-related error codes
    if (
      ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(
        errorCode
      )
    ) {
      return true;
    }
  }

  // Network errors are usually recoverable
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout')
  ) {
    return true;
  }

  // Validation errors are recoverable
  if (message.includes('validation') || message.includes('invalid')) {
    return true;
  }

  // API errors might be recoverable
  if (message.includes('api') || /\b(4\d{2}|5\d{2})\b/.test(message)) {
    return true;
  }

  // JavaScript runtime errors are usually not recoverable
  return false;
}

function classifyErrorType(
  error: Error
): 'javascript' | 'network' | 'api' | 'validation' | 'security' | 'unknown' {
  const message = error.message.toLowerCase();

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('connection')
  ) {
    return 'network';
  }

  if (message.includes('api') || message.includes('http')) {
    return 'api';
  }

  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return 'validation';
  }

  if (
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return 'security';
  }

  if (
    error.name === 'TypeError' ||
    error.name === 'ReferenceError' ||
    error.name === 'SyntaxError'
  ) {
    return 'javascript';
  }

  return 'unknown';
}

function classifyErrorSeverity(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase();

  // Critical errors
  if (
    message.includes('cannot read property') ||
    message.includes('undefined is not a function') ||
    error.name === 'ReferenceError'
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (
    message.includes('permission') ||
    message.includes('unauthorized') ||
    error.name === 'TypeError'
  ) {
    return ErrorSeverity.HIGH;
  }

  // Low severity errors
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorSeverity.LOW;
  }

  // Default to medium
  return ErrorSeverity.MEDIUM;
}

function isValidationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('expected')
  );
}
