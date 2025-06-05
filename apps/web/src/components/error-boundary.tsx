/**
 * React Error Boundary
 * Catches and handles React component errors gracefully
 */

'use client';

import * as Sentry from '@sentry/nextjs';
import React, { Component, ErrorInfo, ReactNode } from 'react';

import { getLogger } from '@/lib/logging';

// Error boundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

// Error boundary props
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'section';
}

// Error boundary component
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to Sentry with React context
    Sentry.withScope(scope => {
      scope.setTags({
        component: 'error-boundary',
        level: this.props.level || 'component',
        error_id: this.state.errorId,
      });

      scope.setContext('react_error_info', {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: this.props.level || 'component',
      });

      scope.setContext('browser_info', {
        userAgent:
          typeof window !== 'undefined'
            ? window.navigator.userAgent
            : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
      });

      Sentry.captureException(error);
    });

    // Log error to our enhanced logging system
    const logger = getLogger();

    logger.error('React Error Boundary caught error', error, {
      correlationId: this.state.errorId,
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: this.props.level || 'component',
        userAgent:
          typeof window !== 'undefined'
            ? window.navigator.userAgent
            : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
      },
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      return this.renderDefaultErrorUI();
    }

    return this.props.children;
  }

  private renderDefaultErrorUI() {
    const { level = 'component', showDetails = false } = this.props;
    const { error, errorId } = this.state;

    // Page-level error (full page)
    if (level === 'page') {
      return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50'>
          <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6'>
            <div className='flex items-center mb-4'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-8 w-8 text-red-500'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-lg font-medium text-gray-900'>
                  Something went wrong
                </h3>
              </div>
            </div>

            <p className='text-sm text-gray-600 mb-4'>
              We&apos;re sorry, but something unexpected happened. Please try
              refreshing the page.
            </p>

            {showDetails && error && (
              <div className='mb-4 p-3 bg-gray-100 rounded text-xs text-gray-700'>
                <strong>Error:</strong> {error.message}
                {errorId && (
                  <div className='mt-1'>
                    <strong>Error ID:</strong> {errorId}
                  </div>
                )}
              </div>
            )}

            <div className='flex space-x-3'>
              <button
                onClick={this.handleRetry}
                className='flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className='flex-1 bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Section-level error
    if (level === 'section') {
      return (
        <div className='bg-red-50 border border-red-200 rounded-md p-4'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-red-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>
                Section Error
              </h3>
              <div className='mt-2 text-sm text-red-700'>
                <p>This section couldn&apos;t load properly.</p>
              </div>
              <div className='mt-3'>
                <button
                  onClick={this.handleRetry}
                  className='bg-red-100 text-red-800 px-3 py-1 rounded text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500'
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Component-level error (default)
    return (
      <div className='bg-yellow-50 border border-yellow-200 rounded p-3'>
        <div className='flex'>
          <div className='flex-shrink-0'>
            <svg
              className='h-4 w-4 text-yellow-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
          </div>
          <div className='ml-2'>
            <p className='text-sm text-yellow-800'>Component failed to load</p>
            <button
              onClick={this.handleRetry}
              className='mt-1 text-xs text-yellow-600 underline hover:text-yellow-800'
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

// Hook for error boundary context
export function useErrorHandler() {
  const handleError = React.useCallback(
    (error: Error, errorInfo?: React.ErrorInfo) => {
      const logger = getLogger();

      logger.error('Manual error report', error, {
        metadata: {
          source: 'useErrorHandler',
          errorInfo,
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          timestamp: new Date().toISOString(),
        },
      });
    },
    []
  );

  return { handleError };
}

// Async error boundary for handling promise rejections
export class AsyncErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidMount() {
    // Handle unhandled promise rejections
    window.addEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection
    );
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    const logger = getLogger();
    logger.error('Unhandled Promise Rejection', error, {
      metadata: {
        source: 'AsyncErrorBoundary',
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });

    // Prevent the default browser behavior
    event.preventDefault();
  };

  render() {
    return this.props.children;
  }
}
