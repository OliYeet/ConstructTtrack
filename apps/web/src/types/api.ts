/**
 * API Types for ConstructTrack Platform
 * Standardized types for API requests, responses, and error handling
 */

import { NextRequest, NextResponse } from 'next/server';

// Standard API Response Format
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
}

// API Error Structure
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
  statusCode: number;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Request Context
export interface RequestContext {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
  organizationId?: string;
  requestId: string;
  timestamp: string;
}

// Enhanced NextRequest with context
export interface ApiRequest extends NextRequest {
  context?: RequestContext;
}

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// API Route Handler Type
export type ApiHandler = (
  request: ApiRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

// Validation Error
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Rate Limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// API Configuration
export interface ApiConfig {
  version: string;
  baseUrl: string;
  timeout: number;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}
