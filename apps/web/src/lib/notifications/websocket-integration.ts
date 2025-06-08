/**
 * WebSocket Integration for Real-time Notifications
 *
 * Provides integration between the notification manager and WebSocket gateway
 * for instant delivery of notifications to connected clients.
 */

import type { WebSocketNotification } from './realtime-notification-manager';

import { getLogger } from '@/lib/logging';
import { RealtimeMonitoring } from '@/lib/monitoring/realtime-index';

// Constants
const DEFAULT_INACTIVE_CONNECTION_TIMEOUT_MS = 300000; // 5 minutes

// WebSocket client interface for notifications
export interface WebSocketClient {
  id: string;
  userId: string;
  connectionId: string;
  isConnected: boolean;
  lastActivity: number;
  subscriptions: Set<string>; // channel subscriptions
}

// WebSocket notification delivery result
export interface DeliveryResult {
  success: boolean;
  clientId: string;
  latency?: number;
  error?: string;
}

// WebSocket notification gateway interface
export interface WebSocketNotificationGateway {
  // Send notification to specific user
  sendToUser(
    userId: string,
    notification: WebSocketNotification
  ): Promise<DeliveryResult[]>;

  // Send notification to specific channel/room
  sendToChannel(
    channel: string,
    notification: WebSocketNotification
  ): Promise<DeliveryResult[]>;

  // Send raw message to connection (for external gateway compatibility)
  sendMessage(connectionId: string, message: unknown): Promise<void>;

  // Get online users
  getOnlineUsers(): string[];

  // Check if user is online
  isUserOnline(userId: string): boolean;

  // Get user's active connections
  getUserConnections(userId: string): WebSocketClient[];
}

/**
 * WebSocket Notification Bridge
 *
 * Bridges the notification manager with the WebSocket gateway
 * for real-time notification delivery.
 */
export class WebSocketNotificationBridge
  implements WebSocketNotificationGateway
{
  private clients = new Map<string, WebSocketClient>();
  private userConnections = new Map<string, Set<string>>(); // userId -> connectionIds
  private logger = getLogger();

  // External WebSocket gateway (injected)
  private wsGateway: {
    sendMessage: (connectionId: string, message: unknown) => Promise<void>;
  } | null = null;

  constructor() {
    this.logger.info('WebSocket notification bridge initialized');
  }

  /**
   * Set the external WebSocket gateway instance
   */
  setWebSocketGateway(gateway: {
    sendMessage: (connectionId: string, message: unknown) => Promise<void>;
  }): void {
    this.wsGateway = gateway;
    this.logger.info('WebSocket gateway connected to notification bridge');
  }

  /**
   * Register a new WebSocket client
   */
  registerClient(client: WebSocketClient): void {
    this.clients.set(client.connectionId, client);

    // Track user connections
    if (!this.userConnections.has(client.userId)) {
      this.userConnections.set(client.userId, new Set());
    }
    const connections = this.userConnections.get(client.userId);
    if (connections) {
      connections.add(client.connectionId);
    }

    this.logger.info('WebSocket client registered for notifications', {
      metadata: {
        clientId: client.id,
        userId: client.userId,
        connectionId: client.connectionId,
        totalClients: this.clients.size,
      },
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    this.clients.delete(connectionId);

    // Remove from user connections
    const userConnections = this.userConnections.get(client.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(client.userId);
      }
    }

    this.logger.info('WebSocket client unregistered from notifications', {
      metadata: {
        clientId: client.id,
        userId: client.userId,
        connectionId,
        totalClients: this.clients.size,
      },
    });
  }

  /**
   * Send notification to specific user
   */
  async sendToUser(
    userId: string,
    notification: WebSocketNotification
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    try {
      // Track notification sending
      const eventId = RealtimeMonitoring.trackEvent(
        'websocket_notification',
        `user:${userId}`,
        { notificationId: notification.id, userId }
      );

      const userConnections = this.userConnections.get(userId);
      if (!userConnections || userConnections.size === 0) {
        this.logger.debug('No active connections for user', {
          metadata: { userId, notificationId: notification.id },
        });

        return [
          {
            success: false,
            clientId: userId,
            error: 'User not connected',
          },
        ];
      }

      // Send to all user's connections
      for (const connectionId of userConnections) {
        const client = this.clients.get(connectionId);
        if (!client || !client.isConnected) continue;

        try {
          const deliveryResult = await this.sendToClient(client, notification);
          results.push(deliveryResult);

          if (deliveryResult.success) {
            this.logger.info('Notification delivered via WebSocket', {
              metadata: {
                notificationId: notification.id,
                userId,
                connectionId,
                latency: deliveryResult.latency,
              },
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          results.push({
            success: false,
            clientId: connectionId,
            error: errorMessage,
          });
        }
      }

      // Update monitoring
      RealtimeMonitoring.eventReceived(eventId);

      return results;
    } catch (error) {
      this.logger.error('Failed to send notification to user', {
        metadata: {
          userId,
          notificationId: notification.id,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return [
        {
          success: false,
          clientId: userId,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }

  /**
   * Send notification to specific channel/room
   */
  async sendToChannel(
    channel: string,
    notification: WebSocketNotification
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    try {
      // Track channel notification
      const eventId = RealtimeMonitoring.trackEvent(
        'websocket_channel_notification',
        channel,
        { notificationId: notification.id, channel }
      );

      // Find clients subscribed to the channel
      const subscribedClients = Array.from(this.clients.values()).filter(
        client => client.isConnected && client.subscriptions.has(channel)
      );

      if (subscribedClients.length === 0) {
        this.logger.debug('No clients subscribed to channel', {
          metadata: { channel, notificationId: notification.id },
        });

        return [
          {
            success: false,
            clientId: channel,
            error: 'No subscribers',
          },
        ];
      }

      // Send to all subscribed clients
      for (const client of subscribedClients) {
        try {
          const deliveryResult = await this.sendToClient(client, notification);
          results.push(deliveryResult);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          results.push({
            success: false,
            clientId: client.connectionId,
            error: errorMessage,
          });
        }
      }

      // Update monitoring
      RealtimeMonitoring.eventReceived(eventId);

      return results;
    } catch (error) {
      this.logger.error('Failed to send notification to channel', {
        metadata: {
          channel,
          notificationId: notification.id,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return [
        {
          success: false,
          clientId: channel,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }

  /**
   * Send raw message to connection (for external gateway compatibility)
   */
  async sendMessage(connectionId: string, message: unknown): Promise<void> {
    if (!this.wsGateway) {
      throw new Error('WebSocket gateway not available');
    }

    await this.wsGateway.sendMessage(connectionId, message);
  }

  /**
   * Send notification to a specific client
   */
  private async sendToClient(
    client: WebSocketClient,
    notification: WebSocketNotification
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.wsGateway) {
        throw new Error('WebSocket gateway not available');
      }

      // Use the external WebSocket gateway to send the message
      await this.wsGateway.sendMessage(client.connectionId, {
        type: 'notification',
        data: notification,
      });

      // Update client activity timestamp after successful send
      client.lastActivity = Date.now();

      const latency = Date.now() - startTime;

      return {
        success: true,
        clientId: client.connectionId,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        clientId: client.connectionId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    const connections = this.userConnections.get(userId);
    return connections ? connections.size > 0 : false;
  }

  /**
   * Get user's active connections
   */
  getUserConnections(userId: string): WebSocketClient[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map(id => this.clients.get(id))
      .filter(
        (client): client is WebSocketClient => client?.isConnected ?? false
      );
  }

  /**
   * Subscribe client to channel
   */
  subscribeToChannel(connectionId: string, channel: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.subscriptions.add(channel);
      this.logger.debug('Client subscribed to channel', {
        metadata: { connectionId, channel, userId: client.userId },
      });
    }
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribeFromChannel(connectionId: string, channel: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.subscriptions.delete(channel);
      this.logger.debug('Client unsubscribed from channel', {
        metadata: { connectionId, channel, userId: client.userId },
      });
    }
  }

  /**
   * Get statistics about connected clients
   */
  getStats(): {
    totalClients: number;
    totalUsers: number;
    averageConnectionsPerUser: number;
    totalSubscriptions: number;
  } {
    const totalClients = this.clients.size;
    const totalUsers = this.userConnections.size;
    const totalSubscriptions = Array.from(this.clients.values()).reduce(
      (sum, client) => sum + client.subscriptions.size,
      0
    );

    return {
      totalClients,
      totalUsers,
      averageConnectionsPerUser: totalUsers > 0 ? totalClients / totalUsers : 0,
      totalSubscriptions,
    };
  }

  /**
   * Cleanup inactive connections
   */
  cleanupInactiveConnections(
    maxInactiveTime: number = DEFAULT_INACTIVE_CONNECTION_TIMEOUT_MS
  ): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [connectionId, client] of this.clients.entries()) {
      if (now - client.lastActivity > maxInactiveTime) {
        this.unregisterClient(connectionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up inactive WebSocket connections', {
        metadata: { cleanedCount, totalClients: this.clients.size },
      });
    }

    return cleanedCount;
  }

  /**
   * Shutdown the bridge
   */
  shutdown(): void {
    this.clients.clear();
    this.userConnections.clear();
    this.wsGateway = null;
    this.logger.info('WebSocket notification bridge shutdown');
  }
}

// Global instance
export const webSocketNotificationBridge = new WebSocketNotificationBridge();
