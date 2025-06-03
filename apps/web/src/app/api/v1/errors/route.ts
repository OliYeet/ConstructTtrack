/**
 * Error Reporting API Endpoint
 * Provides access to error tracking and reporting data
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/middleware';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/response';
import { BaseApiError } from '@/lib/errors/api-errors';
import { errorReporter } from '@/lib/errors/error-reporter';
import { globalErrorHandler } from '@/lib/errors/global-handler';

// GET /api/v1/errors - Get error reports and statistics
export const GET = withApiHandler({
  GET: async (request: NextRequest) => {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'summary';
  const timeframe = url.searchParams.get('timeframe') || '24h';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    let response: Record<string, unknown> = {};

    switch (type) {
      case 'summary':
        response = {
          stats: errorReporter.getStats(),
          globalStats: globalErrorHandler.getErrorStats(),
          timestamp: new Date().toISOString(),
        };
        break;

      case 'aggregated':
        const aggregated = errorReporter.getAggregatedErrors();
        response = {
          errors: aggregated.slice(0, limit),
          total: aggregated.length,
          stats: errorReporter.getStats(),
        };
        break;

      case 'recent':
        // Parse timeframe to hours
        const hours = parseTimeframeToHours(timeframe);
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        
        const allErrors = errorReporter.getAggregatedErrors();
        const recentErrors = allErrors.filter(
          error => new Date(error.lastSeen).getTime() > cutoff
        );

        response = {
          errors: recentErrors.slice(0, limit),
          total: recentErrors.length,
          timeframe,
          cutoff: new Date(cutoff).toISOString(),
        };
        break;

      case 'trends':
        response = getErrorTrends(timeframe);
        break;

      case 'details':
        const fingerprint = url.searchParams.get('fingerprint');
        if (!fingerprint) {
          return createErrorResponse(
            new BaseApiError('Fingerprint parameter required for details view', 400, 'VALIDATION_ERROR'),
            'unknown'
          );
        }

        const errorDetails = errorReporter.getAggregatedErrors().find(
          error => error.fingerprint === fingerprint
        );

        if (!errorDetails) {
          return createErrorResponse(
            new BaseApiError('Error not found', 404, 'NOT_FOUND'),
            'unknown'
          );
        }

        response = {
          error: errorDetails,
          relatedErrors: errorReporter.getAggregatedErrors()
            .filter(e => e.classification.type === errorDetails.classification.type)
            .slice(0, 5),
        };
        break;

      default:
        return createErrorResponse(
          new BaseApiError('Invalid type parameter', 400, 'VALIDATION_ERROR'),
          'unknown'
        );
    }

    return createSuccessResponse(response);
  } catch {
    return createErrorResponse(
      new BaseApiError('Failed to retrieve error data', 500, 'INTERNAL_ERROR'),
      'unknown'
    );
  }
  }
});

// POST /api/v1/errors - Report a new error
export const POST = withApiHandler({
  POST: async (request: NextRequest) => {
  try {
    const body = await request.json();
    
    const {
      title,
      description,
      error,
      context,
      classification,
    } = body;

    // Validate required fields
    if (!title || !description || !error) {
      return createErrorResponse(
        new BaseApiError('Missing required fields: title, description, error', 400, 'VALIDATION_ERROR'),
        'unknown'
      );
    }

    // Create Error object
    const errorObj = new Error(error.message || description);
    errorObj.name = error.name || 'Error';
    errorObj.stack = error.stack;

    // Report the error
    const reportId = await errorReporter.reportError(
      errorObj,
      {
        source: context?.source || 'api',
        url: context?.url,
        userAgent: context?.userAgent,
        userId: context?.userId,
        sessionId: context?.sessionId,
        additionalData: context?.additionalData,
      },
      classification || {
        type: 'unknown',
        severity: 'medium',
        category: 'general',
        recoverable: false,
      }
    );

    return createSuccessResponse({
      message: 'Error reported successfully',
      reportId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return createErrorResponse(
      new BaseApiError('Failed to report error', 500, 'INTERNAL_ERROR'),
      'unknown'
    );
  }
  }
});

// PATCH /api/v1/errors - Update error status
export const PATCH = withApiHandler({
  PATCH: async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { fingerprint, action } = body;

    if (!fingerprint) {
      return createErrorResponse(
        new BaseApiError('Fingerprint required in request body', 400, 'VALIDATION_ERROR'),
        'unknown'
      );
    }

    switch (action) {
      case 'resolve':
        errorReporter.markResolved(fingerprint);
        return createSuccessResponse({
          message: 'Error marked as resolved',
          fingerprint,
          timestamp: new Date().toISOString(),
        });

      default:
        return createErrorResponse(
          new BaseApiError('Invalid action', 400, 'VALIDATION_ERROR'),
          'unknown'
        );
    }
  } catch {
    return createErrorResponse(
      new BaseApiError('Failed to update error', 500, 'INTERNAL_ERROR'),
      'unknown'
    );
  }
  }
});

// Helper function to parse timeframe to hours
function parseTimeframeToHours(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 24; // Default to 24 hours
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value / 3600;
    case 'm':
      return value / 60;
    case 'h':
      return value;
    case 'd':
      return value * 24;
    default:
      return 24;
  }
}

// Get error trends
function getErrorTrends(timeframe: string) {
  const hours = parseTimeframeToHours(timeframe);
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  
  const allErrors = errorReporter.getAggregatedErrors();
  const recentErrors = allErrors.filter(
    error => new Date(error.lastSeen).getTime() > cutoff
  );

  // Group errors by hour
  const hourlyData: Record<string, { count: number; types: Record<string, number> }> = {};
  
  recentErrors.forEach(error => {
    const hour = new Date(error.lastSeen).toISOString().substring(0, 13);
    
    if (!hourlyData[hour]) {
      hourlyData[hour] = { count: 0, types: {} };
    }
    
    hourlyData[hour].count += error.count;
    hourlyData[hour].types[error.classification.type] = 
      (hourlyData[hour].types[error.classification.type] || 0) + error.count;
  });

  // Convert to array and sort by time
  const trends = Object.entries(hourlyData)
    .map(([hour, data]) => ({
      timestamp: hour + ':00:00.000Z',
      count: data.count,
      types: data.types,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Calculate error rate trends
  const errorsByType: Record<string, number> = {};
  const errorsBySeverity: Record<string, number> = {};

  recentErrors.forEach(error => {
    errorsByType[error.classification.type] = 
      (errorsByType[error.classification.type] || 0) + error.count;
    errorsBySeverity[error.classification.severity] = 
      (errorsBySeverity[error.classification.severity] || 0) + error.count;
  });

  return {
    timeframe,
    trends,
    summary: {
      totalErrors: recentErrors.reduce((sum, error) => sum + error.count, 0),
      uniqueErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
      topErrors: recentErrors
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(error => ({
          fingerprint: error.fingerprint,
          message: error.sampleError.error.message,
          count: error.count,
          type: error.classification.type,
          severity: error.classification.severity,
        })),
    },
  };
}
