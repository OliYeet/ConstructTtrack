/**
 * Test API Route
 * Simple test endpoint to verify API structure and middleware functionality
 */

import { NextRequest } from 'next/server';
import { withApiMiddleware } from '@/lib/api/middleware';
import { createSuccessResponse } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { z } from 'zod';

// Test request schema
const testRequestSchema = z.object({
  message: z.string().min(1).max(100),
  data: z.record(z.any()).optional(),
});

// Test response interface
interface TestResponse {
  message: string;
  timestamp: string;
  requestId: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  receivedData?: any;
}

// GET /api/v1/test - Public test endpoint
async function handleGet(request: NextRequest) {
  const context = request.context!;
  
  const testData: TestResponse = {
    message: 'API is working correctly!',
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    user: context.user,
  };
  
  return createSuccessResponse(
    testData,
    'Test endpoint successful',
    200,
    context.requestId
  );
}

// POST /api/v1/test - Test with request body validation
async function handlePost(request: NextRequest) {
  const context = request.context!;
  const body = await validateRequestBody(request, testRequestSchema);
  
  const testData: TestResponse = {
    message: `Received: ${body.message}`,
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    user: context.user,
    receivedData: body.data,
  };
  
  return createSuccessResponse(
    testData,
    'Test POST successful',
    200,
    context.requestId
  );
}

// Export route handlers
export const GET = withApiMiddleware({
  GET: handleGet,
}, {
  requireAuth: false, // Public endpoint for testing
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
});

export const POST = withApiMiddleware({
  POST: handlePost,
}, {
  requireAuth: false, // Public endpoint for testing
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
});
