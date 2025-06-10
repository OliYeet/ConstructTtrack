/**
 * Realtime Authentication Endpoint
 *
 * Validates and rate-limits WebSocket/realtime connection attempts.
 * This endpoint should be called before establishing Supabase realtime connections.
 */

import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/api/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api/response';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { getRealtimeRateLimitIntegration } from '@/lib/monitoring/realtime-rate-limit-integration';
import { getWebSocketRateLimiter } from '@/lib/security/websocket-rate-limiting';

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    // Require authentication
    const context = await requireAuth(request);

    // Get client IP
    const integration = getRealtimeRateLimitIntegration();
    const ipAddress = integration.getIpFromHeaders(request.headers);

    // Get rate limiter
    const rateLimiter = getWebSocketRateLimiter();

    // Check if connection is allowed
    const canConnect = await rateLimiter.canConnect(ipAddress);

    if (!canConnect) {
      // Record rate limit violation
      performanceMonitor.recordMetric(
        'realtime_rate_limit_exceeded',
        1,
        'count',
        {
          type: 'connection',
          userId: context.user?.id ?? 'unknown',
          organizationId: context.organizationId ?? 'unknown',
        }
      );

      return createErrorResponse(
        new Error('Too many connection attempts. Please try again later.'),
        context.requestId
      );
    }

    // Generate connection token with metadata
    const connectionToken = generateConnectionToken({
      userId: context.user?.id ?? 'unknown',
      organizationId: context.organizationId ?? 'unknown',
      ipAddress,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    // Get current rate limit stats
    const stats = rateLimiter.getIpStats(ipAddress);

    // Record successful auth
    performanceMonitor.recordMetric('realtime_auth_success', 1, 'count', {
      organizationId: context.organizationId ?? 'unknown',
    });

    return createSuccessResponse({
      connectionToken,
      rateLimits: {
        connectionsUsed: stats.connectionCount,
        connectionsLimit: 10,
        subscriptionsUsed: stats.totalSubscriptions,
        subscriptionsLimit: 50,
        messagesUsed: stats.totalMessages,
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    performanceMonitor.recordMetric('realtime_auth_error', 1, 'count', {
      error: error instanceof Error ? error.name : 'unknown',
    });

    throw error;
  } finally {
    // Record performance metrics
    performanceMonitor.recordMetric(
      'realtime_auth_duration',
      Date.now() - start,
      'ms'
    );
  }
}

export async function GET(request: NextRequest) {
  // Check rate limit status for authenticated user
  await requireAuth(request);

  const integration = getRealtimeRateLimitIntegration();
  const ipAddress = integration.getIpFromHeaders(request.headers);

  const rateLimiter = getWebSocketRateLimiter();
  const stats = rateLimiter.getIpStats(ipAddress);

  return createSuccessResponse({
    rateLimits: {
      connectionsUsed: stats.connectionCount,
      connectionsLimit: 10,
      connectionsRemaining: Math.max(0, 10 - stats.connectionCount),
      subscriptionsUsed: stats.totalSubscriptions,
      subscriptionsLimit: 50,
      subscriptionsRemaining: Math.max(0, 50 - stats.totalSubscriptions),
      messagesUsed: stats.totalMessages,
    },
  });
}

/**
 * Generate a signed connection token
 */
function generateConnectionToken(payload: {
  userId: string;
  organizationId: string;
  ipAddress: string;
  issuedAt: number;
  expiresAt: number;
}): string {
  // In production, this would use a proper JWT library with signing
  // For now, we'll use a simple base64 encoding
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
