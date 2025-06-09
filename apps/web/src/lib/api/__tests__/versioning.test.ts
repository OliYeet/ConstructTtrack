/**
 * API Versioning Tests
 * Tests the API versioning strategy and version detection
 */

import { NextRequest } from 'next/server';
import {
  extractApiVersion,
  validateVersion,
  addVersionHeaders,
  withVersioning,
  withEnhancedVersioning,
  MigrationHelper,
  API_VERSIONS,
  VersionStatus,
  ApiVersion,
} from '../versioning';
import { NextResponse } from 'next/server';

describe('API Versioning', () => {
  describe('extractApiVersion', () => {
    it('should extract version from URL path', () => {
      const request = new NextRequest('http://localhost:3000/api/v1/projects');
      const result = extractApiVersion(request);

      expect(result.version).toBe('v1');
      expect(result.source).toBe('url');
    });

    it('should extract version from Accept header', () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        headers: {
          accept: 'application/vnd.constructtrack.v2+json',
        },
      });
      const result = extractApiVersion(request);

      expect(result.version).toBe('v2');
      expect(result.source).toBe('header');
    });

    it('should extract version from API-Version header', () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        headers: {
          'api-version': 'v1',
        },
      });
      const result = extractApiVersion(request);

      expect(result.version).toBe('v1');
      expect(result.source).toBe('header');
    });

    it('should extract version from query parameter', () => {
      const request = new NextRequest(
        'http://localhost:3000/api/projects?version=v2'
      );
      const result = extractApiVersion(request);

      expect(result.version).toBe('v2');
      expect(result.source).toBe('query');
    });

    it('should default to v1 when no version specified', () => {
      const request = new NextRequest('http://localhost:3000/api/projects');
      const result = extractApiVersion(request);

      expect(result.version).toBe('v1');
      expect(result.source).toBe('default');
    });

    it('should prioritize URL path over other methods', () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/projects?version=v2',
        {
          headers: {
            'api-version': 'v2',
            accept: 'application/vnd.constructtrack.v2+json',
          },
        }
      );
      const result = extractApiVersion(request);

      expect(result.version).toBe('v1');
      expect(result.source).toBe('url');
    });
  });

  describe('validateVersion', () => {
    it('should validate supported version', () => {
      const result = validateVersion('v1');

      expect(result.valid).toBe(true);
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe(VersionStatus.STABLE);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for unsupported version', () => {
      const result = validateVersion('v99' as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported API version: v99');
    });

    it('should add warning for beta version', () => {
      const result = validateVersion('v2');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('API version v2 is in beta')
      );
    });
  });

  describe('addVersionHeaders', () => {
    it('should add version headers to response', () => {
      const response = new NextResponse();
      const metadata = {
        version: '1.0.0',
        status: VersionStatus.STABLE,
        releaseDate: '2024-01-01',
        features: [],
      };

      const result = addVersionHeaders(response, 'v1', metadata);

      expect(result.headers.get('API-Version')).toBe('v1');
      expect(result.headers.get('API-Version-Status')).toBe('stable');
      expect(result.headers.get('API-Version-Number')).toBe('1.0.0');
    });

    it('should add deprecation headers when applicable', () => {
      const response = new NextResponse();
      const metadata = {
        version: '1.0.0',
        status: VersionStatus.DEPRECATED,
        releaseDate: '2024-01-01',
        deprecationDate: '2024-12-31',
        sunsetDate: '2025-12-31',
        migrationGuide: '/docs/migration/v1-to-v2',
        features: [],
      };

      const result = addVersionHeaders(response, 'v1', metadata);

      expect(result.headers.get('API-Deprecation-Date')).toBe('2024-12-31');
      expect(result.headers.get('API-Sunset-Date')).toBe('2025-12-31');
      expect(result.headers.get('API-Migration-Guide')).toBe(
        '/docs/migration/v1-to-v2'
      );
    });
  });

  describe('withVersioning middleware', () => {
    it('should add version context to request', async () => {
      const middleware = withVersioning();
      const request = new NextRequest('http://localhost:3000/api/v1/projects');

      const mockNext = jest.fn().mockResolvedValue(new NextResponse());

      await middleware(request, mockNext);

      expect((request as any).apiVersion).toBeDefined();
      expect((request as any).apiVersion.version).toBe('v1');
      expect((request as any).apiVersion.source).toBe('url');
    });

    it('should return error for unsupported version', async () => {
      const middleware = withVersioning();
      const request = new NextRequest('http://localhost:3000/api/projects', {
        headers: {
          'api-version': 'v99',
        },
      });

      const mockNext = jest.fn().mockResolvedValue(new NextResponse());

      const response = await middleware(request, mockNext);

      expect(response.status).toBe(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should add version headers to response', async () => {
      const middleware = withVersioning();
      const request = new NextRequest('http://localhost:3000/api/v1/projects');

      const mockResponse = new NextResponse();
      const mockNext = jest.fn().mockResolvedValue(mockResponse);

      const response = await middleware(request, mockNext);

      expect(response.headers.get('API-Version')).toBe('v1');
      expect(response.headers.get('API-Version-Status')).toBe('stable');
    });

    it('should add warnings for beta versions', async () => {
      const middleware = withVersioning();
      const request = new NextRequest('http://localhost:3000/api/v2/projects');

      const mockResponse = new NextResponse();
      const mockNext = jest.fn().mockResolvedValue(mockResponse);

      const response = await middleware(request, mockNext);

      expect(response.headers.get('API-Warnings')).toContain('beta');
    });
  });

  describe('MigrationHelper', () => {
    describe('generateMigrationGuide', () => {
      it('should generate migration guide between valid versions', () => {
        const guide = MigrationHelper.generateMigrationGuide('v1', 'v2');

        expect(guide.guide).toContain('Migration from API v1 to v2');
        expect(guide.steps).toBeInstanceOf(Array);
        expect(guide.steps.length).toBeGreaterThan(0);
        expect(guide.examples).toBeDefined();
        expect(guide.examples.urlPath).toBeDefined();
        expect(guide.examples.acceptHeader).toBeDefined();
        expect(guide.examples.versionHeader).toBeDefined();
      });

      it('should include breaking changes in migration guide', () => {
        const guide = MigrationHelper.generateMigrationGuide('v1', 'v2');

        expect(guide.breakingChanges).toBeInstanceOf(Array);
      });

      it('should throw error for invalid versions', () => {
        expect(() => {
          MigrationHelper.generateMigrationGuide('v99' as ApiVersion, 'v1');
        }).toThrow('Invalid version specified for migration');
      });
    });

    describe('validateMigrationPath', () => {
      it('should validate migration between supported versions', () => {
        const validation = MigrationHelper.validateMigrationPath('v1', 'v2');

        expect(validation.valid).toBe(true);
        expect(validation.issues).toHaveLength(0);
        expect(validation.complexity).toMatch(/^(low|medium|high)$/);
      });

      it('should detect issues with invalid source version', () => {
        const validation = MigrationHelper.validateMigrationPath(
          'v99' as ApiVersion,
          'v2'
        );

        expect(validation.valid).toBe(false);
        expect(validation.issues).toContain('Source version v99 not found');
      });

      it('should detect issues with invalid target version', () => {
        const validation = MigrationHelper.validateMigrationPath(
          'v1',
          'v99' as ApiVersion
        );

        expect(validation.valid).toBe(false);
        expect(validation.issues).toContain('Target version v99 not found');
      });
    });

    describe('getCompatibilityMatrix', () => {
      it('should return compatibility matrix for all versions', () => {
        const matrix = MigrationHelper.getCompatibilityMatrix();

        expect(matrix).toBeDefined();
        expect(typeof matrix).toBe('object');

        // Check that all versions are included
        Object.keys(API_VERSIONS).forEach(version => {
          expect(matrix[version]).toBeDefined();
        });
      });

      it('should have boolean compatibility values', () => {
        const matrix = MigrationHelper.getCompatibilityMatrix();

        Object.values(matrix).forEach(versionCompatibility => {
          Object.values(versionCompatibility).forEach(compatible => {
            expect(typeof compatible).toBe('boolean');
          });
        });
      });
    });
  });

  describe('Enhanced Versioning Middleware', () => {
    it('should create enhanced versioning middleware', () => {
      const middleware = withEnhancedVersioning();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('version registry', () => {
    it('should have valid version metadata', () => {
      Object.entries(API_VERSIONS).forEach(([version, versionNumber]) => {
        const result = validateVersion(version as any);
        expect(result.valid).toBe(true);
        expect(result.metadata.version).toBe(versionNumber);
      });
    });

    it('should have required fields for all versions', () => {
      Object.keys(API_VERSIONS).forEach(version => {
        const result = validateVersion(version as any);
        expect(result.metadata.version).toBeDefined();
        expect(result.metadata.status).toBeDefined();
        expect(result.metadata.releaseDate).toBeDefined();
        expect(result.metadata.features).toBeDefined();
        expect(Array.isArray(result.metadata.features)).toBe(true);
      });
    });
  });
});
