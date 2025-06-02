/**
 * API Response Unit Tests
 * Tests for response formatting utilities
 */

import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createNoContentResponse,
  createCreatedResponse,
  createAcceptedResponse,
  createMethodNotAllowedResponse,
  createOptionsResponse,
  addCorsHeaders,
} from '../response';
import { BaseApiError, ValidationError } from '../../errors/api-errors';
import { NextResponse } from 'next/server';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      status: options?.status || 200,
      headers: new Map(),
      json: () => Promise.resolve(data),
    })),
  },
}));

describe('createSuccessResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a success response with data', () => {
    const data = { id: 1, name: 'Test' };
    const response = createSuccessResponse(data, 'Success message');

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data,
        message: 'Success message',
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          version: '1.0.0',
          requestId: expect.any(String),
        }),
      }),
      { status: 200 }
    );
  });

  it('should create a success response with custom status code', () => {
    const data = { id: 1 };
    createSuccessResponse(data, 'Success', 201);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.any(Object),
      { status: 201 }
    );
  });

  it('should include custom request ID when provided', () => {
    const data = { id: 1 };
    const requestId = 'custom-request-id';
    createSuccessResponse(data, 'Success', 200, requestId);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          requestId,
        }),
      }),
      expect.any(Object)
    );
  });
});

describe('createErrorResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create error response from BaseApiError', () => {
    const error = new ValidationError('Invalid input', 'email');
    const response = createErrorResponse(error);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          field: 'email',
          statusCode: 400,
        }),
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          version: '1.0.0',
          requestId: expect.any(String),
        }),
      }),
      { status: 400 }
    );
  });

  it('should create error response from generic Error', () => {
    const error = new Error('Something went wrong');
    const response = createErrorResponse(error);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong',
          statusCode: 500,
        }),
      }),
      { status: 500 }
    );
  });

  it('should include custom request ID when provided', () => {
    const error = new Error('Test error');
    const requestId = 'custom-request-id';
    createErrorResponse(error, requestId);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          requestId,
        }),
      }),
      expect.any(Object)
    );
  });
});

describe('createPaginatedResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create paginated response with correct pagination metadata', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const total = 10;
    const page = 2;
    const limit = 3;

    createPaginatedResponse(data, total, page, limit);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          data,
          pagination: {
            page: 2,
            limit: 3,
            total: 10,
            totalPages: 4,
            hasNext: true,
            hasPrev: true,
          },
        }),
      }),
      { status: 200 }
    );
  });

  it('should calculate pagination correctly for first page', () => {
    const data = [{ id: 1 }];
    createPaginatedResponse(data, 5, 1, 2);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            hasNext: true,
            hasPrev: false,
          }),
        }),
      }),
      expect.any(Object)
    );
  });

  it('should calculate pagination correctly for last page', () => {
    const data = [{ id: 5 }];
    createPaginatedResponse(data, 5, 3, 2);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            hasNext: false,
            hasPrev: true,
          }),
        }),
      }),
      expect.any(Object)
    );
  });
});

describe('createNoContentResponse', () => {
  it('should create a 204 response with no content', () => {
    // Mock NextResponse constructor
    const mockResponse = {
      headers: new Map(),
    };
    const NextResponseSpy = jest.spyOn(global, 'NextResponse' as any).mockImplementation(() => mockResponse);

    const response = createNoContentResponse('test-request-id');

    // Verify NextResponse was called with correct parameters
    expect(NextResponseSpy).toHaveBeenCalledWith(null, {
      status: 204,
      headers: {
        'X-Request-ID': 'test-request-id',
        'X-API-Version': '1.0.0',
      },
    });

    NextResponseSpy.mockRestore();
  });
});

describe('createCreatedResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a 201 response', () => {
    const data = { id: 1, name: 'Created' };
    createCreatedResponse(data);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data,
        message: 'Resource created successfully',
      }),
      { status: 201 }
    );
  });

  it('should use custom message when provided', () => {
    const data = { id: 1 };
    createCreatedResponse(data, 'Custom created message');

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Custom created message',
      }),
      { status: 201 }
    );
  });
});

describe('createAcceptedResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a 202 response', () => {
    const data = { taskId: 'task-123' };
    createAcceptedResponse(data);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data,
        message: 'Request accepted for processing',
      }),
      { status: 202 }
    );
  });

  it('should work without data', () => {
    createAcceptedResponse();

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: undefined,
        message: 'Request accepted for processing',
      }),
      { status: 202 }
    );
  });
});

describe('createMethodNotAllowedResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a 405 response with allowed methods', () => {
    const allowedMethods = ['GET', 'POST'];
    createMethodNotAllowedResponse(allowedMethods);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed. Allowed methods: GET, POST',
          statusCode: 405,
        }),
      }),
      {
        status: 405,
        headers: {
          Allow: 'GET, POST',
        },
      }
    );
  });
});

describe('createOptionsResponse', () => {
  it('should create an OPTIONS response with CORS headers', () => {
    // Mock NextResponse constructor
    const mockResponse = {
      headers: new Map(),
    };
    const NextResponseSpy = jest.spyOn(global, 'NextResponse' as any).mockImplementation(() => mockResponse);

    const response = createOptionsResponse();

    expect(NextResponseSpy).toHaveBeenCalledWith(null, { status: 200 });

    NextResponseSpy.mockRestore();
  });
});

describe('addCorsHeaders', () => {
  it('should add CORS headers to response', () => {
    const mockResponse = {
      headers: {
        set: jest.fn(),
      },
    };

    addCorsHeaders(mockResponse as any);

    expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
  });
});
