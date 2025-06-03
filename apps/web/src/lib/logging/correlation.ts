/**
 * Request Correlation Tracking
 * Provides correlation IDs for tracking requests across services and logs
 */

import { NextRequest } from 'next/server';
import { RequestContext } from '@/types/api';

// Generate a unique correlation ID
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a unique request ID
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Extract correlation ID from request headers or generate new one
export function getOrCreateCorrelationId(request: NextRequest): string {
  // Check for existing correlation ID in headers
  const existingId = request.headers.get('x-correlation-id') ||
                    request.headers.get('x-request-id') ||
                    request.headers.get('correlation-id');
  
  if (existingId) {
    return existingId;
  }

  // Generate new correlation ID
  return generateCorrelationId();
}

// Extract or generate request ID
export function getOrCreateRequestId(request: NextRequest): string {
  const existingId = request.headers.get('x-request-id');
  
  if (existingId) {
    return existingId;
  }

  return generateRequestId();
}

// Create correlation context for a request
export function createCorrelationContext(request: NextRequest): {
  correlationId: string;
  requestId: string;
} {
  return {
    correlationId: getOrCreateCorrelationId(request),
    requestId: getOrCreateRequestId(request),
  };
}

// Add correlation headers to response
export function addCorrelationHeaders(
  response: Response,
  correlationId: string,
  requestId: string
): Response {
  const headers = new Headers(response.headers);
  headers.set('x-correlation-id', correlationId);
  headers.set('x-request-id', requestId);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Correlation context storage for async operations
class CorrelationStore {
  private store = new Map<string, string>();

  set(key: string, correlationId: string): void {
    this.store.set(key, correlationId);
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Get correlation ID for current async context
  getCurrent(): string | undefined {
    // In a real implementation, you might use AsyncLocalStorage
    // For now, we'll use a simple approach
    return this.store.get('current');
  }

  setCurrent(correlationId: string): void {
    this.store.set('current', correlationId);
  }
}

export const correlationStore = new CorrelationStore();

// Correlation middleware helper
export function withCorrelation<T>(
  correlationId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const previousId = correlationStore.getCurrent();
  correlationStore.setCurrent(correlationId);
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        if (previousId) {
          correlationStore.setCurrent(previousId);
        } else {
          correlationStore.delete('current');
        }
      });
    }
    
    return result;
  } finally {
    if (!(fn() instanceof Promise)) {
      if (previousId) {
        correlationStore.setCurrent(previousId);
      } else {
        correlationStore.delete('current');
      }
    }
  }
}

// Enhanced request context with correlation
export function createEnhancedRequestContext(
  request: NextRequest,
  baseContext?: RequestContext
): RequestContext & { correlationId: string } {
  const { correlationId, requestId } = createCorrelationContext(request);
  
  return {
    ...baseContext,
    correlationId,
    requestId,
  };
}

// Utility to extract user context for correlation
export function extractUserContext(context?: RequestContext): {
  userId?: string;
  organizationId?: string;
  userRole?: string;
} {
  return {
    userId: context?.user?.id,
    organizationId: context?.organizationId,
    userRole: context?.user?.role,
  };
}

// Create correlation metadata for logging
export function createCorrelationMetadata(
  request: NextRequest,
  context?: RequestContext
): Record<string, unknown> {
  const { correlationId, requestId } = createCorrelationContext(request);
  const userContext = extractUserContext(context);
  
  return {
    correlationId,
    requestId,
    ...userContext,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
  };
}
