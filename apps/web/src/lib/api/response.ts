/**
 * API Response Utilities
 * Standardized response formatting for the ConstructTrack API
 */

import { NextResponse } from 'next/server';

import { BaseApiError } from '@/lib/errors/api-errors';
import { ApiResponse, ApiError, PaginatedResponse } from '@/types/api';
import {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
} from '@/lib/api/versioning';

// API Configuration
const API_CONFIG = {
  version: DEFAULT_API_VERSION,
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
};

// Generate request ID for tracing
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Success Response Helper
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200,
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      version: apiVersion,
      requestId: requestId || generateRequestId(),
    },
  };

  const response = NextResponse.json(body, { status: statusCode });
  response.headers.set(API_VERSION_HEADER, apiVersion);
  return response;
}

// Error Response Helper
export function createErrorResponse(
  error: BaseApiError | ApiError | Error,
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse> {
  let apiError: ApiError;
  let statusCode: number;

  if (error instanceof BaseApiError) {
    apiError = error.toApiError();
    statusCode = error.statusCode;
  } else if ('statusCode' in error && 'code' in error) {
    apiError = error as ApiError;
    statusCode = apiError.statusCode;
  } else {
    apiError = {
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      statusCode: 500,
    };
    statusCode = 500;
  }

  const body: ApiResponse = {
    success: false,
    error: apiError,
    meta: {
      timestamp: new Date().toISOString(),
      version: apiVersion,
      requestId: requestId || generateRequestId(),
    },
  };

  const response = NextResponse.json(body, { status: statusCode });
  response.headers.set(API_VERSION_HEADER, apiVersion);
  return response;
}

// Paginated Response Helper
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string,
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const paginatedData: PaginatedResponse<T> = {
    data,
    pagination: { page, limit, total, totalPages, hasNext, hasPrev },
  };

  return createSuccessResponse(
    paginatedData,
    message,
    200,
    requestId,
    apiVersion
  );
}

// No Content Response (204)
export function createNoContentResponse(
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'X-Request-ID': requestId || generateRequestId(),
      [API_VERSION_HEADER]: apiVersion,
    },
  });
}

// Created Response (201)
export function createCreatedResponse<T>(
  data: T,
  message?: string,
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse<T>> {
  return createSuccessResponse(
    data,
    message || 'Resource created successfully',
    201,
    requestId,
    apiVersion
  );
}

// Accepted Response (202)
export function createAcceptedResponse<T>(
  data?: T,
  message?: string,
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse<T | undefined>> {
  return createSuccessResponse(
    data,
    message || 'Request accepted for processing',
    202,
    requestId,
    apiVersion
  );
}

// Method Not Allowed Response (405)
export function createMethodNotAllowedResponse(
  allowedMethods: string[],
  requestId?: string,
  apiVersion: string = API_CONFIG.version
): NextResponse<ApiResponse> {
  const body: ApiResponse = {
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      statusCode: 405,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: apiVersion,
      requestId: requestId || generateRequestId(),
    },
  };

  return NextResponse.json(body, {
    status: 405,
    headers: {
      Allow: allowedMethods.join(', '),
      [API_VERSION_HEADER]: apiVersion,
    },
  });
}

// CORS Headers Helper
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

// Options Response for CORS
export function createOptionsResponse(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}
