/**
 * Event Publisher Implementation
 * Handles publishing events to real-time subscribers and WebSocket gateway
 */

import type {
  RealtimeEvent,
  EventType,
} from '@constructtrack/realtime-protocol';
import { v4 as uuidv4 } from 'uuid';

import type {
  EventPublisher,
  EventHandler,
  EventSubscription,
  EventFilters,
  StoredEvent,
} from './types';
import { EventStoreError } from './types';

export class RealtimeEventPublisher implements EventPublisher {
  private subscriptions = new Map<string, InternalSubscription>();
  private eventHandlers = new Map<EventType, Set<InternalSubscription>>();

  /**
   * Publish events to real-time subscribers
   */
  async publish(events: RealtimeEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishSingleEvent(event);
    }
  }

  /**
   * Publish a single event to subscribers
   */
  private async publishSingleEvent(event: RealtimeEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Convert RealtimeEvent to StoredEvent format for handlers
    const storedEvent: StoredEvent = {
      id: uuidv4(),
      eventId: event.id,
      eventType: event.type,
      version: event.version,
      aggregateId: event.workOrderId, // Using workOrderId as aggregateId
      aggregateType: 'work_order', // Default to work_order, could be enhanced
      sequenceNumber: 0, // Will be set by event store
      eventData: event,
      metadata: event.metadata || {},
      userId: event.userId,
      organizationId: '', // Will be set by event store
      timestamp: new Date(event.timestamp),
      createdAt: new Date(),
    };

    // Execute handlers concurrently
    const handlerPromises = Array.from(handlers).map(async subscription => {
      try {
        if (this.matchesFilters(storedEvent, subscription.filters)) {
          await subscription.handler(storedEvent);
        }
      } catch (error) {
        // Log error but don't throw - we don't want one handler failure to affect others
        // In production, this would use a proper logger
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.error(
            `Error in event handler for subscription ${subscription.id}:`,
            error
          );
        }
      }
    });

    await Promise.allSettled(handlerPromises);
  }

  /**
   * Subscribe to events
   */
  async subscribe(
    eventTypes: EventType[],
    handler: EventHandler,
    filters?: EventFilters
  ): Promise<EventSubscription> {
    const subscriptionId = uuidv4();
    const subscription: InternalSubscription = {
      id: subscriptionId,
      eventTypes,
      handler,
      filters,
    };

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);

    // Add to event type handlers
    for (const eventType of eventTypes) {
      if (!this.eventHandlers.has(eventType)) {
        this.eventHandlers.set(eventType, new Set());
      }
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.add(subscription);
      }
    }

    return {
      id: subscriptionId,
      eventTypes,
      filters,
      unsubscribe: async () => {
        await this.unsubscribe(subscriptionId);
      },
    };
  }

  /**
   * Unsubscribe from events
   */
  private async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Remove from event type handlers
    for (const eventType of subscription.eventTypes) {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(subscription);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Check if event matches subscription filters
   */
  private matchesFilters(event: StoredEvent, filters?: EventFilters): boolean {
    if (!filters) {
      return true;
    }

    // Check aggregate type filter
    if (
      filters.aggregateType &&
      event.aggregateType !== filters.aggregateType
    ) {
      return false;
    }

    // Check user ID filter
    if (filters.userId && event.userId !== filters.userId) {
      return false;
    }

    // Check timestamp filters
    if (filters.fromTimestamp && event.timestamp < filters.fromTimestamp) {
      return false;
    }

    if (filters.toTimestamp && event.timestamp > filters.toTimestamp) {
      return false;
    }

    return true;
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    subscriptionsByEventType: Record<EventType, number>;
  } {
    const subscriptionsByEventType: Record<string, number> = {};

    for (const [eventType, handlers] of this.eventHandlers.entries()) {
      subscriptionsByEventType[eventType] = handlers.size;
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByEventType: subscriptionsByEventType as Record<
        EventType,
        number
      >,
    };
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clearAllSubscriptions(): void {
    this.subscriptions.clear();
    this.eventHandlers.clear();
  }
}

// Internal subscription interface
interface InternalSubscription {
  id: string;
  eventTypes: EventType[];
  handler: EventHandler;
  filters?: EventFilters;
}

/**
 * WebSocket Gateway Event Publisher
 * Integrates with the existing WebSocket gateway for real-time broadcasting
 */
export class WebSocketGatewayPublisher implements EventPublisher {
  private gatewayUrl: string;
  private subscriptions = new Map<string, EventSubscription>();

  constructor(gatewayUrl: string) {
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Publish events to WebSocket gateway
   */
  async publish(events: RealtimeEvent[]): Promise<void> {
    // This would integrate with the existing WebSocket gateway
    // For now, we'll implement a basic HTTP-based approach
    try {
      // Use dynamic import for fetch in Node.js environments
      const fetchFn = globalThis.fetch || (await import('node-fetch')).default;

      const response = await fetchFn(`${this.gatewayUrl}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new EventStoreError(
          `Failed to publish events to WebSocket gateway: ${response.statusText}`,
          'GATEWAY_PUBLISH_FAILED',
          { status: response.status, events }
        );
      }
    } catch (error) {
      throw new EventStoreError(
        'Failed to publish events to WebSocket gateway',
        'GATEWAY_PUBLISH_ERROR',
        { error, events }
      );
    }
  }

  /**
   * Subscribe to events (placeholder - would integrate with WebSocket)
   */
  async subscribe(
    eventTypes: EventType[],
    handler: EventHandler,
    filters?: EventFilters
  ): Promise<EventSubscription> {
    const subscriptionId = uuidv4();

    // This would establish a WebSocket connection to the gateway
    // For now, return a placeholder subscription
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes,
      filters,
      unsubscribe: async () => {
        this.subscriptions.delete(subscriptionId);
      },
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }
}

/**
 * Composite Event Publisher
 * Combines multiple publishers for comprehensive event distribution
 */
export class CompositeEventPublisher implements EventPublisher {
  private publishers: EventPublisher[];

  constructor(publishers: EventPublisher[]) {
    this.publishers = publishers;
  }

  /**
   * Publish events to all publishers
   */
  async publish(events: RealtimeEvent[]): Promise<void> {
    const publishPromises = this.publishers.map(publisher =>
      publisher.publish(events).catch(error => {
        // Log error but don't throw - we want other publishers to continue
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.error('Publisher failed:', error);
        }
        return error;
      })
    );

    const results = await Promise.allSettled(publishPromises);

    // Check if any publishers failed
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0 && process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(
        `${failures.length} out of ${this.publishers.length} publishers failed`
      );
    }
  }

  /**
   * Subscribe to events (uses first publisher that supports subscriptions)
   */
  async subscribe(
    eventTypes: EventType[],
    handler: EventHandler,
    filters?: EventFilters
  ): Promise<EventSubscription> {
    // Use the first publisher for subscriptions
    if (this.publishers.length === 0) {
      throw new EventStoreError(
        'No publishers available for subscription',
        'NO_PUBLISHERS_AVAILABLE'
      );
    }

    return this.publishers[0].subscribe(eventTypes, handler, filters);
  }
}
