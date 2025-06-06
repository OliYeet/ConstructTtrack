/**
 * WebSocket Gateway Core Implementation
 * Following Charlie's containerized deployment strategy
 */

import { createServer } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

import { verifyToken, generateConnectionId } from './auth';
import { config } from './config';
import { ErrorFactory, ErrorHandler, type GatewayError } from './errors';
import { cacheManager } from './optimization/cache-manager';
import { connectionOptimizer } from './optimization/connection-optimizer';
import { messageOptimizer } from './optimization/message-optimizer';
import { performanceProfiler } from './optimization/performance-profiler';
import { regressionDetector } from './optimization/regression-detector';
import type {
  AuthenticatedWebSocket,
  ClientMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
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
    // Start optimization components
    performanceProfiler.start();
    connectionOptimizer.start();
    regressionDetector.start();

    // Create HTTP server for health checks
    this.server = createServer((req, res) => {
      if (req.url === '/healthz') {
        const stats = performanceProfiler.getPerformanceSummary();
        const cacheStats = cacheManager.getStats();
        const connectionStats = connectionOptimizer.getPoolStats();
        const optimizationStats = messageOptimizer.getOptimizationStats();
        const regressionSummary = regressionDetector.getRegressionSummary();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            connections: this.connections.size,
            rooms: this.rooms.size,
            timestamp: new Date().toISOString(),
            performance: stats,
            cache: cacheStats,
            connectionPool: connectionStats,
            messageOptimization: optimizationStats,
            regressionDetection: regressionSummary,
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

      // Track connection in optimizer
      connectionOptimizer.trackConnection(ws.connectionId);

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
    performanceProfiler.timeOperation(
      'handle_message',
      () => {
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

          // Track activity in connection optimizer
          connectionOptimizer.updateActivity(
            ws.connectionId,
            dataString.length
          );

          // Parse and validate message
          const dataString = performanceProfiler.timeOperation(
            'message_parse',
            () => {
              return data instanceof ArrayBuffer
                ? new globalThis.TextDecoder().decode(data)
                : Array.isArray(data)
                  ? Buffer.concat(data).toString()
                  : data.toString();
            }
          );

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
      },
      { connectionId: ws.connectionId }
    );
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

    // Remove from connection optimizer tracking
    connectionOptimizer.removeConnection(ws.connectionId);

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

  private async sendMessage(
    ws: AuthenticatedWebSocket,
    message: Record<string, unknown>
  ): Promise<void> {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    await performanceProfiler.timeAsyncOperation(
      'send_message',
      async () => {
        try {
          // Create optimized message
          const optimizedMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            type: (message.type as string) || 'unknown',
            data: message,
            timestamp: Date.now(),
            priority: 'normal' as const,
          };

          // Optimize message (compression, batching, etc.)
          const result = await messageOptimizer.optimizeMessage(
            optimizedMessage,
            ws.connectionId
          );

          // Send the optimized message
          const messageStr = JSON.stringify(result);
          ws.send(messageStr);
        } catch (error) {
          // Fallback to simple send if optimization fails
          logger.warn('Message optimization failed, using fallback', {
            connectionId: ws.connectionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          ws.send(JSON.stringify(message));
        }
      },
      { connectionId: ws.connectionId, messageType: message.type as string }
    );
  }

  public async broadcastToRoom(
    room: string,
    message: Record<string, unknown>
  ): Promise<void> {
    const roomConnections = this.rooms.get(room);
    if (roomConnections) {
      // Send messages in parallel for better performance
      const sendPromises = Array.from(roomConnections).map(ws =>
        this.sendMessage(ws, message)
      );
      await Promise.allSettled(sendPromises);
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

  public async stop(): Promise<void> {
    // Stop optimization components first
    performanceProfiler.stop();
    connectionOptimizer.stop();
    regressionDetector.stop();
    messageOptimizer.clearCaches();
    await cacheManager.close();

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
