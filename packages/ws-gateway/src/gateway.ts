/**
 * WebSocket Gateway Core Implementation
 * Following Charlie's containerized deployment strategy
 */

import { createServer } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

import { verifyToken, generateConnectionId } from './auth';
import { config } from './config';
import type {
  AuthenticatedWebSocket,
  ClientMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
} from './types';
import { logger } from './utils/logger';

export class WebSocketGateway {
  private wss: WebSocketServer;
  private server: ReturnType<typeof createServer>;
  private connections = new Map<string, AuthenticatedWebSocket>();
  private rooms = new Map<string, Set<AuthenticatedWebSocket>>();

  constructor() {
    // Create HTTP server for health checks
    this.server = createServer((req, res) => {
      if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            connections: this.connections.size,
            rooms: this.rooms.size,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
    });

    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws as AuthenticatedWebSocket, req);
    });

    this.wss.on('error', error => {
      logger.error('WebSocket server error:', error);
    });
  }

  private handleConnection(
    ws: AuthenticatedWebSocket,
    req: { url?: string }
  ): void {
    const url = req.url || '';
    const token = this.extractTokenFromUrl(url);

    if (!token) {
      logger.warn('Connection rejected: No token provided');
      ws.close(1008, 'Authentication required');
      return;
    }

    const authContext = verifyToken(token);
    if (!authContext) {
      logger.warn('Connection rejected: Invalid token');
      ws.close(1008, 'Invalid token');
      return;
    }

    // Initialize authenticated WebSocket
    ws.authContext = authContext;
    ws.connectionId = generateConnectionId();
    ws.rooms = new Set();

    this.connections.set(ws.connectionId, ws);

    logger.info('Client connected', {
      connectionId: ws.connectionId,
      userId: authContext.userId,
    });

    // Setup message handlers
    ws.on('message', data => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnection(ws));
    ws.on('error', error => this.handleError(ws, error));

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      data: { connectionId: ws.connectionId },
    });
  }

  private extractTokenFromUrl(url: string): string | null {
    try {
      const urlObj = new globalThis.URL(url, 'ws://localhost');
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private handleMessage(
    ws: AuthenticatedWebSocket,
    data: Buffer | ArrayBuffer | Buffer[]
  ): void {
    try {
      const dataString =
        data instanceof ArrayBuffer
          ? new globalThis.TextDecoder().decode(data)
          : Array.isArray(data)
            ? Buffer.concat(data).toString()
            : data.toString();
      const message: ClientMessage = JSON.parse(dataString);

      switch (message.action) {
        case 'subscribe':
          this.handleSubscribe(ws, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message);
          break;
        case 'ping':
          this.handlePing(ws, message);
          break;
        default:
          logger.warn('Unknown message action', {
            action: (message as ClientMessage).action,
          });
      }
    } catch (error) {
      logger.error('Failed to parse message', {
        error,
        connectionId: ws.connectionId,
      });
    }
  }

  private handleSubscribe(
    ws: AuthenticatedWebSocket,
    message: SubscribeMessage
  ): void {
    const { room } = message;

    // Validate room access based on auth context
    if (!this.canAccessRoom(ws, room)) {
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Access denied to room', room },
      });
      return;
    }

    // Add to room
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room)?.add(ws);
    ws.rooms.add(room);

    logger.info('Client subscribed to room', {
      connectionId: ws.connectionId,
      room,
    });

    this.sendMessage(ws, {
      type: 'subscribed',
      data: { room },
    });
  }

  private handleUnsubscribe(
    ws: AuthenticatedWebSocket,
    message: UnsubscribeMessage
  ): void {
    const { room } = message;

    this.removeFromRoom(ws, room);

    this.sendMessage(ws, {
      type: 'unsubscribed',
      data: { room },
    });
  }

  private handlePing(ws: AuthenticatedWebSocket, _message: PingMessage): void {
    this.sendMessage(ws, {
      type: 'pong',
      data: { timestamp: Date.now() },
    });
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    logger.info('Client disconnected', { connectionId: ws.connectionId });

    // Remove from all rooms
    ws.rooms.forEach(room => this.removeFromRoom(ws, room));

    // Remove from connections
    this.connections.delete(ws.connectionId);
  }

  private handleError(ws: AuthenticatedWebSocket, error: Error): void {
    logger.error('WebSocket error', {
      connectionId: ws.connectionId,
      error: error.message,
    });
  }

  private canAccessRoom(ws: AuthenticatedWebSocket, room: string): boolean {
    // Basic room access control based on Charlie's auth strategy
    const { authContext } = ws;

    if (!authContext) {
      return false;
    }

    // Project-based room access
    if (room.startsWith('project:')) {
      const projectId = room.split(':')[1];
      return authContext.projects.includes(projectId);
    }

    // User-specific rooms
    if (room.startsWith('user:')) {
      const userId = room.split(':')[1];
      return authContext.userId === userId;
    }

    // Public rooms (for now, restrict to authenticated users)
    return true;
  }

  private removeFromRoom(ws: AuthenticatedWebSocket, room: string): void {
    const roomConnections = this.rooms.get(room);
    if (roomConnections) {
      roomConnections.delete(ws);
      if (roomConnections.size === 0) {
        this.rooms.delete(room);
      }
    }
    ws.rooms.delete(room);
  }

  private sendMessage(
    ws: AuthenticatedWebSocket,
    message: Record<string, unknown>
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public broadcastToRoom(room: string, message: Record<string, unknown>): void {
    const roomConnections = this.rooms.get(room);
    if (roomConnections) {
      roomConnections.forEach(ws => this.sendMessage(ws, message));
    }
  }

  public start(port: number = config.server.port): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(port, () => {
        logger.info(`WebSocket Gateway started on port ${port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise(resolve => {
      this.wss.close(() => {
        this.server.close(() => {
          logger.info('WebSocket Gateway stopped');
          resolve();
        });
      });
    });
  }
}
