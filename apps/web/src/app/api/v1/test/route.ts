/**
 * Test API Route
 * Simple test endpoint to verify API structure and middleware functionality
 */

import { NextRequest } from 'next/server';
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
  receivedData?: unknown;
}

// GET /api/v1/test - Public test endpoint
export async function GET(request: NextRequest) {
  const testData: TestResponse = {
    message: 'API is working correctly!',
    timestamp: new Date().toISOString(),
    requestId: 'test-request',
  };

  return createSuccessResponse(
    testData,
    'Test endpoint successful',
    200
  );
}

// POST /api/v1/test - Test with request body validation
export async function POST(request: NextRequest) {
  const body = await validateRequestBody(request, testRequestSchema);

  const testData: TestResponse = {
    message: `Received: ${body.message}`,
    timestamp: new Date().toISOString(),
    requestId: 'test-request',
    receivedData: body.data,
  };

  return createSuccessResponse(
    testData,
    'Test POST successful',
    200
  );
}
