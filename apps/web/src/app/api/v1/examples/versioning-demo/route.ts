/**
 * API Versioning Demo Endpoint
 * Demonstrates version detection and compatibility features
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { extractApiVersion } from '@/lib/api/versioning';

// Demo endpoint that shows version information
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const versionInfo = extractApiVersion(request);
    const apiVersion = (request as any).apiVersion;

    return createSuccessResponse({
      message: 'API Versioning Demo - v1',
      detectedVersion: versionInfo,
      versionContext: apiVersion,
      timestamp: new Date().toISOString(),
      note: 'This endpoint demonstrates how API versioning works',
      versioningMethods: {
        urlPath: 'Preferred: /api/v1/examples/versioning-demo',
        acceptHeader: 'Accept: application/vnd.constructtrack.v1+json',
        versionHeader: 'API-Version: v1',
        queryParameter: '?version=v1',
      },
      responseHeaders: {
        'API-Version': 'Current API version',
        'API-Version-Status': 'Version status (stable, beta, deprecated)',
        'API-Version-Number': 'Semantic version number',
        'API-Warnings': 'Version-related warnings (if any)',
      },
    });
  },
});

// Demo endpoint that shows different behavior based on version
export const POST = withApiMiddleware({
  POST: async (request: NextRequest) => {
    const body = await request.json();
    const apiVersion = (request as any).apiVersion;

    // Version-specific behavior
    const responseData: any = {
      message: 'Version-specific behavior demo',
      version: apiVersion?.version || 'unknown',
      receivedData: body,
      timestamp: new Date().toISOString(),
    };

    // Add version-specific features
    switch (apiVersion?.version) {
      case 'v1':
        responseData.features = [
          'Basic CRUD operations',
          'Authentication',
          'Rate limiting',
          'Security headers',
        ];
        responseData.format = 'v1-standard';
        break;

      case 'v2':
        responseData.features = [
          'All v1 features',
          'GraphQL support',
          'Real-time subscriptions',
          'Advanced caching',
        ];
        responseData.format = 'v2-enhanced';
        responseData.metadata = {
          processingTime: Date.now(),
          apiVersion: '2.0.0-beta',
        };
        break;

      default:
        responseData.features = ['Unknown version'];
        responseData.format = 'fallback';
    }

    return createSuccessResponse(responseData);
  },
});
