/**
 * Supabase Event Store Implementation
 * Provides event sourcing capabilities using Supabase as the backend
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type {
  RealtimeEvent,
  EventType,
} from '../../../src/types/realtime-protocol';

import type {
  EventStore,
  StoredEvent,
  AggregateType,
  EventFilters,
  EventStatistics,
  AggregateSnapshot,
  TimeRange,
  EventSourcingConfig,
  EventProcessingResult,
  BatchProcessingResult,
} from './types';
import { EventStoreError, AggregateNotFoundError } from './types';

export class SupabaseEventStore implements EventStore {
  private supabase: SupabaseClient;
  private config: EventSourcingConfig;

  constructor(config: EventSourcingConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Append events to the event store
   */
  async append(
    events: RealtimeEvent[],
    aggregateId: string,
    aggregateType: AggregateType
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const startTime = Date.now();
    const results: EventProcessingResult[] = [];

    try {
      // Process events in a transaction-like manner
      for (const event of events) {
        try {
          const result = await this.appendSingleEvent(
            event,
            aggregateId,
            aggregateType
          );
          results.push(result);
        } catch (error) {
          const errorResult: EventProcessingResult = {
            success: false,
            eventId: event.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Date.now() - startTime,
          };
          results.push(errorResult);
          throw error; // Re-throw to stop processing
        }
      }
    } catch (error) {
      // Log batch processing failure
      const batchResult: BatchProcessingResult = {
        totalEvents: events.length,
        successfulEvents: results.filter(r => r.success).length,
        failedEvents: results.filter(r => !r.success).length,
        results,
        totalProcessingTime: Date.now() - startTime,
      };

      throw new EventStoreError(
        `Failed to append events for aggregate ${aggregateId}`,
        'BATCH_APPEND_FAILED',
        { batchResult, originalError: error }
      );
    }
  }

  /**
   * Append a single event to the store
   */
  private async appendSingleEvent(
    event: RealtimeEvent,
    aggregateId: string,
    aggregateType: AggregateType
  ): Promise<EventProcessingResult> {
    const startTime = Date.now();

    try {
      const { error } = await this.supabase.rpc('append_realtime_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_version: event.version,
        p_aggregate_id: aggregateId,
        p_aggregate_type: aggregateType,
        p_event_data: event,
        p_metadata: event.metadata || {},
        p_timestamp: event.timestamp,
      });

      if (error) {
        throw new EventStoreError(
          `Failed to append event ${event.id}`,
          'APPEND_FAILED',
          { error, event }
        );
      }

      return {
        success: true,
        eventId: event.id,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      // CodeRabbit fix: Don't swallow errors - throw them to ensure proper error handling
      throw new EventStoreError(
        `Failed to append event ${event.id}`,
        'APPEND_FAILED',
        { error, event }
      );
    }
  }

  /**
   * Get events for a specific aggregate
   */
  async getEvents(
    aggregateId: string,
    fromSequence: number = 1
  ): Promise<StoredEvent[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_aggregate_events', {
        aggregate_uuid: aggregateId,
        from_sequence: fromSequence,
      });

      if (error) {
        throw new EventStoreError(
          `Failed to get events for aggregate ${aggregateId}`,
          'GET_EVENTS_FAILED',
          { error, aggregateId, fromSequence }
        );
      }

      if (!data || data.length === 0) {
        throw new AggregateNotFoundError(aggregateId);
      }

      return data.map(this.mapDatabaseRowToStoredEvent);
    } catch (error) {
      if (error instanceof AggregateNotFoundError) {
        throw error;
      }
      throw new EventStoreError(
        `Failed to retrieve events for aggregate ${aggregateId}`,
        'GET_EVENTS_ERROR',
        { error, aggregateId, fromSequence }
      );
    }
  }

  /**
   * Get events by type with optional filters
   */
  async getEventsByType(
    eventType: EventType,
    filters: EventFilters = {}
  ): Promise<StoredEvent[]> {
    try {
      const {
        limit = this.config.maxEventsPerQuery || 100,
        offset = 0,
        fromTimestamp,
        toTimestamp,
      } = filters;

      const { data, error } = await this.supabase.rpc('get_events_by_type', {
        p_event_type: eventType,
        p_limit: limit,
        p_offset: offset,
        p_from_timestamp: fromTimestamp?.toISOString() || null,
        p_to_timestamp: toTimestamp?.toISOString() || null,
      });

      if (error) {
        throw new EventStoreError(
          `Failed to get events by type ${eventType}`,
          'GET_EVENTS_BY_TYPE_FAILED',
          { error, eventType, filters }
        );
      }

      return (data || []).map(this.mapDatabaseRowToStoredEvent);
    } catch (error) {
      throw new EventStoreError(
        `Failed to retrieve events by type ${eventType}`,
        'GET_EVENTS_BY_TYPE_ERROR',
        { error, eventType, filters }
      );
    }
  }

  /**
   * Get aggregate snapshot (placeholder for future optimization)
   */
  async getSnapshot(_aggregateId: string): Promise<AggregateSnapshot | null> {
    // TODO: Implement snapshot functionality in future iteration
    // For now, return null to indicate no snapshot available
    return null;
  }

  /**
   * Save aggregate snapshot (placeholder for future optimization)
   */
  async saveSnapshot(_snapshot: AggregateSnapshot): Promise<void> {
    // TODO: Implement snapshot functionality in future iteration
    // This would create a table for snapshots and store aggregate state
    throw new EventStoreError(
      'Snapshot functionality not yet implemented',
      'SNAPSHOTS_NOT_IMPLEMENTED'
    );
  }

  /**
   * Get event statistics
   */
  async getStatistics(timeRange?: TimeRange): Promise<EventStatistics[]> {
    try {
      const fromTimestamp =
        timeRange?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toTimestamp = timeRange?.to || new Date();

      const { data, error } = await this.supabase.rpc('get_event_statistics', {
        p_from_timestamp: fromTimestamp.toISOString(),
        p_to_timestamp: toTimestamp.toISOString(),
      });

      if (error) {
        throw new EventStoreError(
          'Failed to get event statistics',
          'GET_STATISTICS_FAILED',
          { error, timeRange }
        );
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        eventType: row.event_type as EventType,
        eventCount: parseInt(row.event_count as string),
        uniqueAggregates: parseInt(row.unique_aggregates as string),
        firstEvent: new Date(row.first_event as string),
        lastEvent: new Date(row.last_event as string),
      }));
    } catch (error) {
      throw new EventStoreError(
        'Failed to retrieve event statistics',
        'GET_STATISTICS_ERROR',
        { error, timeRange }
      );
    }
  }

  /**
   * Map database row to StoredEvent
   */
  private mapDatabaseRowToStoredEvent(
    row: Record<string, unknown>
  ): StoredEvent {
    return {
      id: row.id as string,
      eventId: row.event_id as string,
      eventType: row.event_type as EventType,
      version: row.version as string,
      aggregateId: row.aggregate_id as string,
      aggregateType: row.aggregate_type as AggregateType,
      sequenceNumber: row.sequence_number as number,
      eventData: row.event_data as RealtimeEvent,
      metadata: (row.metadata as Record<string, unknown>) || {},
      userId: row.user_id as string,
      organizationId: row.organization_id as string,
      timestamp: new Date(row.timestamp as string),
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Health check for the event store
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, unknown>;
  }> {
    try {
      const { error } = await this.supabase
        .from('realtime_events')
        .select('count')
        .limit(1);

      if (error) {
        return {
          healthy: false,
          details: { error: error.message },
        };
      }

      return {
        healthy: true,
        details: {
          connection: 'ok',
          timestamp: new Date().toISOString(),
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
