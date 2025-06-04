/**
 * Test Sentry Integration API Route
 * Provides endpoints to test different types of errors and Sentry reporting
 */

import * as Sentry from '@sentry/nextjs';

import { NextRequest, NextResponse } from 'next/server';
import { ErrorSeverity } from '@/lib/errors/global-handler';
import { errorReporter } from '@/lib/errors/error-reporter';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const errorType = searchParams.get('type') || 'basic';

  try {
    switch (errorType) {
      case 'basic':
        throw new Error('Test error for Sentry integration');

      case 'async':
        await new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Async test error')), 100);
        });
        break;

      case 'custom': {
        // Test custom error reporting through our ErrorReporter
        const customError = new Error('Custom error through ErrorReporter');
        await errorReporter.reportError(
          customError,
          {
            source: 'test-api',
            url: request.url,
            userAgent: request.headers.get('user-agent') || undefined,
            additionalData: {
              testType: 'custom',
              timestamp: new Date().toISOString(),
            },
          },
          {
            type: 'api',
            severity: ErrorSeverity.MEDIUM,
            category: 'api',
            recoverable: true,
          }
        );
        break;
      }

      case 'sentry-direct':
        // Test direct Sentry reporting
        Sentry.withScope((scope) => {
          scope.setTags({
            test_type: 'direct',
            component: 'test-api',
          });
          scope.setContext('test_info', {
            endpoint: '/api/test-sentry',
            method: 'GET',
            timestamp: new Date().toISOString(),
          });
          Sentry.captureException(new Error('Direct Sentry test error'));
        });
        break;

      case 'performance': {
        // Test performance monitoring using current Sentry API
        await Sentry.startSpan(
          {
            name: 'test-performance',
            op: 'test'
          },
          async (span) => {
            // Simulate some work
            await Sentry.startSpan(
              {
                op: 'test-operation',
                description: 'Testing performance monitoring'
              },
              async () => {
                // Simulate async work
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            );
          }
        );
        break;
      }

      case 'user-feedback': {
        // Test user feedback
        const eventId = Sentry.captureException(new Error('Error with user feedback'));
        
        // Simulate user feedback
        Sentry.captureUserFeedback({
          event_id: eventId,
          name: 'Test User',
          email: 'test@constructtrack.com',
          comments: 'This is a test error for Sentry integration',
        });
        break;
      }

      default:
        return NextResponse.json(
          { 
            error: 'Invalid error type',
            availableTypes: ['basic', 'async', 'custom', 'sentry-direct', 'performance', 'user-feedback']
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Test error of type '${errorType}' triggered successfully`,
      timestamp: new Date().toISOString(),
      note: 'Check your Sentry dashboard for the error report',
    });

  } catch (error) {
    // This catch block will handle the thrown test errors
    return NextResponse.json({
      message: `Test error of type '${errorType}' was caught and should be reported to Sentry`,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, level = 'error', tags = {}, context = {} } = body;

    // Custom error reporting with provided data
    Sentry.withScope((scope) => {
      scope.setLevel(level as Sentry.SeverityLevel);
      scope.setTags({
        component: 'test-api',
        method: 'POST',
        ...tags,
      });
      scope.setContext('custom_test', {
        endpoint: '/api/test-sentry',
        timestamp: new Date().toISOString(),
        ...context,
      });

      if (message) {
        Sentry.captureException(new Error(message));
      } else {
        Sentry.captureMessage('Custom test message', level as Sentry.SeverityLevel);
      }
    });

    return NextResponse.json({
      message: 'Custom error/message sent to Sentry',
      data: { message, level, tags, context },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process custom error test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
