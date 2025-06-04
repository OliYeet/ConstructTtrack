/**
 * API Validation Unit Tests
 * Tests for request validation utilities
 */

import {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  extractPaginationParams,
  validateFileUpload,
  validateSearchQuery,
  sanitizeString,
  commonSchemas,
  constructTrackSchemas,
} from '../validation';
import { ValidationError } from '../../errors/api-errors';
import { createMockRequest } from '@/tests/setup';
import { z } from 'zod';

describe('validateRequestBody', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(0),
  });

  it('should validate valid request body', async () => {
    const request = createMockRequest({
      body: { name: 'John', age: 25 },
    });

    const result = await validateRequestBody(request, testSchema);
    expect(result).toEqual({ name: 'John', age: 25 });
  });

  it('should throw ValidationError for invalid data', async () => {
    const request = createMockRequest({
      body: { name: '', age: -1 },
    });

    await expect(validateRequestBody(request, testSchema)).rejects.toThrow(
      ValidationError
    );
  });

  it('should throw ValidationError for invalid JSON', async () => {
    const request = createMockRequest();
    request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

    await expect(validateRequestBody(request, testSchema)).rejects.toThrow(
      ValidationError
    );
  });
});

describe('validateQueryParams', () => {
  const testSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    search: z.string().optional(),
  });

  it('should validate valid query parameters', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test?page=2&search=test',
    });

    const result = validateQueryParams(request, testSchema);
    expect(result).toEqual({ page: 2, search: 'test' });
  });

  it('should apply default values', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test',
    });

    const result = validateQueryParams(request, testSchema);
    expect(result).toEqual({ page: 1 });
  });

  it('should throw ValidationError for invalid parameters', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test?page=invalid',
    });

    expect(() => validateQueryParams(request, testSchema)).toThrow(
      ValidationError
    );
  });
});

describe('validatePathParams', () => {
  const testSchema = z.object({
    id: z.string().uuid(),
    slug: z.string().min(1),
  });

  it('should validate valid path parameters', () => {
    const params = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'test-slug',
    };

    const result = validatePathParams(params, testSchema);
    expect(result).toEqual(params);
  });

  it('should throw ValidationError for invalid parameters', () => {
    const params = {
      id: 'invalid-uuid',
      slug: '',
    };

    expect(() => validatePathParams(params, testSchema)).toThrow(
      ValidationError
    );
  });
});

describe('extractPaginationParams', () => {
  it('should extract pagination parameters with defaults', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test',
    });

    const result = extractPaginationParams(request);
    expect(result).toEqual({
      page: 1,
      limit: 20,
      sortOrder: 'asc',
    });
  });

  it('should extract custom pagination parameters', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test?page=3&limit=50&sortBy=name&sortOrder=desc',
    });

    const result = extractPaginationParams(request);
    expect(result).toEqual({
      page: 3,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'desc',
    });
  });

  it('should enforce maximum limit', () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/test?limit=200',
    });

    expect(() => extractPaginationParams(request)).toThrow(ValidationError);
  });
});

describe('validateFileUpload', () => {
  const createMockFile = (overrides = {}) =>
    ({
      name: 'test.jpg',
      size: 1024 * 1024, // 1MB
      type: 'image/jpeg',
      ...overrides,
    }) as File;

  it('should validate file within size limit', () => {
    const file = createMockFile();
    expect(() => validateFileUpload(file)).not.toThrow();
  });

  it('should throw ValidationError for oversized file', () => {
    const file = createMockFile({ size: 20 * 1024 * 1024 }); // 20MB
    expect(() => validateFileUpload(file)).toThrow(ValidationError);
  });

  it('should validate allowed file types', () => {
    const file = createMockFile({ type: 'image/png' });
    expect(() =>
      validateFileUpload(file, {
        allowedTypes: ['image/jpeg', 'image/png'],
      })
    ).not.toThrow();
  });

  it('should throw ValidationError for disallowed file type', () => {
    const file = createMockFile({ type: 'application/pdf' });
    expect(() =>
      validateFileUpload(file, {
        allowedTypes: ['image/jpeg', 'image/png'],
      })
    ).toThrow(ValidationError);
  });

  it('should validate allowed file extensions', () => {
    const file = createMockFile({ name: 'test.jpg' });
    expect(() =>
      validateFileUpload(file, {
        allowedExtensions: ['jpg', 'png'],
      })
    ).not.toThrow();
  });

  it('should throw ValidationError for disallowed file extension', () => {
    const file = createMockFile({ name: 'test.pdf' });
    expect(() =>
      validateFileUpload(file, {
        allowedExtensions: ['jpg', 'png'],
      })
    ).toThrow(ValidationError);
  });
});

describe('validateSearchQuery', () => {
  it('should validate and sanitize valid search query', () => {
    const result = validateSearchQuery('  hello world  ');
    expect(result).toBe('hello world');
  });

  it('should throw ValidationError for empty query', () => {
    expect(() => validateSearchQuery('')).toThrow(ValidationError);
    expect(() => validateSearchQuery('   ')).toThrow(ValidationError);
  });

  it('should throw ValidationError for too long query', () => {
    const longQuery = 'a'.repeat(101);
    expect(() => validateSearchQuery(longQuery)).toThrow(ValidationError);
  });

  it('should sanitize HTML tags', () => {
    const result = validateSearchQuery(
      'hello <script>alert("xss")</script> world'
    );
    expect(result).toBe('hello alert("xss") world');
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello world  ')).toBe('hello world');
  });

  it('should remove HTML tags', () => {
    expect(sanitizeString('hello <b>world</b>')).toBe('hello world');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeString('hello    world\n\ntest')).toBe('hello world test');
  });
});

describe('commonSchemas', () => {
  it('should validate UUID', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(() => commonSchemas.uuid.parse(validUuid)).not.toThrow();
    expect(() => commonSchemas.uuid.parse('invalid-uuid')).toThrow();
  });

  it('should validate email', () => {
    expect(() => commonSchemas.email.parse('test@example.com')).not.toThrow();
    expect(() => commonSchemas.email.parse('invalid-email')).toThrow();
  });

  it('should validate phone number', () => {
    expect(() => commonSchemas.phone.parse('+1234567890')).not.toThrow();
    expect(() => commonSchemas.phone.parse('(555) 123-4567')).not.toThrow();
    expect(() => commonSchemas.phone.parse('invalid-phone')).toThrow();
  });

  it('should validate password', () => {
    expect(() => commonSchemas.password.parse('Password123')).not.toThrow();
    expect(() => commonSchemas.password.parse('weak')).toThrow();
    expect(() => commonSchemas.password.parse('nouppercaseornumber')).toThrow();
  });

  it('should validate coordinates', () => {
    expect(() =>
      commonSchemas.coordinates.parse({
        latitude: 40.7128,
        longitude: -74.006,
      })
    ).not.toThrow();
    expect(() =>
      commonSchemas.coordinates.parse({
        latitude: 91, // Invalid latitude
        longitude: -74.006,
      })
    ).toThrow();
  });
});

describe('constructTrackSchemas', () => {
  it('should validate project creation data', () => {
    const validProject = {
      name: 'Test Project',
      description: 'A test project',
      customerEmail: 'customer@example.com',
    };

    expect(() =>
      constructTrackSchemas.createProject.parse(validProject)
    ).not.toThrow();
  });

  it('should validate task creation data', () => {
    const validTask = {
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Task',
      description: 'A test task',
    };

    expect(() =>
      constructTrackSchemas.createTask.parse(validTask)
    ).not.toThrow();
  });

  it('should validate profile update data', () => {
    const validProfile = {
      fullName: 'John Doe',
      phone: '+1234567890',
    };

    expect(() =>
      constructTrackSchemas.updateProfile.parse(validProfile)
    ).not.toThrow();
  });
});
