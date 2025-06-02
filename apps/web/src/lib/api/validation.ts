/**
 * API Validation Utilities
 * Request validation using Zod schemas
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { ValidationError } from '@/lib/errors/api-errors';
import { PaginationParams } from '@/types/api';

// Common validation schemas
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Phone validation (basic)
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),

  // Password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),

  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  // Date validation
  date: z.string().datetime('Invalid date format'),

  // Coordinates validation
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
};

// Validate request body
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.message, firstError.path.join('.'), {
        zodError: error.errors,
      });
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

// Validate query parameters
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.message, firstError.path.join('.'), {
        zodError: error.errors,
      });
    }
    throw new ValidationError('Invalid query parameters');
  }
}

// Validate path parameters
export function validatePathParams<T>(
  params: Record<string, string | string[]>,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.message, firstError.path.join('.'), {
        zodError: error.errors,
      });
    }
    throw new ValidationError('Invalid path parameters');
  }
}

// Extract and validate pagination parameters
export function extractPaginationParams(
  request: NextRequest
): PaginationParams {
  return validateQueryParams(request, commonSchemas.pagination);
}

// Validate file upload
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): void {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    throw new ValidationError(
      `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
      'file'
    );
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      'file'
    );
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new ValidationError(
        `File extension .${extension} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
        'file'
      );
    }
  }
}

// Sanitize string input
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Validate and sanitize search query
export function validateSearchQuery(query: string): string {
  if (!query || query.trim().length === 0) {
    throw new ValidationError('Search query cannot be empty', 'query');
  }

  if (query.length > 100) {
    throw new ValidationError(
      'Search query cannot exceed 100 characters',
      'query'
    );
  }

  return sanitizeString(query);
}

// Common validation schemas for ConstructTrack entities
export const constructTrackSchemas = {
  // Project validation
  createProject: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    budget: z.number().positive().optional(),
    customerName: z.string().min(1).max(100).optional(),
    customerEmail: commonSchemas.email.optional(),
    customerPhone: commonSchemas.phone.optional(),
    customerAddress: z.string().max(200).optional(),
    location: commonSchemas.coordinates.optional(),
  }),

  // Task validation
  createTask: z.object({
    projectId: commonSchemas.uuid,
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    assignedTo: commonSchemas.uuid.optional(),
    priority: z.number().int().min(1).max(5).default(3),
    dueDate: z.string().datetime().optional(),
    estimatedHours: z.number().positive().optional(),
    location: commonSchemas.coordinates.optional(),
  }),

  // User profile validation
  updateProfile: z.object({
    fullName: z.string().min(1).max(100).optional(),
    phone: commonSchemas.phone.optional(),
    avatarUrl: z.string().url().optional(),
  }),
};
