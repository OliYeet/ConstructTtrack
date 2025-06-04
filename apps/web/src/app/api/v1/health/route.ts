/**
 * Health Check API Route
 * Simple health check endpoint to verify API functionality
 */

import { withApiMiddleware } from '@/lib/api/middleware';
import { createSuccessResponse } from '@/lib/api/response';
import { RequestContext, ApiRequest } from '@/types/api';

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
  uptime: number;
}

// Check database connectivity
async function checkDatabase(): Promise<'healthy' | 'unhealthy'> {
  try {
    // For now, just check if environment variables are set
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return 'unhealthy';
    }

    // TODO: Add actual database connectivity check
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

// GET /api/v1/health
async function handleGet(
  request: ApiRequest,
  _context: { params: Record<string, string> }
) {
  const requestContext = (request as ApiRequest & { context?: RequestContext })
    .context;
  const startTime = Date.now();

  // Check all services
  const [databaseStatus] = await Promise.all([checkDatabase()]);

  const apiStatus = 'healthy'; // If we reach here, API is working

  // Determine overall status
  let overallStatus: HealthCheckResponse['status'] = 'healthy';
  if (databaseStatus === 'unhealthy') {
    overallStatus = 'degraded';
  }

  // Calculate response time
  const responseTime = Date.now() - startTime;

  const healthData: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    services: {
      database: databaseStatus,
      api: apiStatus,
    },
    uptime: process.uptime(),
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  return createSuccessResponse(
    healthData,
    `System is ${overallStatus} (${responseTime}ms)`,
    statusCode,
    requestContext?.requestId
  );
}

// Export wrapped handler
export const GET = withApiMiddleware({ GET: handleGet });
