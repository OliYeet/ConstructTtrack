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
 */
export function verifyToken(token: string): AuthContext | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;

    // Validate required claims
    if (!decoded.sub || !decoded.exp) {
      logger.warn('Invalid JWT: missing required claims');
      return null;
    }

    // Check expiration
    if (Date.now() >= decoded.exp * 1000) {
      logger.warn('JWT token expired');
      return null;
    }

    return {
      userId: decoded.sub,
      roles: decoded.roles || [],
      projects: decoded.projects || [],
      email: decoded.email,
      exp: decoded.exp,
    };
  } catch (error) {
    logger.warn('JWT verification failed:', error);
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
