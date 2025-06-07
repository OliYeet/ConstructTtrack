/**
 * Real-time Notification System - Main Export
 *
 * Comprehensive notification system for ConstructTrack's fiber installation workflows.
 * Integrates WebSocket real-time delivery with traditional notification channels.
 */

import type {
  RealtimeEvent,
  EventType,
} from '../../../../../src/types/realtime-protocol';

import {
  FIBER_NOTIFICATION_TEMPLATES,
  FIBER_NOTIFICATION_PRIORITIES,
  createFiberNotificationRule,
} from './fiber-notification-templates';
import {
  realtimeNotificationManager,
  type NotificationRecipient,
  type NotificationRule,
} from './realtime-notification-manager';
import { webSocketNotificationBridge } from './websocket-integration';

import { notificationService } from '@/lib/alerts/notification-service';
import { getLogger } from '@/lib/logging';

// Re-export types for convenience
export type {
  NotificationRecipient,
  NotificationRule,
  UserRole,
  NotificationPriority,
  RealtimeNotificationConfig,
  WebSocketNotification,
} from './realtime-notification-manager';

export type {
  WebSocketClient,
  DeliveryResult,
  WebSocketNotificationGateway,
} from './websocket-integration';

// Notification system configuration
export interface NotificationSystemConfig {
  enableWebSocket: boolean;
  enableBatching: boolean;
  batchWindow: number;
  maxBatchSize: number;
  enableEscalation: boolean;
  escalationDelay: number;
  autoSetupFiberRules: boolean;
}

/**
 * Main Notification System Class
 */
export class NotificationSystem {
  private config: NotificationSystemConfig;
  private logger = getLogger();
  private isInitialized = false;

  constructor(config: Partial<NotificationSystemConfig> = {}) {
    this.config = {
      enableWebSocket: true,
      enableBatching: true,
      batchWindow: 5000,
      maxBatchSize: 10,
      enableEscalation: true,
      escalationDelay: 300000,
      autoSetupFiberRules: true,
      ...config,
    };
  }

  /**
   * Initialize the notification system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Notification system already initialized');
      return;
    }

    try {
      this.logger.info('Initializing notification system', {
        metadata: { config: this.config },
      });

      // Configure the real-time notification manager
      realtimeNotificationManager.setWebSocketGateway(
        webSocketNotificationBridge
      );

      // Auto-setup fiber workflow notification rules if enabled
      if (this.config.autoSetupFiberRules) {
        this.setupDefaultFiberRules();
      }

      this.isInitialized = true;
      this.logger.info('Notification system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize notification system', {
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Set up default notification rules for fiber workflow events
   */
  private setupDefaultFiberRules(): void {
    const fiberEventTypes: EventType[] = [
      'FiberSectionStarted',
      'CablePulled',
      'SpliceCompleted',
      'InspectionPassed',
      'SectionClosed',
      'WorkOrderUpdated',
      'FiberSectionProgress',
      'FiberSectionFailed',
      'SpliceFailed',
      'InspectionFailed',
    ];

    const roles = [
      'foreman',
      'technician',
      'supervisor',
      'admin',
      'customer',
    ] as const;
    const defaultChannels = ['websocket', 'email']; // Default channels

    for (const eventType of fiberEventTypes) {
      for (const role of roles) {
        const rule = createFiberNotificationRule(
          eventType,
          role,
          defaultChannels,
          `default-${eventType}-${role}`
        );

        realtimeNotificationManager.addRule(rule);
      }
    }

    this.logger.info('Default fiber notification rules set up', {
      metadata: {
        eventTypes: fiberEventTypes.length,
        roles: roles.length,
        totalRules: fiberEventTypes.length * roles.length,
      },
    });
  }

  /**
   * Connect WebSocket gateway for real-time delivery
   */
  connectWebSocketGateway(gateway: unknown): void {
    webSocketNotificationBridge.setWebSocketGateway(gateway);
    this.logger.info('WebSocket gateway connected to notification system');
  }

  /**
   * Process a real-time event and trigger notifications
   */
  async processEvent(
    event: RealtimeEvent,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    await realtimeNotificationManager.processEvent(event, recipients);
  }

  /**
   * Add a custom notification rule
   */
  addRule(rule: NotificationRule): void {
    realtimeNotificationManager.addRule(rule);
  }

  /**
   * Remove a notification rule
   */
  removeRule(ruleId: string): void {
    realtimeNotificationManager.removeRule(ruleId);
  }

  /**
   * Register a WebSocket client for real-time notifications
   */
  registerWebSocketClient(client: {
    id: string;
    userId: string;
    connectionId: string;
    isConnected: boolean;
    subscriptions?: string[];
  }): void {
    webSocketNotificationBridge.registerClient({
      ...client,
      lastActivity: Date.now(),
      subscriptions: new Set(client.subscriptions || []),
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterWebSocketClient(connectionId: string): void {
    webSocketNotificationBridge.unregisterClient(connectionId);
  }

  /**
   * Check if user is online for real-time notifications
   */
  isUserOnline(userId: string): boolean {
    return webSocketNotificationBridge.isUserOnline(userId);
  }

  /**
   * Get online users
   */
  getOnlineUsers(): string[] {
    return webSocketNotificationBridge.getOnlineUsers();
  }

  /**
   * Send a direct notification (bypassing event processing)
   */
  async sendDirectNotification(
    title: string,
    message: string,
    recipients: NotificationRecipient[],
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<void> {
    // Create a synthetic event for direct notifications
    const syntheticEvent: RealtimeEvent = {
      id: `direct-${Date.now()}`,
      type: 'WorkOrderUpdated',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'direct',
      userId: 'system',
      payload: {
        status: 'notification',
        progressPercentage: 0,
        updatedFields: ['notification'],
        previousValues: {},
        newValues: { title, message },
      },
    };

    // Create a custom rule for this notification
    const rule: NotificationRule = {
      id: `direct-${Date.now()}`,
      name: 'Direct Notification',
      eventTypes: ['WorkOrderUpdated'],
      roles: recipients.map(r => r.role),
      channels: ['websocket', 'email'],
      template: {
        title,
        message,
        variables: [],
      },
      priority,
      enabled: true,
    };

    // Temporarily add the rule
    realtimeNotificationManager.addRule(rule);

    try {
      await realtimeNotificationManager.processEvent(
        syntheticEvent,
        recipients
      );
    } finally {
      // Clean up the temporary rule
      realtimeNotificationManager.removeRule(rule.id);
    }
  }

  /**
   * Get system statistics
   */
  getStats(): {
    webSocket: {
      totalClients: number;
      totalUsers: number;
      averageConnectionsPerUser: number;
      totalSubscriptions: number;
    };
    traditional: {
      totalChannels: number;
      enabledChannels: number;
    };
  } {
    const wsStats = webSocketNotificationBridge.getStats();
    const traditionalChannels = notificationService.getChannels();

    return {
      webSocket: wsStats,
      traditional: {
        totalChannels: traditionalChannels.length,
        enabledChannels: traditionalChannels.filter(c => c.enabled).length,
      },
    };
  }

  /**
   * Cleanup inactive connections and resources
   */
  cleanup(): void {
    webSocketNotificationBridge.cleanupInactiveConnections();
    this.logger.info('Notification system cleanup completed');
  }

  /**
   * Shutdown the notification system
   */
  shutdown(): void {
    realtimeNotificationManager.destroy();
    webSocketNotificationBridge.shutdown();
    this.isInitialized = false;
    this.logger.info('Notification system shutdown');
  }
}

// Global notification system instance
const globalNotificationSystem = new NotificationSystem();

// Convenience functions for common operations
export const NotificationAPI = {
  /**
   * Initialize the notification system
   */
  initialize: (config?: Partial<NotificationSystemConfig>) => {
    if (config) {
      return new NotificationSystem(config).initialize();
    }
    return globalNotificationSystem.initialize();
  },

  /**
   * Process a fiber installation event
   */
  processFiberEvent: (
    event: RealtimeEvent,
    recipients: NotificationRecipient[]
  ) => {
    return globalNotificationSystem.processEvent(event, recipients);
  },

  /**
   * Send a direct notification
   */
  sendNotification: (
    title: string,
    message: string,
    recipients: NotificationRecipient[],
    priority?: 'low' | 'normal' | 'high' | 'critical'
  ) => {
    return globalNotificationSystem.sendDirectNotification(
      title,
      message,
      recipients,
      priority
    );
  },

  /**
   * Register WebSocket client
   */
  registerClient: (client: {
    id: string;
    userId: string;
    connectionId: string;
    isConnected: boolean;
    subscriptions?: string[];
  }) => {
    return globalNotificationSystem.registerWebSocketClient(client);
  },

  /**
   * Unregister WebSocket client
   */
  unregisterClient: (connectionId: string) => {
    return globalNotificationSystem.unregisterWebSocketClient(connectionId);
  },

  /**
   * Check if user is online
   */
  isUserOnline: (userId: string) => {
    return globalNotificationSystem.isUserOnline(userId);
  },

  /**
   * Get system statistics
   */
  getStats: () => {
    return globalNotificationSystem.getStats();
  },

  /**
   * Connect WebSocket gateway
   */
  connectWebSocket: (gateway: unknown) => {
    return globalNotificationSystem.connectWebSocketGateway(gateway);
  },
};

// Export the global instance and API
export {
  globalNotificationSystem as notificationSystem,
  FIBER_NOTIFICATION_TEMPLATES,
  FIBER_NOTIFICATION_PRIORITIES,
  createFiberNotificationRule,
};
export default NotificationAPI;
