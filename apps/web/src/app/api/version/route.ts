/**
 * Enhanced API Version Information Endpoint
 * Comprehensive version management, migration guides, and compatibility information
 */

import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import {
  getVersionInfo,
  MigrationHelper,
  VERSION_REGISTRY,
  API_VERSIONS,
  ApiVersion,
  getVersionAnalytics,
} from '@/lib/api/versioning';

// GET /api/version - Get comprehensive version information
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'info';
    const versionParam = url.searchParams.get('version');
    if (versionParam && !Object.keys(API_VERSIONS).includes(versionParam)) {
      return createSuccessResponse({ error: 'Unsupported version supplied' });
    }
    const version = versionParam as ApiVersion | undefined;

    switch (action) {
      case 'info':
        return getVersionInfo(version);

      case 'migration':
        return getMigrationInfo(request);

      case 'compatibility':
        return getCompatibilityInfo(request);

      case 'analytics':
        return getVersionAnalyticsInfo(request);

      case 'deprecation':
        return getDeprecationInfo(request);

      default:
        return createSuccessResponse({
          message: 'Enhanced API Version Management',
          availableActions: {
            info: '?action=info&version={version} - Get version information',
            migration:
              '?action=migration&from={version}&to={version} - Get migration guide',
            compatibility:
              '?action=compatibility - Get version compatibility matrix',
            analytics: '?action=analytics - Get version usage analytics',
            deprecation: '?action=deprecation - Get deprecation timeline',
          },
          currentVersion: 'v2',
          supportedVersions: Object.keys(API_VERSIONS),
          endpoints: {
            versionInfo: '/api/version',
            migrationGuide: '/api/version?action=migration',
            compatibility: '/api/version?action=compatibility',
            analytics: '/api/version?action=analytics',
          },
        });
    }
  },
});

// POST /api/version - Enhanced version operations
export const POST = withApiMiddleware(
  {
    POST: async (request: NextRequest) => {
      const body = await request.json();
      const { action, ...params } = body;

      switch (action) {
        case 'validate_migration':
          return validateMigrationRequest(params);

        case 'generate_migration_plan':
          return generateMigrationPlan(params);

        case 'check_compatibility':
          return checkVersionCompatibility(params);

        default:
          return createSuccessResponse({
            message: 'Enhanced version operations',
            availableActions: {
              validate_migration: {
                description: 'Validate migration path between versions',
                payload: {
                  action: 'validate_migration',
                  fromVersion: 'v1',
                  toVersion: 'v2',
                },
              },
              generate_migration_plan: {
                description: 'Generate detailed migration plan',
                payload: {
                  action: 'generate_migration_plan',
                  fromVersion: 'v1',
                  toVersion: 'v2',
                  applicationInfo: 'Optional application details',
                },
              },
              check_compatibility: {
                description: 'Check version compatibility',
                payload: {
                  action: 'check_compatibility',
                  versions: ['v1', 'v2'],
                },
              },
            },
          });
      }
    },
  },
  { requireAuth: true, requireRoles: ['admin', 'manager'] }
);

// Helper functions
async function getMigrationInfo(request: NextRequest) {
  const url = new URL(request.url);
  const fromVersion = url.searchParams.get('from') as ApiVersion;
  const toVersion = url.searchParams.get('to') as ApiVersion;

  if (!fromVersion || !toVersion) {
    return createSuccessResponse({
      error: 'Missing required parameters: from and to versions',
      example: '/api/version?action=migration&from=v1&to=v2',
      availableVersions: Object.keys(API_VERSIONS),
    });
  }

  try {
    const migrationGuide = MigrationHelper.generateMigrationGuide(
      fromVersion,
      toVersion
    );
    const validation = MigrationHelper.validateMigrationPath(
      fromVersion,
      toVersion
    );

    return createSuccessResponse({
      message: `Migration guide from ${fromVersion} to ${toVersion}`,
      migration: {
        ...migrationGuide,
        validation,
        estimatedEffort: getEstimatedEffort(validation.complexity),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return createSuccessResponse({
      error:
        error instanceof Error
          ? error.message
          : 'Migration guide generation failed',
      availableVersions: Object.keys(API_VERSIONS),
    });
  }
}

async function getCompatibilityInfo(_request: NextRequest) {
  const compatibilityMatrix = MigrationHelper.getCompatibilityMatrix();

  return createSuccessResponse({
    message: 'API version compatibility matrix',
    compatibility: {
      matrix: compatibilityMatrix,
      legend: {
        true: 'Compatible - migration supported',
        false: 'Incompatible - migration not recommended',
      },
    },
    versionDetails: Object.entries(VERSION_REGISTRY).map(
      ([version, metadata]) => ({
        version,
        status: metadata.status,
        releaseDate: metadata.releaseDate,
        supportedUntil: metadata.supportedUntil,
      })
    ),
    generatedAt: new Date().toISOString(),
  });
}

async function getVersionAnalyticsInfo(_request: NextRequest) {
  const analytics = getVersionAnalytics();

  return createSuccessResponse({
    message: 'API version usage analytics',
    analytics,
    reportPeriod: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
  });
}

async function getDeprecationInfo(_request: NextRequest) {
  const deprecatedVersions = Object.entries(VERSION_REGISTRY)
    .filter(([, metadata]) => metadata.deprecationDate)
    .map(([version, metadata]) => ({
      version,
      status: metadata.status,
      deprecationDate: metadata.deprecationDate,
      sunsetDate: metadata.sunsetDate,
      supportedUntil: metadata.supportedUntil,
      migrationGuide: metadata.migrationGuide,
    }));

  return createSuccessResponse({
    message: 'API version deprecation timeline',
    deprecation: {
      policy: {
        noticeMinimum: '12 months before sunset',
        supportDuration: 'Minimum 6 months after deprecation',
        migrationSupport: 'Full migration guides and support provided',
      },
      deprecatedVersions,
    },
    generatedAt: new Date().toISOString(),
  });
}

async function validateMigrationRequest(params: any) {
  const { fromVersion, toVersion } = params;

  if (!fromVersion || !toVersion) {
    return createSuccessResponse({
      error: 'Missing required parameters: fromVersion and toVersion',
    });
  }

  const validation = MigrationHelper.validateMigrationPath(
    fromVersion,
    toVersion
  );

  return createSuccessResponse({
    message: 'Migration validation result',
    validation,
    recommendation: validation.valid
      ? 'Migration path is valid and recommended'
      : 'Migration path has issues that need to be addressed',
  });
}

async function generateMigrationPlan(params: any) {
  const { fromVersion, toVersion, applicationInfo } = params;

  if (!fromVersion || !toVersion) {
    return createSuccessResponse({
      error: 'Missing required parameters: fromVersion and toVersion',
    });
  }

  const migrationGuide = MigrationHelper.generateMigrationGuide(
    fromVersion,
    toVersion
  );
  const validation = MigrationHelper.validateMigrationPath(
    fromVersion,
    toVersion
  );

  return createSuccessResponse({
    message: 'Detailed migration plan',
    plan: {
      ...migrationGuide,
      validation,
      estimatedEffort: getEstimatedEffort(validation.complexity),
      applicationSpecific: applicationInfo
        ? 'Custom recommendations would be generated based on application details'
        : 'Provide applicationInfo for custom recommendations',
    },
  });
}

async function checkVersionCompatibility(params: any) {
  const { versions } = params;

  if (!versions || !Array.isArray(versions)) {
    return createSuccessResponse({
      error: 'Missing or invalid versions parameter (should be array)',
    });
  }

  const compatibilityMatrix = MigrationHelper.getCompatibilityMatrix();
  const results: Record<string, any> = {};

  versions.forEach((version: string) => {
    results[version] = {
      supported: Object.keys(API_VERSIONS).includes(version),
      compatibleWith: Object.entries(compatibilityMatrix[version] || {})
        .filter(([, compatible]) => compatible)
        .map(([v]) => v),
    };
  });

  return createSuccessResponse({
    message: 'Version compatibility check',
    results,
  });
}

function getEstimatedEffort(complexity: 'low' | 'medium' | 'high'): string {
  switch (complexity) {
    case 'low':
      return '1-2 days for small teams, 1 week for large applications';
    case 'medium':
      return '1-2 weeks for small teams, 2-4 weeks for large applications';
    case 'high':
      return '2-4 weeks for small teams, 1-3 months for large applications';
    default:
      return 'Effort estimation not available';
  }
}
