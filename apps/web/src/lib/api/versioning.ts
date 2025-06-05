/**
 * API Versioning Utilities
 * Centralized version management for ConstructTrack API
 */

import { NextRequest } from 'next/server';

// API Version Constants
export const DEFAULT_API_VERSION = '1.0.0';
export const SUPPORTED_API_VERSIONS = ['1.0.0'] as const;

export type ApiVersion = typeof SUPPORTED_API_VERSIONS[number];

// Version validation
export function isValidApiVersion(version: string): version is ApiVersion {
  return SUPPORTED_API_VERSIONS.includes(version as ApiVersion);
}

// Parse API version from request
export function parseApiVersion(request: NextRequest): ApiVersion {
  // 1. Check X-API-Version header first
  const headerVersion = request.headers.get('X-API-Version');
  if (headerVersion && isValidApiVersion(headerVersion)) {
    return headerVersion;
  }

  // 2. Check URL path for version (e.g., /api/v1.0.0/ or /api/v1/)
  const pathname = request.nextUrl.pathname;
  const versionMatch = pathname.match(/\/api\/v(\d+(?:\.\d+)?(?:\.\d+)?)\//);
  
  if (versionMatch) {
    const pathVersion = versionMatch[1];
    
    // Handle short versions like "v1" -> "1.0.0"
    let normalizedVersion = pathVersion;
    if (pathVersion === '1') {
      normalizedVersion = '1.0.0';
    } else if (pathVersion.match(/^\d+\.\d+$/)) {
      normalizedVersion = `${pathVersion}.0`;
    }
    
    if (isValidApiVersion(normalizedVersion)) {
      return normalizedVersion;
    }
  }

  // 3. Default to latest supported version
  return DEFAULT_API_VERSION;
}

// Get version-specific configuration
export function getVersionConfig(version: ApiVersion) {
  const configs = {
    '1.0.0': {
      deprecationDate: null,
      supportedUntil: null,
      features: {
        authentication: true,
        rateLimit: true,
        pagination: true,
        errorHandling: 'v1',
      },
    },
  } as const;

  return configs[version];
}

// Check if version is deprecated
export function isVersionDeprecated(version: ApiVersion): boolean {
  const config = getVersionConfig(version);
  if (!config.deprecationDate) return false;
  
  return new Date() > new Date(config.deprecationDate);
}

// Check if version is still supported
export function isVersionSupported(version: ApiVersion): boolean {
  const config = getVersionConfig(version);
  if (!config.supportedUntil) return true;
  
  return new Date() < new Date(config.supportedUntil);
}

// Get deprecation warning message
export function getDeprecationWarning(version: ApiVersion): string | null {
  if (!isVersionDeprecated(version)) return null;
  
  const config = getVersionConfig(version);
  const supportedUntil = config.supportedUntil 
    ? new Date(config.supportedUntil).toISOString().split('T')[0]
    : 'TBD';
    
  return `API version ${version} is deprecated. Please upgrade to version ${DEFAULT_API_VERSION}. Support ends on ${supportedUntil}.`;
}

// Version comparison utilities
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  
  return 0;
}

export function isVersionGreaterThan(version: string, target: string): boolean {
  return compareVersions(version, target) > 0;
}

export function isVersionLessThan(version: string, target: string): boolean {
  return compareVersions(version, target) < 0;
}

