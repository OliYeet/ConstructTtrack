/**
 * API Versioning Utilities
 *
 * 1. Central location for all version-related constants.
 * 2. Helper to parse the requested version from headers / URL path.
 * 3. Normalisation to a semver-like string so downstream code has a
 *    single canonical representation (`1.0.0`, `2.0.0`, …).
 */

import { NextRequest } from 'next/server';

/** HTTP response/request header that carries the API version. */
export const API_VERSION_HEADER = 'X-API-Version';

/** The platform’s default (and current) public API version. */
export const DEFAULT_API_VERSION = '1.0.0';

/** Change this list when new versions are introduced. */
export const SUPPORTED_API_VERSIONS: ReadonlyArray<string> = [
  DEFAULT_API_VERSION,
];

/**
 * Extract the requested API version from a request.
 *
 * Priority order:
 *   1. Explicit `X-API-Version` header.
 *   2. Path segment `/api/v{n}` (e.g. `/api/v2/users` → `2.0.0`).
 *   3. Fallback to DEFAULT_API_VERSION when parsing fails or an
 *      unsupported version is requested.
 */
export function parseApiVersion(request: NextRequest): string {
  // 1. Header based - highest precedence.
  const headerVersion = normaliseVersion(request.headers.get(API_VERSION_HEADER));
  if (headerVersion && isSupportedVersion(headerVersion)) return headerVersion;

  // 2. URL path based.
  try {
    const { pathname } = new URL(request.url);
    const match = pathname.match(/\/api\/v(\d+)(?:\/|$)/i);
    if (match) {
      const pathVersion = normaliseVersion(match[1]);
      if (pathVersion && isSupportedVersion(pathVersion)) return pathVersion;
    }
  } catch {
    /* ignore – invalid URL means we’ll fall back to default */
  }

  // 3. Fallback.
  return DEFAULT_API_VERSION;
}

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

function isSupportedVersion(version: string): boolean {
  return SUPPORTED_API_VERSIONS.includes(version);
}

/**
 * Convert various version representations (`v1`, `1`, `1.0`) into the
 * canonical semver string (`1.0.0`).
 */
function normaliseVersion(input: string | null): string | undefined {
  if (!input) return undefined;
  const cleaned = input.trim().replace(/^v/i, '');
  const major = cleaned.split('.')[0] || '1';
  return `${major}.0.0`;
}
