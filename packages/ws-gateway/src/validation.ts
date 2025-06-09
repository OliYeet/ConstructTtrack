/**
 * Input Validation and Rate Limiting for WebSocket Gateway
 * Implements comprehensive security validation
 */

import type { ClientMessage, ValidationResult } from './types';

/**
 * Validates client messages for proper format and security
 */
export function validateClientMessage(
  message: unknown
): message is ClientMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check required action field
  if (!msg.action || typeof msg.action !== 'string') {
    return false;
  }

  // Validate specific message types
  switch (msg.action) {
    case 'subscribe':
    case 'unsubscribe':
      return typeof msg.room === 'string' && validateRoomName(msg.room).isValid;

    case 'ping':
      return true; // Ping messages don't require additional fields

    default:
      return false; // Unknown action
  }
}

/**
 * Validates WebSocket connection parameters from URL
 */
export function validateConnectionParams(url: string): ValidationResult {
  const errors: string[] = [];
  let token: string | undefined;

  try {
    // Parse URL and extract parameters
    const urlObj = new globalThis.URL(url, 'ws://localhost');

    // Extract token from query parameters
    const tokenParam = urlObj.searchParams.get('token');
    if (!tokenParam) {
      errors.push('Missing authentication token');
    } else if (tokenParam.length < 10) {
      errors.push('Invalid token format');
    } else {
      token = tokenParam;
    }

    // Validate URL path
    if (!urlObj.pathname.startsWith('/ws')) {
      errors.push('Invalid WebSocket path');
    }

    // Check for suspicious parameters
    const suspiciousParams = [
      'script',
      'eval',
      'function',
      '<',
      '>',
      'javascript:',
    ];
    for (const [key, value] of urlObj.searchParams) {
      const combined = `${key}=${value}`.toLowerCase();
      if (suspiciousParams.some(suspicious => combined.includes(suspicious))) {
        errors.push(`Suspicious parameter detected: ${key}`);
      }
    }
  } catch {
    errors.push('Invalid URL format');
  }

  return {
    isValid: errors.length === 0,
    errors,
    token,
  };
}

/**
 * Rate limiting implementation for WebSocket messages
 */
export class MessageRateLimiter {
  private readonly maxMessages: number;
  private readonly windowMs: number;
  private readonly connections = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(maxMessages: number, windowMs: number) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
  }

  /**
   * Check if a connection is allowed to send a message
   */
  isAllowed(connectionId: string): boolean {
    const now = Date.now();
    const existing = this.connections.get(connectionId);

    if (!existing || now >= existing.resetTime) {
      // First message or window expired, reset counter
      this.connections.set(connectionId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (existing.count >= this.maxMessages) {
      return false; // Rate limit exceeded
    }

    // Increment counter
    existing.count++;
    return true;
  }

  /**
   * Get current rate limit status for a connection
   */
  getStatus(connectionId: string): {
    count: number;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const existing = this.connections.get(connectionId);

    if (!existing || now >= existing.resetTime) {
      return {
        count: 0,
        remaining: this.maxMessages,
        resetTime: now + this.windowMs,
      };
    }

    return {
      count: existing.count,
      remaining: Math.max(0, this.maxMessages - existing.count),
      resetTime: existing.resetTime,
    };
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const expiredConnections: string[] = [];

    this.connections.forEach((data, connectionId) => {
      if (now >= data.resetTime) {
        expiredConnections.push(connectionId);
      }
    });

    expiredConnections.forEach(connectionId => {
      this.connections.delete(connectionId);
    });
  }

  /**
   * Remove rate limiting data for a specific connection
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Get current statistics
   */
  getStats(): { activeConnections: number; totalMessages: number } {
    let totalMessages = 0;
    this.connections.forEach(data => {
      totalMessages += data.count;
    });

    return {
      activeConnections: this.connections.size,
      totalMessages,
    };
  }
}

/**
 * Validates room names for security and format compliance
 */
export function validateRoomName(room: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic format validation
  if (!room || typeof room !== 'string') {
    errors.push('Room name must be a non-empty string');
    return { isValid: false, errors };
  }

  // Length validation
  if (room.length < 1 || room.length > 100) {
    errors.push('Room name must be between 1 and 100 characters');
  }

  // Character validation - allow alphanumeric, hyphens, underscores, colons
  if (!/^[a-zA-Z0-9:_-]+$/.test(room)) {
    errors.push('Room name contains invalid characters');
  }

  // Prevent path traversal attempts
  if (room.includes('..') || room.includes('//')) {
    errors.push('Room name contains invalid sequences');
  }

  // Validate room type prefixes
  const validPrefixes = ['project:', 'user:', 'team:', 'global:'];
  const hasValidPrefix = validPrefixes.some(prefix => room.startsWith(prefix));

  if (room.includes(':') && !hasValidPrefix) {
    errors.push('Room name has invalid prefix');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates message content for size and format
 */
export function validateMessageContent(content: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if content exists
  if (content === null || content === undefined) {
    errors.push('Message content cannot be null or undefined');
    return { isValid: false, errors };
  }

  // Convert to string for size checking
  const contentStr = JSON.stringify(content);

  // Size validation (10KB limit)
  if (contentStr.length > 10240) {
    errors.push('Message content exceeds maximum size limit');
  }

  // Check for potentially malicious content
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /function\s*\(/i,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(contentStr))) {
    errors.push('Message content contains potentially malicious code');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
