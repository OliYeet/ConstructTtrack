/**
 * API Versioning Demo Endpoint - v2
 * Demonstrates enhanced features and breaking changes in v2
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { extractApiVersion } from '@/lib/api/versioning';

// Enhanced v2 endpoint with additional features
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const versionInfo = extractApiVersion(request);
    const apiVersion = (request as any).apiVersion;

    return createSuccessResponse({
      message: 'API Versioning Demo - v2 (Enhanced)',
      detectedVersion: versionInfo,
      versionContext: apiVersion,
      timestamp: new Date().toISOString(),
      note: 'This is the v2 endpoint with enhanced features and different response format',

      // Enhanced v2 features
      metadata: {
        apiVersion: '2.0.0-beta',
        processingTime: Date.now(),
        serverRegion: 'eu-central-1',
        requestId: (request as any).context?.requestId,
      },

      versioningMethods: {
        urlPath: 'Preferred: /api/v2/examples/versioning-demo',
        acceptHeader: 'Accept: application/vnd.constructtrack.v2+json',
        versionHeader: 'API-Version: v2',
        queryParameter: '?version=v2',
      },

      enhancedFeatures: {
        realTimeSupport: true,
        graphqlEndpoint: '/api/v2/graphql',
        subscriptionsEndpoint: '/api/v2/subscriptions',
        advancedCaching: true,
        improvedErrorHandling: true,
      },

      breakingChanges: [
        'Response format includes metadata object',
        'Timestamps are in ISO format with timezone',
        'Error responses have different structure',
        'Authentication flow updated',
      ],

      migrationGuide: '/docs/migration/v1-to-v2',
    });
  },
});

// Enhanced v2 POST endpoint with different response structure
export const POST = withApiMiddleware({
  POST: async (request: NextRequest) => {
    const body = await request.json();
    const apiVersion = (request as any).apiVersion;

    // v2 enhanced response structure
    const responseData = {
      success: true,
      data: {
        message: 'Enhanced v2 processing complete',
        version: apiVersion?.version || 'unknown',
        input: body,
        processed: {
          timestamp: new Date().toISOString(),
          processingTimeMs: Math.random() * 100, // Simulated processing time
          validationPassed: true,
        },
      },
      metadata: {
        apiVersion: '2.0.0-beta',
        requestId: (request as any).context?.requestId,
        processingNode: 'node-eu-1',
        cacheHit: false,
      },
      features: {
        realTimeUpdates: true,
        advancedValidation: true,
        enhancedSecurity: true,
        improvedPerformance: true,
      },
      links: {
        self: `/api/v2/examples/versioning-demo`,
        documentation: '/docs/v2/examples/versioning-demo',
        migration: '/docs/migration/v1-to-v2',
      },
    };

    return createSuccessResponse(responseData);
  },
});
