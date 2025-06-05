/**
 * API Versioning Strategy
 * Comprehensive versioning system for the ConstructTrack API
 */

import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from './response';

import { BaseApiError } from '@/lib/errors/api-errors';

// Supported API versions
export const API_VERSIONS = {
  v1: '1.0.0',
  v2: '2.0.0-beta',
} as const;

export type ApiVersion = keyof typeof API_VERSIONS;

// Version status
export enum VersionStatus {
  STABLE = 'stable',
  BETA = 'beta',
  DEPRECATED = 'deprecated',
  SUNSET = 'sunset',
}

// Version metadata
export interface VersionMetadata {
  version: string;
  status: VersionStatus;
  releaseDate: string;
  deprecationDate?: string;
  sunsetDate?: string;
  supportedUntil?: string;
  changelog?: string;
  migrationGuide?: string;
  features: string[];
  breakingChanges?: string[];
}

// Version registry
export const VERSION_REGISTRY: Record<ApiVersion, VersionMetadata> = {
  v1: {
    version: '1.0.0',
    status: VersionStatus.STABLE,
    releaseDate: '2024-01-01',
    supportedUntil: '2025-12-31',
    changelog: '/docs/changelog/v1',
    features: [
      'Basic CRUD operations',
      'Authentication & authorization',
      'Rate limiting',
      'Security headers',
      'Request/response logging',
      'API metrics',
    ],
  },
  v2: {
    version: '2.0.0-beta',
    status: VersionStatus.BETA,
    releaseDate: '2024-06-01',
    changelog: '/docs/changelog/v2',
    migrationGuide: '/docs/migration/v1-to-v2',
    features: [
      'All v1 features',
      'GraphQL support',
      'Real-time subscriptions',
      'Advanced caching',
      'Improved error handling',
      'Enhanced metrics',
    ],
    breakingChanges: [
      'Response format changes',
      'Authentication flow updates',
      'Deprecated endpoints removed',
    ],
  },
};

// Extract version from request
export function extractApiVersion(request: NextRequest): {
  version: ApiVersion | string;
  source: 'url' | 'header' | 'query' | 'default';
} {
  const url = new URL(request.url);

  // 1. Check URL path (preferred method)
  const pathMatch = url.pathname.match(/^\/api\/(v\d+)/);
  if (pathMatch) {
    return { version: pathMatch[1] as ApiVersion, source: 'url' };
  }

  // 2. Check Accept header
  const acceptHeader = request.headers.get('accept');
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(
      /application\/vnd\.constructtrack\.(v\d+)\+json/
    );
    if (versionMatch) {
      return { version: versionMatch[1] as ApiVersion, source: 'header' };
    }
  }

  // 3. Check API-Version header
  const versionHeader = request.headers.get('api-version');
  if (versionHeader) {
    return { version: versionHeader as ApiVersion, source: 'header' };
  }

  // 4. Check query parameter
  const versionQuery = url.searchParams.get('version');
  if (versionQuery) {
    return { version: versionQuery as ApiVersion, source: 'query' };
  }

  // 5. Default to v1
  return { version: 'v1', source: 'default' };
}

// Validate version compatibility
export function validateVersion(version: ApiVersion | string): {
  valid: boolean;
  metadata: VersionMetadata;
  warnings: string[];
  errors: string[];
} {
  const metadata = VERSION_REGISTRY[version as ApiVersion];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!metadata) {
    errors.push(`Unsupported API version: ${version}`);
    return { valid: false, metadata: {} as VersionMetadata, warnings, errors };
  }

  const now = new Date();

  // Check if version is deprecated
  if (metadata.deprecationDate && new Date(metadata.deprecationDate) <= now) {
    warnings.push(
      `API version ${version} is deprecated. Please migrate to a newer version.`
    );
  }

  // Check if version is sunset
  if (metadata.sunsetDate && new Date(metadata.sunsetDate) <= now) {
    errors.push(
      `API version ${version} has been sunset and is no longer supported.`
    );
    return { valid: false, metadata, warnings, errors };
  }

  // Check if version is in beta
  if (metadata.status === VersionStatus.BETA) {
    warnings.push(
      `API version ${version} is in beta. Features may change without notice.`
    );
  }

  return { valid: true, metadata, warnings, errors };
}

// Add version headers to response
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion,
  metadata: VersionMetadata
): NextResponse {
  response.headers.set('API-Version', version);
  response.headers.set('API-Version-Status', metadata.status);
  response.headers.set('API-Version-Number', metadata.version);

  if (metadata.deprecationDate) {
    response.headers.set('API-Deprecation-Date', metadata.deprecationDate);
  }

  if (metadata.sunsetDate) {
    response.headers.set('API-Sunset-Date', metadata.sunsetDate);
  }

  if (metadata.migrationGuide) {
    response.headers.set('API-Migration-Guide', metadata.migrationGuide);
  }

  return response;
}

// Version compatibility middleware
export function withVersioning() {
  return async function versioningMiddleware(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const { version, source } = extractApiVersion(request);
    const validation = validateVersion(version);

    // If version is invalid, return error
    if (!validation.valid) {
      return createErrorResponse(
        new BaseApiError(
          validation.errors.join('; '),
          400,
          'UNSUPPORTED_API_VERSION'
        )
      );
    }

    // Add version context to request
    (request as any).apiVersion = {
      version,
      source,
      metadata: validation.metadata,
      warnings: validation.warnings,
    };

    const response = await next();

    // Add version headers to response
    addVersionHeaders(response, version, validation.metadata);

    // Add warnings if any
    if (validation.warnings.length > 0) {
      response.headers.set('API-Warnings', validation.warnings.join('; '));
    }

    return response;
  };
}

// Get version information endpoint
export function getVersionInfo(version?: ApiVersion) {
  const versions = version
    ? [version]
    : (Object.keys(API_VERSIONS) as ApiVersion[]);

  return createSuccessResponse({
    supportedVersions: versions.map(v => ({
      version: v,
      ...VERSION_REGISTRY[v],
      current: v === 'v1', // Current stable version
      endpoints: {
        base: `/api/${v}`,
        docs: `/docs/${v}`,
        changelog: VERSION_REGISTRY[v].changelog,
        migrationGuide: VERSION_REGISTRY[v].migrationGuide,
      },
    })),
    versioningStrategy: {
      method:
        'URL path (preferred), Accept header, API-Version header, query parameter',
      deprecationPolicy: 'Minimum 12 months notice before sunset',
      supportPolicy: 'Latest 2 major versions supported',
    },
    examples: {
      urlPath: '/api/v1/projects',
      acceptHeader: 'Accept: application/vnd.constructtrack.v1+json',
      versionHeader: 'API-Version: v1',
      queryParameter: '/api/projects?version=v1',
    },
  });
}

// Enhanced migration utilities
export class MigrationHelper {
  static generateMigrationGuide(
    fromVersion: ApiVersion,
    toVersion: ApiVersion
  ): {
    guide: string;
    breakingChanges: string[];
    steps: string[];
    examples: Record<string, any>;
    timeline: string;
  } {
    const fromMetadata = VERSION_REGISTRY[fromVersion];
    const toMetadata = VERSION_REGISTRY[toVersion];

    if (!fromMetadata || !toMetadata) {
      throw new Error('Invalid version specified for migration');
    }

    const breakingChanges = toMetadata.breakingChanges || [];

    const steps = [
      `Update API version in your requests to: ${toVersion}`,
      'Review breaking changes listed below',
      'Update request/response handling as needed',
      'Test thoroughly in staging environment',
      'Monitor error rates after deployment',
      'Update documentation and client SDKs',
    ];

    const examples = {
      urlPath: {
        old: `/api/${fromVersion}/projects`,
        new: `/api/${toVersion}/projects`,
      },
      acceptHeader: {
        old: `Accept: application/vnd.constructtrack.${fromVersion}+json`,
        new: `Accept: application/vnd.constructtrack.${toVersion}+json`,
      },
      versionHeader: {
        old: `API-Version: ${fromVersion}`,
        new: `API-Version: ${toVersion}`,
      },
    };

    const timeline = fromMetadata.supportedUntil
      ? `Migration should be completed before ${fromMetadata.supportedUntil}`
      : 'No specific timeline - migrate at your convenience';

    return {
      guide: `Migration from API ${fromVersion} to ${toVersion}`,
      breakingChanges,
      steps,
      examples,
      timeline,
    };
  }

  static validateMigrationPath(
    fromVersion: ApiVersion,
    toVersion: ApiVersion
  ): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
    complexity: 'low' | 'medium' | 'high';
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const fromMetadata = VERSION_REGISTRY[fromVersion];
    const toMetadata = VERSION_REGISTRY[toVersion];

    if (!fromMetadata) {
      issues.push(`Source version ${fromVersion} not found`);
    }

    if (!toMetadata) {
      issues.push(`Target version ${toVersion} not found`);
    }

    if (fromMetadata?.status === VersionStatus.SUNSET) {
      issues.push(
        `Source version ${fromVersion} is sunset and no longer supported`
      );
    }

    if (toMetadata?.status === VersionStatus.DEPRECATED) {
      recommendations.push(
        `Target version ${toVersion} is deprecated. Consider migrating to a newer version.`
      );
    }

    if (toMetadata?.status === VersionStatus.BETA) {
      recommendations.push(
        `Target version ${toVersion} is in beta. Consider waiting for stable release.`
      );
    }

    // Determine complexity based on breaking changes
    const breakingChanges = toMetadata?.breakingChanges?.length || 0;
    let complexity: 'low' | 'medium' | 'high' = 'low';

    if (breakingChanges > 5) {
      complexity = 'high';
    } else if (breakingChanges > 2) {
      complexity = 'medium';
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
      complexity,
    };
  }

  static getCompatibilityMatrix(): Record<string, Record<string, boolean>> {
    const versions = Object.keys(VERSION_REGISTRY) as ApiVersion[];
    const matrix: Record<string, Record<string, boolean>> = {};

    versions.forEach(from => {
      matrix[from] = {};
      versions.forEach(to => {
        // Simple compatibility logic - can be enhanced
        matrix[from][to] = VERSION_REGISTRY[to].status !== VersionStatus.SUNSET;
      });
    });

    return matrix;
  }
}

// Version migration helper
export function createMigrationResponse(
  fromVersion: ApiVersion,
  toVersion: ApiVersion,
  data: any
) {
  const fromMetadata = VERSION_REGISTRY[fromVersion];
  const toMetadata = VERSION_REGISTRY[toVersion];

  return createSuccessResponse({
    data,
    migration: {
      from: {
        version: fromVersion,
        status: fromMetadata.status,
      },
      to: {
        version: toVersion,
        status: toMetadata.status,
      },
      guide: toMetadata.migrationGuide,
      breakingChanges: toMetadata.breakingChanges || [],
    },
  });
}

// Enhanced version middleware with metrics
export function withEnhancedVersioning() {
  return async function enhancedVersioningMiddleware(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const { version, source } = extractApiVersion(request);
    const validation = validateVersion(version);

    // Track version usage metrics
    const versionMetrics = {
      version,
      source,
      timestamp: Date.now(),
      userAgent: request.headers.get('user-agent'),
      endpoint: new URL(request.url).pathname,
    };

    // Log version usage for analytics
    console.log('API Version Usage:', versionMetrics);

    // If version is invalid, return error
    if (!validation.valid) {
      return createErrorResponse(
        new BaseApiError(
          validation.errors.join('; '),
          400,
          'UNSUPPORTED_API_VERSION'
        )
      );
    }

    // Add version context to request
    (request as any).apiVersion = {
      version,
      source,
      metadata: validation.metadata,
      warnings: validation.warnings,
    };

    const response = await next();

    // Add enhanced version headers
    addVersionHeaders(response, version, validation.metadata);

    // Add warnings if any
    if (validation.warnings.length > 0) {
      response.headers.set('API-Warnings', validation.warnings.join('; '));
    }

    // Add supported versions header
    response.headers.set(
      'API-Supported-Versions',
      Object.keys(API_VERSIONS).join(', ')
    );

    return response;
  };
}

// Version analytics
export interface VersionAnalytics {
  totalRequests: number;
  versionDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
  deprecatedVersionUsage: number;
  migrationCandidates: string[];
}

export function getVersionAnalytics(): VersionAnalytics {
  // This would typically pull from a metrics store
  // For now, return mock data structure
  return {
    totalRequests: 0,
    versionDistribution: {},
    sourceDistribution: {},
    deprecatedVersionUsage: 0,
    migrationCandidates: [],
  };
}
