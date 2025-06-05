/**
 * API Versioning Tests
 * Tests for version parsing and validation utilities
 */

import { NextRequest } from 'next/server';
import {
  parseApiVersion,
  isValidApiVersion,
  isVersionSupported,
  getDeprecationWarning,
  compareVersions,
  isVersionGreaterThan,
  isVersionLessThan,
  DEFAULT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from '../versioning';

// Mock NextRequest helper
function createMockRequest(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  const request = new NextRequest(url);
  Object.entries(headers).forEach(([key, value]) => {
    request.headers.set(key, value);
  });
  return request;
}

describe('API Versioning', () => {
  describe('parseApiVersion', () => {
    it('should parse version from X-API-Version header', () => {
      const request = createMockRequest('http://localhost/api/v1/test', {
        'X-API-Version': '1.0.0',
      });
      expect(parseApiVersion(request)).toBe('1.0.0');
    });

    it('should parse version from URL path', () => {
      const request = createMockRequest('http://localhost/api/v1.0.0/test');
      expect(parseApiVersion(request)).toBe('1.0.0');
    });

    it('should normalize short version from URL', () => {
      const request = createMockRequest('http://localhost/api/v1/test');
      expect(parseApiVersion(request)).toBe('1.0.0');
    });

    it('should prioritize header over URL', () => {
      const request = createMockRequest('http://localhost/api/v1/test', {
        'X-API-Version': '1.0.0',
      });
      expect(parseApiVersion(request)).toBe('1.0.0');
    });

    it('should return default version for invalid versions', () => {
      const request = createMockRequest('http://localhost/api/v999/test');
      expect(parseApiVersion(request)).toBe(DEFAULT_API_VERSION);
    });

    it('should return default version when no version specified', () => {
      const request = createMockRequest('http://localhost/api/test');
      expect(parseApiVersion(request)).toBe(DEFAULT_API_VERSION);
    });
  });

  describe('isValidApiVersion', () => {
    it('should validate supported versions', () => {
      expect(isValidApiVersion('1.0.0')).toBe(true);
    });

    it('should reject unsupported versions', () => {
      expect(isValidApiVersion('2.0.0')).toBe(false);
      expect(isValidApiVersion('invalid')).toBe(false);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(isVersionSupported('1.0.0')).toBe(true);
    });
  });

  describe('getDeprecationWarning', () => {
    it('should return null for non-deprecated versions', () => {
      expect(getDeprecationWarning('1.0.0')).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });
  });

  describe('isVersionGreaterThan', () => {
    it('should check if version is greater', () => {
      expect(isVersionGreaterThan('1.1.0', '1.0.0')).toBe(true);
      expect(isVersionGreaterThan('1.0.0', '1.1.0')).toBe(false);
      expect(isVersionGreaterThan('1.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('isVersionLessThan', () => {
    it('should check if version is less', () => {
      expect(isVersionLessThan('1.0.0', '1.1.0')).toBe(true);
      expect(isVersionLessThan('1.1.0', '1.0.0')).toBe(false);
      expect(isVersionLessThan('1.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have valid default version', () => {
      expect(SUPPORTED_API_VERSIONS).toContain(DEFAULT_API_VERSION);
    });

    it('should have at least one supported version', () => {
      expect(SUPPORTED_API_VERSIONS.length).toBeGreaterThan(0);
    });
  });
});

