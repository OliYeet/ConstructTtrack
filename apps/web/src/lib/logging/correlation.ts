/**
 * Request Correlation Tracking
 * Provides correlation IDs for tracking requests across services and logs
 */

import { NextRequest } from 'next/server';

import { RequestContext } from '@/types/api';

// Generate a unique correlation ID
export function generateCorrelationId(): string {
  return `req_${crypto.randomUUID()}`;
}

// Generate a unique request ID
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Extract correlation ID from request headers or generate new one
export function getOrCreateCorrelationId(request: NextRequest): string {
  // Check for existing correlation ID in headers
  const existingId =
    request.headers.get('x-correlation-id') ||
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
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-request-id', requestId);
  return response;
}

// Correlation context storage for async operations
class CorrelationStore {
  private als: any = null;
  private store = new Map<string, string>();

  constructor() {
    // Only use AsyncLocalStorage in server environment
    if (typeof window === 'undefined') {
      try {
        const { AsyncLocalStorage } = eval('require')('node:async_hooks');
        this.als = new AsyncLocalStorage();
      } catch {
        // Fallback if AsyncLocalStorage is not available
        this.als = null;
      }
    }
  }

  getCurrent(): string | undefined {
    if (this.als && typeof window === 'undefined') {
      return this.als.getStore()?.id || this.store.get('current');
    }
    return this.store.get('current');
  }

  setCurrent(correlationId: string): void {
    if (this.als && typeof window === 'undefined') {
      this.als.enterWith({ id: correlationId });
    }
    this.store.set('current', correlationId);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
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

    // For synchronous results, restore context immediately
    if (previousId) {
      correlationStore.setCurrent(previousId);
    } else {
      correlationStore.delete('current');
    }

    return result;
  } catch (error) {
    // Restore context on error
    if (previousId) {
      correlationStore.setCurrent(previousId);
    } else {
      correlationStore.delete('current');
    }
    throw error;
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
    timestamp: baseContext?.timestamp || new Date().toISOString(),
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
  ids: { correlationId: string; requestId: string },
  context?: RequestContext
): Record<string, unknown> {
  const { correlationId, requestId } = ids;
  const userContext = extractUserContext(context);

  return {
    correlationId,
    requestId,
    ...userContext,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
    ip:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
  };
}
