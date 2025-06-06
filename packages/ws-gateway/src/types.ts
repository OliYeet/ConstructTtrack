/**
 * Type definitions for WebSocket Gateway
 */

import { WebSocket } from 'ws';

export interface AuthContext {
  userId: string;
  roles: string[];
  projects: string[];
  email?: string;
  exp: number;
}

export interface AuthenticatedWebSocket extends WebSocket {
  authContext?: AuthContext;
  connectionId: string;
  rooms: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface SubscribeMessage {
  action: 'subscribe';
  room: string;
}

export interface UnsubscribeMessage {
  action: 'unsubscribe';
  room: string;
}

export interface PingMessage {
  action: 'ping';
  timestamp?: number;
}

// Conflict resolution message types - Charlie's strategic guidance
export interface ConflictResolutionMessage {
  action: 'resolve_conflict';
  localState: unknown;
  remoteState: unknown;
  metadata: {
    userId: string;
    organizationId: string;
    workOrderId: string;
    sectionId?: string;
    timestamp: number;
    source: 'local' | 'remote' | 'authoritative';
    connectionQuality?: 'excellent' | 'good' | 'poor' | 'offline';
  };
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | ConflictResolutionMessage;

// Enhanced types for security features - CodeRabbit recommendations

export interface ConnectionMetadata {
  lastActivity: number;
  messageCount: number;
  ipAddress: string;
  userAgent?: string;
}

export interface RateLimitStatus {
  count: number;
  remaining: number;
  resetTime: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  token?: string;
}

export interface ErrorResponse {
  type: 'error';
  code: string;
  message: string;
  timestamp: number;
}

export interface SuccessResponse {
  type: 'connected' | 'subscribed' | 'unsubscribed' | 'pong';
  data: Record<string, unknown>;
  timestamp?: number;
}

export type ServerMessage = ErrorResponse | SuccessResponse;

// Room types for better type safety
export type RoomType = 'project' | 'user' | 'team' | 'global';

export interface ParsedRoom {
  type: RoomType;
  id?: string;
}

// Gateway statistics for monitoring
export interface GatewayStats {
  connections: number;
  rooms: number;
  ipConnections: number;
  uptime: number;
  messagesProcessed: number;
  errorsCount: number;
}
