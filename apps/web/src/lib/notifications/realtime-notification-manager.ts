/**
 * Real-time Notification Manager
 *
 * Extends the existing notification service with real-time capabilities
 * for ConstructTrack's fiber installation workflows.
 *
 * Features:
 * - WebSocket-first delivery with fallback to traditional channels
 * - Smart batching to prevent notification spam
 * - Role-based notification routing
 * - Integration with performance monitoring
 */

import type {
  RealtimeEvent,
  EventType,
} from '../../../../../src/types/realtime-protocol';

import { AlertSeverity } from '@/lib/alerts/alert-manager';
import {
  notificationService,
  type NotificationMessage,
} from '@/lib/alerts/notification-service';
import { getLogger } from '@/lib/logging';
import { RealtimeMonitoring } from '@/lib/monitoring/realtime-index';

// Constants
const DEFAULT_BATCH_WINDOW_MS = 5000; // 5 seconds
const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_ESCALATION_DELAY_MS = 300000; // 5 minutes
const BATCH_PROCESSOR_INTERVAL_MS = 1000; // 1 second

// Real-time notification configuration
export interface RealtimeNotificationConfig {
  enableWebSocket: boolean;
  enableBatching: boolean;
  batchWindow: number; // milliseconds
  maxBatchSize: number;
  enableEscalation: boolean;
  escalationDelay: number; // milliseconds
}

// Notification rule for event-based routing
export interface NotificationRule {
  id: string;
  name: string;
  eventTypes: EventType[];
  roles: UserRole[];
  channels: string[]; // channel IDs
  conditions?: NotificationCondition[];
  template: NotificationTemplate;
  priority: NotificationPriority;
  enabled: boolean;
}

// User roles for notification routing
export type UserRole =
  | 'foreman'
  | 'technician'
  | 'supervisor'
  | 'admin'
  | 'customer';

// Notification priority levels
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

// Notification conditions for smart filtering
export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: unknown;
}

// Notification template for event-based messages
export interface NotificationTemplate {
  title: string;
  message: string;
  variables: string[]; // placeholders like {sectionId}, {technician}
}

// Batched notification group
interface NotificationBatch {
  id: string;
  eventType: EventType;
  notifications: PendingNotification[];
  createdAt: number;
  scheduledAt: number;
}

// Pending notification before delivery
interface PendingNotification {
  id: string;
  event: RealtimeEvent;
  rule: NotificationRule;
  recipients: NotificationRecipient[];
  createdAt: number;
}

// Notification recipient with delivery preferences
export interface NotificationRecipient {
  userId: string;
  role: UserRole;
  channels: string[]; // preferred channel IDs
  isOnline: boolean; // WebSocket connection status
  lastActivity?: number;
}

// WebSocket notification payload
export interface WebSocketNotification {
  id: string;
  type: 'notification';
  event: RealtimeEvent;
  notification: {
    title: string;
    message: string;
    priority: NotificationPriority;
    timestamp: string;
    actionUrl?: string;
  };
}

export class RealtimeNotificationManager {
  private config: RealtimeNotificationConfig;
  private rules: Map<string, NotificationRule> = new Map();
  private batches: Map<string, NotificationBatch> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private logger = getLogger();

  // WebSocket gateway integration (will be injected)
  private webSocketGateway: {
    sendToUser: (
      userId: string,
      notification: WebSocketNotification
    ) => Promise<void>;
  } | null = null;

  constructor(config: Partial<RealtimeNotificationConfig> = {}) {
    this.config = {
      enableWebSocket: true,
      enableBatching: true,
      batchWindow: DEFAULT_BATCH_WINDOW_MS,
      maxBatchSize: DEFAULT_MAX_BATCH_SIZE,
      enableEscalation: true,
      escalationDelay: DEFAULT_ESCALATION_DELAY_MS,
      ...config,
    };

    this.startBatchProcessor();
  }

  /**
   * Set WebSocket gateway for real-time delivery
   */
  setWebSocketGateway(gateway: {
    sendToUser: (
      userId: string,
      notification: WebSocketNotification
    ) => Promise<void>;
  }): void {
    this.webSocketGateway = gateway;
    this.logger.info('WebSocket gateway connected to notification manager');
  }

  /**
   * Add notification rule for event-based routing
   */
  addRule(rule: NotificationRule): void {
    // Input validation
    if (
      !rule.id ||
      !rule.name ||
      !rule.eventTypes.length ||
      !rule.roles.length
    ) {
      throw new Error('Invalid notification rule: missing required fields');
    }

    if (!rule.template.title || !rule.template.message) {
      throw new Error(
        'Invalid notification rule: template must have title and message'
      );
    }

    this.rules.set(rule.id, rule);
    this.logger.info('Notification rule added', {
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        eventTypes: rule.eventTypes,
        roles: rule.roles,
      },
    });
  }

  /**
   * Remove notification rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.logger.info('Notification rule removed', { metadata: { ruleId } });
  }

  /**
   * Process real-time event and trigger notifications
   */
  async processEvent(
    event: RealtimeEvent,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    // Input validation
    if (!event || !event.id || !event.type) {
      throw new Error('Invalid event: missing required fields');
    }

    if (!recipients || recipients.length === 0) {
      this.logger.debug('No recipients provided for event', {
        metadata: { eventType: event.type, eventId: event.id },
      });
      return;
    }

    const startTime = Date.now();

    try {
      // Track event processing
      const eventId = RealtimeMonitoring.trackEvent(
        'notification_processing',
        `event:${event.type}`,
        { eventId: event.id, recipientCount: recipients.length }
      );

      // Find matching notification rules
      const matchingRules = this.findMatchingRules(event);

      if (matchingRules.length === 0) {
        this.logger.debug('No notification rules matched event', {
          metadata: { eventType: event.type, eventId: event.id },
        });
        return;
      }

      // Create pending notifications
      const pendingNotifications: PendingNotification[] = [];

      for (const rule of matchingRules) {
        if (!rule.enabled) continue;

        // Filter recipients by role
        const filteredRecipients = recipients.filter(recipient =>
          rule.roles.includes(recipient.role)
        );

        if (filteredRecipients.length > 0) {
          pendingNotifications.push({
            id: `${event.id}-${rule.id}`,
            event,
            rule,
            recipients: filteredRecipients,
            createdAt: Date.now(),
          });
        }
      }

      // Process notifications based on priority and batching settings
      await this.processNotifications(pendingNotifications);

      // Update monitoring
      RealtimeMonitoring.eventReceived(eventId);

      this.logger.info('Event processed for notifications', {
        metadata: {
          eventType: event.type,
          eventId: event.id,
          rulesMatched: matchingRules.length,
          notificationsCreated: pendingNotifications.length,
          processingTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      this.logger.error('Failed to process event for notifications', {
        metadata: {
          eventType: event.type,
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Find notification rules that match the given event
   */
  private findMatchingRules(event: RealtimeEvent): NotificationRule[] {
    const matchingRules: NotificationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.eventTypes.includes(event.type)) continue;

      // Check conditions if specified
      if (rule.conditions && !this.evaluateConditions(event, rule.conditions)) {
        continue;
      }

      matchingRules.push(rule);
    }

    return matchingRules;
  }

  /**
   * Evaluate notification conditions against event data
   */
  private evaluateConditions(
    event: RealtimeEvent,
    conditions: NotificationCondition[]
  ): boolean {
    return conditions.every(condition => {
      const value = this.getEventFieldValue(event, condition.field);

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Get field value from event using dot notation
   */
  private getEventFieldValue(event: RealtimeEvent, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = event;

    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }

    return value;
  }

  /**
   * Process pending notifications with batching and priority handling
   */
  private async processNotifications(
    notifications: PendingNotification[]
  ): Promise<void> {
    // Separate critical notifications for immediate delivery
    const criticalNotifications = notifications.filter(
      n => n.rule.priority === 'critical'
    );
    const regularNotifications = notifications.filter(
      n => n.rule.priority !== 'critical'
    );

    // Send critical notifications immediately
    for (const notification of criticalNotifications) {
      await this.deliverNotification(notification);
    }

    // Handle regular notifications with batching
    if (this.config.enableBatching && regularNotifications.length > 0) {
      this.addToBatch(regularNotifications);
    } else {
      // Send immediately if batching is disabled
      for (const notification of regularNotifications) {
        await this.deliverNotification(notification);
      }
    }
  }

  /**
   * Add notifications to batch for delayed delivery
   */
  private addToBatch(notifications: PendingNotification[]): void {
    const now = Date.now();

    for (const notification of notifications) {
      const batchKey = `${notification.event.type}-${notification.rule.priority}`;

      let batch = this.batches.get(batchKey);
      if (!batch) {
        batch = {
          id: batchKey,
          eventType: notification.event.type,
          notifications: [],
          createdAt: now,
          scheduledAt: now + this.config.batchWindow,
        };
        this.batches.set(batchKey, batch);
      }

      batch.notifications.push(notification);

      // Send batch immediately if it reaches max size
      if (batch.notifications.length >= this.config.maxBatchSize) {
        this.processBatch(batch);
        this.batches.delete(batchKey);
      }
    }
  }

  /**
   * Start batch processor timer
   */
  private startBatchProcessor(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      this.processPendingBatches();
    }, BATCH_PROCESSOR_INTERVAL_MS);
  }

  /**
   * Process batches that are ready for delivery
   */
  private processPendingBatches(): void {
    const now = Date.now();

    for (const [batchKey, batch] of this.batches.entries()) {
      if (now >= batch.scheduledAt) {
        this.processBatch(batch);
        this.batches.delete(batchKey);
      }
    }
  }

  /**
   * Process a batch of notifications
   */
  private async processBatch(batch: NotificationBatch): Promise<void> {
    this.logger.info('Processing notification batch', {
      metadata: {
        batchId: batch.id,
        eventType: batch.eventType,
        notificationCount: batch.notifications.length,
        batchAge: Date.now() - batch.createdAt,
      },
    });

    // Group notifications by recipient to avoid duplicate messages
    const recipientGroups = new Map<string, PendingNotification[]>();

    for (const notification of batch.notifications) {
      for (const recipient of notification.recipients) {
        const key = recipient.userId;
        if (!recipientGroups.has(key)) {
          recipientGroups.set(key, []);
        }
        const group = recipientGroups.get(key);
        if (group) {
          group.push(notification);
        }
      }
    }

    // Send batched notifications to each recipient
    for (const [userId, notifications] of recipientGroups.entries()) {
      await this.deliverBatchedNotifications(userId, notifications);
    }
  }

  /**
   * Deliver batched notifications to a single recipient
   */
  private async deliverBatchedNotifications(
    userId: string,
    notifications: PendingNotification[]
  ): Promise<void> {
    // Create summary notification for multiple events
    const eventTypes = [...new Set(notifications.map(n => n.event.type))];
    const title =
      eventTypes.length === 1
        ? `${notifications.length} ${eventTypes[0]} updates`
        : `${notifications.length} fiber installation updates`;

    const message =
      notifications.length === 1
        ? this.renderNotificationMessage(notifications[0])
        : `You have ${notifications.length} updates across ${eventTypes.length} event types`;

    // Find recipient details
    const recipient = notifications[0].recipients.find(
      r => r.userId === userId
    );
    if (!recipient) return;

    // Create batched notification
    const batchedNotification: PendingNotification = {
      id: `batch-${userId}-${Date.now()}`,
      event: notifications[0].event, // Use first event as reference
      rule: {
        ...notifications[0].rule,
        template: { title, message, variables: [] },
      },
      recipients: [recipient],
      createdAt: Date.now(),
    };

    await this.deliverNotification(batchedNotification);
  }

  /**
   * Deliver a single notification to recipients
   */
  private async deliverNotification(
    notification: PendingNotification
  ): Promise<void> {
    const message = this.renderNotificationMessage(notification);

    for (const recipient of notification.recipients) {
      try {
        // Try WebSocket delivery first if recipient is online
        if (
          this.config.enableWebSocket &&
          recipient.isOnline &&
          this.webSocketGateway
        ) {
          await this.deliverViaWebSocket(notification, recipient, message);
        }

        // Fallback to traditional channels based on priority
        if (notification.rule.priority === 'critical' || !recipient.isOnline) {
          await this.deliverViaTraditionalChannels(
            notification,
            recipient,
            message
          );
        }
      } catch (error) {
        this.logger.error('Failed to deliver notification to recipient', {
          metadata: {
            notificationId: notification.id,
            recipientId: recipient.userId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  /**
   * Deliver notification via WebSocket
   */
  private async deliverViaWebSocket(
    notification: PendingNotification,
    recipient: NotificationRecipient,
    message: string
  ): Promise<void> {
    if (!this.webSocketGateway) {
      throw new Error('WebSocket gateway not available');
    }

    const wsNotification: WebSocketNotification = {
      id: notification.id,
      type: 'notification',
      event: notification.event,
      notification: {
        title: notification.rule.template.title,
        message,
        priority: notification.rule.priority,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      // Send to user's WebSocket channel
      await this.webSocketGateway.sendToUser(recipient.userId, wsNotification);

      this.logger.info('Notification delivered via WebSocket', {
        metadata: {
          notificationId: notification.id,
          recipientId: recipient.userId,
          eventType: notification.event.type,
        },
      });
    } catch (error) {
      this.logger.error('Failed to deliver WebSocket notification', {
        metadata: {
          notificationId: notification.id,
          recipientId: recipient.userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Deliver notification via traditional channels (email, SMS, etc.)
   */
  private async deliverViaTraditionalChannels(
    notification: PendingNotification,
    recipient: NotificationRecipient,
    message: string
  ): Promise<void> {
    const severity = this.mapPriorityToSeverity(notification.rule.priority);

    const notificationMessage: NotificationMessage = {
      title: notification.rule.template.title,
      message,
      severity,
      metadata: {
        eventId: notification.event.id,
        eventType: notification.event.type,
        recipientId: recipient.userId,
        priority: notification.rule.priority,
      },
    };

    // Send to recipient's preferred channels
    for (const channelId of recipient.channels) {
      try {
        await notificationService.sendNotification(
          channelId,
          notificationMessage
        );
      } catch (error) {
        this.logger.warn('Failed to send notification via channel', {
          metadata: {
            channelId,
            notificationId: notification.id,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  /**
   * Render notification message from template
   */
  private renderNotificationMessage(notification: PendingNotification): string {
    let message = notification.rule.template.message;

    // Replace template variables
    for (const variable of notification.rule.template.variables) {
      const value = this.getEventFieldValue(notification.event, variable);
      message = message.replace(`{${variable}}`, String(value || ''));
    }

    return message;
  }

  /**
   * Map notification priority to alert severity
   */
  private mapPriorityToSeverity(priority: NotificationPriority): AlertSeverity {
    switch (priority) {
      case 'low':
        return AlertSeverity.INFO;
      case 'normal':
        return AlertSeverity.WARNING;
      case 'high':
        return AlertSeverity.WARNING;
      case 'critical':
        return AlertSeverity.CRITICAL;
      default:
        return AlertSeverity.INFO;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.rules.clear();
    this.batches.clear();

    this.logger.info('Real-time notification manager destroyed');
  }
}

// Global instance
export const realtimeNotificationManager = new RealtimeNotificationManager();
