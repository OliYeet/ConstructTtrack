/**
 * API Authentication Middleware
 * JWT token verification and user context extraction
 */

import { NextRequest } from 'next/server';

import {
  AuthenticationError,
  AuthorizationError,
} from '@/lib/errors/api-errors';
import { RequestContext } from '@/types/api';

// Extract JWT token from request headers
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and "token" formats (case-insensitive)
  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '');
  }

  return authHeader;
}

// Verify JWT token and get user information
export async function verifyToken(
  token: string
): Promise<RequestContext['user']> {
  try {
    // Dynamically import Supabase client to avoid module-level initialization
    const { supabase } = await import('@constructtrack/supabase/client');

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get user profile with role and organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new AuthenticationError('User profile not found');
    }

    return {
      id: user.id,
      email: user.email || '',
      role: profile.role,
      organizationId: profile.organization_id || undefined,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Token verification failed');
  }
}

// Create request context with user information
export async function createRequestContext(
  request: NextRequest
): Promise<RequestContext> {
  const token = extractToken(request);
  let user: RequestContext['user'] | undefined;

  if (token) {
    try {
      user = await verifyToken(token);
    } catch {
      // For optional authentication, we don't throw here
      // The specific route handler can decide if auth is required
    }
  }

  return {
    user,
    organizationId: user?.organizationId,
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
  };
}

// Require authentication middleware
export async function requireAuth(
  request: NextRequest
): Promise<RequestContext> {
  const context = await createRequestContext(request);

  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }

  return context;
}

// Require specific role middleware
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<RequestContext> {
  const context = await requireAuth(request);

  if (!allowedRoles.includes(context.user?.role || '')) {
    throw new AuthorizationError(
      `Access denied. Required roles: ${allowedRoles.join(', ')}`
    );
  }

  return context;
}

// Require organization access middleware
export async function requireOrganization(
  request: NextRequest,
  organizationId?: string
): Promise<RequestContext> {
  const context = await requireAuth(request);

  // If no specific organization is required, user must belong to some organization
  if (!organizationId) {
    if (!context.user?.organizationId) {
      throw new AuthorizationError('Organization membership required');
    }
    return context;
  }

  // Check if user belongs to the specific organization
  if (context.user?.organizationId !== organizationId) {
    throw new AuthorizationError('Access denied to this organization');
  }

  return context;
}

// Admin role check
export async function requireAdmin(
  request: NextRequest
): Promise<RequestContext> {
  return requireRole(request, ['admin']);
}

// Manager or admin role check
export async function requireManager(
  request: NextRequest
): Promise<RequestContext> {
  return requireRole(request, ['admin', 'manager']);
}

// Field worker, manager, or admin role check
export async function requireFieldWorker(
  request: NextRequest
): Promise<RequestContext> {
  return requireRole(request, ['admin', 'manager', 'field_worker']);
}

// Check if user can access resource
export function canAccessResource(
  userRole: string,
  resourceOwnerId?: string,
  userId?: string
): boolean {
  // Admins can access everything
  if (userRole === 'admin') {
    return true;
  }

  // Managers can access most resources in their organization
  if (userRole === 'manager') {
    return true;
  }

  // Field workers can access their own resources
  if (userRole === 'field_worker' && resourceOwnerId && userId) {
    return resourceOwnerId === userId;
  }

  return false;
}

// Extract organization ID from path parameters
export function extractOrganizationId(
  params: Record<string, string>
): string | undefined {
  return params.organizationId || params.orgId;
}

// Validate organization access from path parameters
export async function validateOrganizationAccess(
  request: NextRequest,
  params: Record<string, string>
): Promise<RequestContext> {
  const organizationId = extractOrganizationId(params);

  if (!organizationId) {
    throw new AuthorizationError('Organization ID required');
  }

  return requireOrganization(request, organizationId);
}

// API Key authentication (for external integrations)
export async function verifyApiKey(
  request: NextRequest
): Promise<RequestContext> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    throw new AuthenticationError('API key required');
  }

  // TODO: Implement database-backed API key validation
  // This requires creating an api_keys table with the following schema:
  // - id: UUID primary key
  // - key_prefix: VARCHAR(8) for quick lookup
  // - hashed_key: VARCHAR(64) SHA-256 hash of the full key
  // - permissions: JSONB array of allowed permissions
  // - rate_limit: INTEGER requests per minute
  // - expires_at: TIMESTAMP optional expiration
  // - is_active: BOOLEAN
  // - last_used_at: TIMESTAMP
  // - created_at: TIMESTAMP
  // - updated_at: TIMESTAMP

  // For now, use environment variable validation
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    throw new AuthenticationError('Invalid API key');
  }

  // Return a system context for API key authentication
  return {
    user: {
      id: 'system',
      email: 'system@constructtrack.com',
      role: 'admin',
    },
    requestId: `api_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
  };
}
