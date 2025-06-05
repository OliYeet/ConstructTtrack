/**
 * Test API Route
 * Simple test endpoint to verify API structure and middleware functionality
 */

import { z } from 'zod';

import { withApiMiddleware } from '@/lib/api/middleware';
import { createSuccessResponse } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import type { RequestContext, ApiRequest } from '@/types/api';

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
  receivedData?: unknown;
}

// GET /api/v1/test - Public test endpoint
async function handleGet(
  request: ApiRequest,
  _context: { params: Record<string, string> },
  requestContext: RequestContext
) {
  const testData: TestResponse = {
    message: 'API is working correctly!',
    timestamp: new Date().toISOString(),
    requestId: requestContext.requestId ?? 'test-request',
    user: requestContext.user,
  };

  return createSuccessResponse(
    testData,
    'Test endpoint successful',
    200,
    requestContext.requestId
  );
}

// POST /api/v1/test - Test with request body validation
async function handlePost(
  request: ApiRequest,
  _context: { params: Record<string, string> },
  requestContext: RequestContext
) {
  const body = await validateRequestBody(request, testRequestSchema);

  const testData: TestResponse = {
    message: `Received: ${body.message}`,
    timestamp: new Date().toISOString(),
    requestId: requestContext.requestId ?? 'test-request',
    receivedData: body.data,
    user: requestContext.user,
  };

  return createSuccessResponse(
    testData,
    'Test POST successful',
    200,
    requestContext.requestId
  );
}

// Export wrapped handlers
export const GET = withApiMiddleware({ GET: handleGet });
export const POST = withApiMiddleware({ POST: handlePost });
