/**
 * Event Sourcing Service
 * Main service that coordinates event storage and publishing
 */

import type {
  RealtimeEvent,
  EventType,
} from '../../../src/types/realtime-protocol';

import type {
  EventStore,
  EventPublisher,
  StoredEvent,
  AggregateType,
  EventFilters,
  EventStatistics,
  TimeRange,
  EventSourcingConfig,
} from './types';
import { EventStoreError } from './types';

export class EventSourcingService {
  private eventStore: EventStore;
  private eventPublisher: EventPublisher;
  private config: EventSourcingConfig;

  constructor(
    eventStore: EventStore,
    eventPublisher: EventPublisher,
    config: EventSourcingConfig
  ) {
    this.eventStore = eventStore;
    this.eventPublisher = eventPublisher;
    this.config = config;
  }

  /**
   * Process and store events, then publish them
   */
  async processEvents(
    events: RealtimeEvent[],
    aggregateId: string,
    aggregateType: AggregateType
  ): Promise<void> {
    try {
      // First, store events in the event store
      await this.eventStore.append(events, aggregateId, aggregateType);

      // Then publish events to real-time subscribers
      await this.eventPublisher.publish(events);
    } catch (error) {
      throw new EventStoreError(
        `Failed to process events for aggregate ${aggregateId}`,
        'PROCESS_EVENTS_FAILED',
        { error, aggregateId, aggregateType, eventCount: events.length }
      );
    }
  }

  /**
   * Get event history for an aggregate
   */
  async getEventHistory(
    aggregateId: string,
    fromSequence?: number
  ): Promise<StoredEvent[]> {
    return this.eventStore.getEvents(aggregateId, fromSequence);
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: EventType,
    filters?: EventFilters
  ): Promise<StoredEvent[]> {
    return this.eventStore.getEventsByType(eventType, filters);
  }

  /**
   * Get event statistics
   */
  async getStatistics(timeRange?: TimeRange): Promise<EventStatistics[]> {
    return this.eventStore.getStatistics(timeRange);
  }

  /**
   * Subscribe to real-time events
   */
  async subscribeToEvents(
    eventTypes: EventType[],
    handler: (event: StoredEvent) => Promise<void> | void,
    filters?: EventFilters
  ) {
    return this.eventPublisher.subscribe(eventTypes, handler, filters);
  }

  /**
   * Replay events for an aggregate
   */
  async replayEvents(
    aggregateId: string,
    fromSequence: number = 1,
    handler: (event: StoredEvent) => Promise<void> | void
  ): Promise<void> {
    const events = await this.eventStore.getEvents(aggregateId, fromSequence);

    for (const event of events) {
      try {
        await handler(event);
      } catch (error) {
        throw new EventStoreError(
          `Failed to replay event ${event.eventId}`,
          'REPLAY_FAILED',
          { error, event, aggregateId }
        );
      }
    }
  }

  /**
   * Health check for the event sourcing system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, unknown>;
  }> {
    try {
      // Check event store health
      const storeHealth = await (
        this.eventStore as {
          healthCheck?: () => Promise<{
            healthy: boolean;
            details: Record<string, unknown>;
          }>;
        }
      ).healthCheck?.();

      return {
        healthy: storeHealth?.healthy ?? true,
        details: {
          eventStore: storeHealth?.details ?? 'ok',
          timestamp: new Date().toISOString(),
          config: {
            enableSnapshots: this.config.enableSnapshots,
            maxEventsPerQuery: this.config.maxEventsPerQuery,
            enableMetrics: this.config.enableMetrics,
          },
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
