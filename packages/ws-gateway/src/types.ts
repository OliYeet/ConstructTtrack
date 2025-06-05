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
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;
