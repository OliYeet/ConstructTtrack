/**
 * Authentication module for WebSocket Gateway
 * Implements Charlie's JWT verification and authorization strategy
 */

import jwt from 'jsonwebtoken';

import { config } from './config';
import type { AuthContext } from './types';
import { logger } from './utils/logger';

/**
 * Verify JWT token and extract auth context
 * Based on Charlie's handshake specification
 * Enhanced with robust error handling for CI environments
 */
export function verifyToken(token: string): AuthContext | null {
  // Validate input
  if (!token || typeof token !== 'string') {
    logger.warn('Invalid JWT token: token is empty or not a string');
    return null;
  }

  // Validate JWT secret is configured
  if (!config.jwt.secret) {
    logger.error('JWT_SECRET is not configured');
    return null;
  }

  try {
    // Prevent JWT algorithm confusion attacks - CodeRabbit security recommendation
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      issuer: 'constructtrack',
      audience: 'ws-gateway',
      // Increased clock tolerance for CI environments with potential clock skew
      clockTolerance: 60, // 60 seconds to handle CI timing issues
    }) as jwt.JwtPayload;

    // Validate required claims with detailed logging
    if (!decoded.sub) {
      logger.warn('Invalid JWT: missing subject (sub) claim');
      return null;
    }

    if (!decoded.exp) {
      logger.warn('Invalid JWT: missing expiration (exp) claim');
      return null;
    }

    // Additional validation for issuer and audience (redundant but explicit)
    if (decoded.iss !== 'constructtrack') {
      logger.warn(
        `Invalid JWT: incorrect issuer. Expected 'constructtrack', got '${decoded.iss}'`
      );
      return null;
    }

    if (decoded.aud !== 'ws-gateway') {
      logger.warn(
        `Invalid JWT: incorrect audience. Expected 'ws-gateway', got '${decoded.aud}'`
      );
      return null;
    }

    // Check expiration with detailed logging (redundant with jwt.verify but explicit)
    const now = Math.floor(Date.now() / 1000);
    if (now >= decoded.exp) {
      logger.warn(
        `JWT token expired. Current time: ${now}, Token exp: ${decoded.exp}, Diff: ${now - decoded.exp}s`
      );
      return null;
    }

    // Check not-before claim if present
    if (decoded.nbf && now < decoded.nbf) {
      logger.warn(
        `JWT token not active yet. Current time: ${now}, Token nbf: ${decoded.nbf}, Diff: ${decoded.nbf - now}s`
      );
      return null;
    }

    logger.info('JWT token verified successfully', {
      userId: decoded.sub,
      exp: decoded.exp,
      timeToExpiry: decoded.exp - now,
    });

    return {
      userId: decoded.sub,
      roles: decoded.roles || [],
      projects: decoded.projects || [],
      email: decoded.email,
      exp: decoded.exp,
    };
  } catch (error) {
    // Enhanced error handling with specific error types and detailed logging
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(
        `JWT verification failed - JsonWebTokenError: ${error.message}`,
        {
          errorName: error.name,
          tokenPreview: token.substring(0, 20) + '...',
        }
      );
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`JWT token expired - TokenExpiredError: ${error.message}`, {
        expiredAt: error.expiredAt,
        currentTime: new Date().toISOString(),
      });
    } else if (error instanceof jwt.NotBeforeError) {
      logger.warn(
        `JWT token not active yet - NotBeforeError: ${error.message}`,
        {
          notBefore: error.date,
          currentTime: new Date().toISOString(),
        }
      );
    } else {
      logger.warn('JWT verification failed with unexpected error:', {
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        tokenPreview: token.substring(0, 20) + '...',
      });
    }
    return null;
  }
}

/**
 * Extract token from WebSocket upgrade request
 * Supports query parameter: ?token=<JWT>
 */
export function extractTokenFromRequest(url: string): string | null {
  try {
    const urlObj = new globalThis.URL(url, 'ws://localhost');
    return urlObj.searchParams.get('token');
  } catch (error) {
    logger.warn('Failed to parse WebSocket URL:', error);
    return null;
  }
}

/**
 * Authorize room subscription based on auth context
 * Implements Charlie's message authorization strategy
 */
export function authorizeRoom(authContext: AuthContext, room: string): boolean {
  // Parse room format: "project:123", "user:456", "team:789", "global"
  const [roomType, roomId] = room.split(':');

  switch (roomType) {
    case 'project':
      return authContext.projects.includes(roomId);

    case 'user':
      return authContext.userId === roomId;

    case 'team':
      // TODO: Implement team membership check
      return true; // Placeholder

    case 'global':
      // Global room requires specific role
      return (
        authContext.roles.includes('admin') ||
        authContext.roles.includes('manager')
      );

    default:
      logger.warn(`Unknown room type: ${roomType}`);
      return false;
  }
}

/**
 * Generate unique connection ID
 */
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
