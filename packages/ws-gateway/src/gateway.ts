/**
 * WebSocket Gateway Core Implementation
 * Following Charlie's containerized deployment strategy
 */

import { createServer } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

import { verifyToken, generateConnectionId } from './auth';
import { config } from './config';
import {
  createConflictEngine,
  isConflictResolutionEnabled,
  type ConflictEngine,
} from './conflict-engine';
import { ErrorFactory, ErrorHandler, type GatewayError } from './errors';
import type {
  AuthenticatedWebSocket,
  ClientMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  ConflictResolutionMessage,
} from './types';
import { logger } from './utils/logger';
import {
  validateClientMessage,
  validateConnectionParams,
  MessageRateLimiter,
} from './validation';

export class WebSocketGateway {
  private wss: WebSocketServer;
  private server: ReturnType<typeof createServer>;
  private connections = new Map<string, AuthenticatedWebSocket>();
  private rooms = new Map<string, Set<AuthenticatedWebSocket>>();

  // Conflict resolution engine - Charlie's strategic guidance
  private conflictEngine: ConflictEngine;

  // Enhanced security and performance features - CodeRabbit recommendations
  private rateLimiter = new MessageRateLimiter(
    config.server.rateLimitMax,
    config.server.rateLimitWindow
  );
  private connectionLimiter = new Map<string, number>(); // Track connections per IP
  private heartbeatInterval: ReturnType<typeof globalThis.setInterval> | null =
    null;
  private cleanupInterval: ReturnType<typeof globalThis.setInterval> | null =
    null;

  // WeakMap for better memory management - CodeRabbit recommendation
  private connectionMetadata = new WeakMap<
    AuthenticatedWebSocket,
    {
      lastActivity: number;
      messageCount: number;
      ipAddress: string;
    }
  >();

  constructor() {
    // Initialize conflict engine with feature flag
    this.conflictEngine = createConflictEngine({
      enableConflictResolution: isConflictResolutionEnabled(),
    });

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
    this.startHeartbeat();
    this.startCleanupTasks();
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
    req: import('http').IncomingMessage
  ): void {
    const url = req.url || '';
    const ipAddress = req.socket.remoteAddress || 'unknown';

    try {
      // Check global connection limit - Charlie's requirement
      if (this.connections.size >= config.websocket.maxConnections) {
        const error = ErrorFactory.rateLimit('Maximum connections exceeded');
        logger.warn(error.message, {
          ipAddress,
          currentConnections: this.connections.size,
          maxConnections: config.websocket.maxConnections,
        });
        ws.close(1013, 'Try again later');
        return;
      }

      // Enhanced connection validation - CodeRabbit security recommendations
      const validation = validateConnectionParams(url);
      if (!validation.isValid) {
        const error = ErrorFactory.validation(
          `Connection validation failed: ${validation.errors.join(', ')}`
        );
        logger.warn(error.message, { ipAddress, errors: validation.errors });
        ws.close(1008, 'Invalid connection parameters');
        return;
      }

      // Rate limiting per IP address
      const currentConnections = this.connectionLimiter.get(ipAddress) || 0;
      if (currentConnections >= config.server.maxConnectionsPerIP) {
        const error = ErrorFactory.rateLimit(
          `Too many connections from IP: ${ipAddress}`
        );
        logger.warn(error.message, { ipAddress, currentConnections });
        ws.close(1008, 'Connection limit exceeded');
        return;
      }

      if (!validation.token) {
        const error = ErrorFactory.authentication(
          'Missing authentication token'
        );
        logger.warn(error.message, { ipAddress });
        ws.close(1008, 'Authentication failed');
        return;
      }

      const authContext = verifyToken(validation.token);
      if (!authContext) {
        const error = ErrorFactory.authentication('Invalid or expired token');
        logger.warn(error.message, { ipAddress });
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Rate limiting per IP address
      const ipConnections = this.connectionLimiter.get(ipAddress) || 0;
      if (ipConnections >= config.server.maxConnectionsPerIP) {
        const error = ErrorFactory.rateLimit(
          `Too many connections from IP: ${ipAddress}`
        );
        logger.warn(error.message, {
          ipAddress,
          currentConnections: ipConnections,
        });
        ws.close(1008, 'Connection limit exceeded');
        return;
      }

      // Initialize authenticated WebSocket with enhanced metadata
      ws.authContext = authContext;
      ws.connectionId = generateConnectionId();
      ws.rooms = new Set();

      // Track connection metadata for memory management and monitoring
      this.connectionMetadata.set(ws, {
        lastActivity: Date.now(),
        messageCount: 0,
        ipAddress,
      });

      // Update connection counters
      this.connectionLimiter.set(ipAddress, ipConnections + 1);
    } catch (error) {
      const gatewayError = ErrorHandler.normalize(
        error,
        'Connection handling failed'
      );
      logger.error(gatewayError.message, ErrorHandler.toLogEntry(gatewayError));
      ws.close(1011, 'Internal server error');
      return;
    }
    this.connections.set(ws.connectionId, ws);

    logger.info('Client connected', {
      connectionId: ws.connectionId,
      userId: ws.authContext.userId,
      ipAddress,
      totalConnections: this.connections.size,
    });

    // Setup message handlers
    ws.on('message', data => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnection(ws));
    ws.on('error', error => this.handleError(ws, error));
    ws.on('pong', () => {
      // Update activity on pong response
      const metadata = this.connectionMetadata.get(ws);
      if (metadata) {
        metadata.lastActivity = Date.now();
      }
    });

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
      // Rate limiting check - CodeRabbit security recommendation
      if (!this.rateLimiter.isAllowed(ws.connectionId)) {
        const error = ErrorFactory.rateLimit('Message rate limit exceeded');
        this.sendErrorMessage(ws, error);
        return;
      }

      // Update activity tracking
      const metadata = this.connectionMetadata.get(ws);
      if (metadata) {
        metadata.lastActivity = Date.now();
        metadata.messageCount++;
      }

      // Parse and validate message
      const dataString =
        data instanceof ArrayBuffer
          ? new globalThis.TextDecoder().decode(data)
          : Array.isArray(data)
            ? Buffer.concat(data).toString()
            : data.toString();

      // Prevent DoS attacks with overly large messages
      if (dataString.length > 10000) {
        const error = ErrorFactory.validation('Message too large');
        this.sendErrorMessage(ws, error);
        return;
      }

      const rawMessage = JSON.parse(dataString);

      // Comprehensive message validation - CodeRabbit recommendation
      if (!validateClientMessage(rawMessage)) {
        const error = ErrorFactory.validation('Invalid message format');
        this.sendErrorMessage(ws, error);
        return;
      }

      const message = rawMessage as ClientMessage;

      switch (message.action) {
        case 'subscribe': {
          this.handleSubscribe(ws, message);
          break;
        }
        case 'unsubscribe': {
          this.handleUnsubscribe(ws, message);
          break;
        }
        case 'ping': {
          this.handlePing(ws, message);
          break;
        }
        case 'resolve_conflict': {
          this.handleConflictResolution(ws, message);
          break;
        }
        default: {
          const error = ErrorFactory.validation(
            `Unknown action: ${(message as { action: string }).action}`
          );
          this.sendErrorMessage(ws, error);
        }
      }
    } catch (error) {
      const gatewayError = ErrorHandler.normalize(
        error,
        'Message handling failed'
      );
      logger.error(
        gatewayError.message,
        ErrorHandler.toLogEntry(gatewayError, ws.connectionId)
      );
      this.sendErrorMessage(ws, gatewayError);
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

  private async handleConflictResolution(
    ws: AuthenticatedWebSocket,
    message: ConflictResolutionMessage
  ): Promise<void> {
    try {
      // Check if conflict resolution is enabled
      if (!this.conflictEngine.isEnabled()) {
        this.sendMessage(ws, {
          type: 'conflict_resolution_disabled',
          data: { message: 'Conflict resolution is not enabled' },
        });
        return;
      }

      const { localState, remoteState } = message;

      // Create metadata from authenticated context (don't trust client)
      if (!ws.authContext) {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Authentication required for conflict resolution' },
        });
        return;
      }

      const enhancedMetadata = {
        userId: ws.authContext.userId,
        organizationId: ws.authContext.projects[0] ?? 'unknown',
        workOrderId: 'unknown', // TODO: Extract from authenticated context
        timestamp: Date.now(),
        source: 'local' as const,
        connectionQuality: 'excellent' as const,
      };

      // Detect conflicts using the conflict engine
      const conflictResult = await this.conflictEngine.detectConflict(
        localState,
        remoteState,
        enhancedMetadata
      );

      if (!conflictResult.hasConflict) {
        // No conflicts detected - send success response
        this.sendMessage(ws, {
          type: 'conflict_resolved',
          data: {
            hasConflict: false,
            resolvedValue: remoteState, // Use remote state as authoritative
            strategy: 'no_conflict',
            confidence: 1.0,
          },
        });
        return;
      }

      // Process conflicts in parallel for better performance
      const resolutions = await Promise.all(
        conflictResult.conflicts.map(async conflict => {
          if (conflict.autoResolvable) {
            const resolution =
              await this.conflictEngine.resolveConflict(conflict);
            return {
              conflictId: conflict.id,
              type: conflict.type,
              autoResolved: true,
              resolution,
            };
          } else {
            // Manual resolution required
            return {
              conflictId: conflict.id,
              type: conflict.type,
              autoResolved: false,
              requiresManualResolution: true,
              localValue: conflict.localValue,
              remoteValue: conflict.remoteValue,
            };
          }
        })
      );

      // Send conflict resolution response
      this.sendMessage(ws, {
        type: 'conflict_resolved',
        data: {
          hasConflict: true,
          canAutoResolve: conflictResult.canAutoResolve,
          conflicts: conflictResult.conflicts.length,
          autoResolved: resolutions.filter(r => r.autoResolved).length,
          manualResolutionRequired: resolutions.filter(r => !r.autoResolved)
            .length,
          resolutions,
        },
      });

      // Log conflict resolution for monitoring
      logger.info('Conflict resolution processed', {
        connectionId: ws.connectionId,
        userId: enhancedMetadata.userId,
        conflictsDetected: conflictResult.conflicts.length,
        autoResolved: resolutions.filter(r => !r.requiresManualResolution)
          .length,
        workOrderId: enhancedMetadata.workOrderId,
      });
    } catch (error) {
      const gatewayError = ErrorHandler.normalize(
        error,
        'Conflict resolution failed'
      );
      logger.error(
        gatewayError.message,
        ErrorHandler.toLogEntry(gatewayError, ws.connectionId)
      );
      this.sendErrorMessage(ws, gatewayError);
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    const metadata = this.connectionMetadata.get(ws);
    const ipAddress = metadata?.ipAddress || 'unknown';

    logger.info('Client disconnected', {
      connectionId: ws.connectionId,
      ipAddress,
      messageCount: metadata?.messageCount || 0,
      connectionDuration: metadata ? Date.now() - metadata.lastActivity : 0,
    });

    // Enhanced cleanup - prevent memory leaks
    ws.rooms.forEach(room => this.removeFromRoom(ws, room));
    this.connections.delete(ws.connectionId);

    // Update IP connection counter
    const currentConnections = this.connectionLimiter.get(ipAddress) || 0;
    if (currentConnections > 1) {
      this.connectionLimiter.set(ipAddress, currentConnections - 1);
    } else {
      this.connectionLimiter.delete(ipAddress);
    }

    // WeakMap automatically cleans up metadata when ws is garbage collected
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

    // Public rooms - explicit whitelist for security
    return (
      room.startsWith('public:') ||
      room === 'general' ||
      room === 'announcements'
    );
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
      // Clean up intervals
      if (this.heartbeatInterval) {
        globalThis.clearInterval(this.heartbeatInterval);
      }
      if (this.cleanupInterval) {
        globalThis.clearInterval(this.cleanupInterval);
      }

      this.wss.close(() => {
        this.server.close(() => {
          logger.info('WebSocket Gateway stopped');
          resolve();
        });
      });
    });
  }

  /**
   * Enhanced error message sending - CodeRabbit recommendation
   */
  private sendErrorMessage(
    ws: AuthenticatedWebSocket,
    error: GatewayError
  ): void {
    const errorResponse = ErrorHandler.toClientResponse(error);
    this.sendMessage(ws, errorResponse as unknown as Record<string, unknown>);

    // Log detailed error for debugging
    logger.warn(
      'Sent error to client',
      ErrorHandler.toLogEntry(error, ws.connectionId)
    );
  }

  /**
   * Heartbeat mechanism to detect dead connections - CodeRabbit recommendation
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = globalThis.setInterval(() => {
      const now = Date.now();
      const staleConnections: AuthenticatedWebSocket[] = [];

      this.connections.forEach(ws => {
        const metadata = this.connectionMetadata.get(ws);

        // Send ping frame to check connection health
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }

        if (metadata && now - metadata.lastActivity > 60000) {
          // 60 seconds timeout
          staleConnections.push(ws);
        }
      });

      // Close stale connections
      staleConnections.forEach(ws => {
        logger.info('Closing stale connection', {
          connectionId: ws.connectionId,
        });
        ws.close(1000, 'Connection timeout');
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Periodic cleanup tasks - CodeRabbit recommendation
   */
  private startCleanupTasks(): void {
    this.cleanupInterval = globalThis.setInterval(() => {
      // Clean up rate limiter
      this.rateLimiter.cleanup();

      // Clean up empty rooms
      const emptyRooms: string[] = [];
      this.rooms.forEach((connections, room) => {
        if (connections.size === 0) {
          emptyRooms.push(room);
        }
      });
      emptyRooms.forEach(room => this.rooms.delete(room));

      // Log statistics
      logger.debug('Gateway statistics', {
        connections: this.connections.size,
        rooms: this.rooms.size,
        ipConnections: this.connectionLimiter.size,
      });
    }, 300000); // Every 5 minutes
  }
}
