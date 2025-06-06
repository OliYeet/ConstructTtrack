/**
 * Event Sourcing Types
 * Core types for the event sourcing system
 */

// Use relative import to avoid module resolution issues
import type {
  RealtimeEvent,
  EventType,
} from '../../../src/types/realtime-protocol';

// CodeRabbit fix: Add UUID type alias for clarity
export type UUID = string;

// Event Store Core Types
export interface StoredEvent {
  id: UUID;
  eventId: string;
  eventType: EventType;
  version: string;
  aggregateId: string;
  aggregateType: AggregateType;
  sequenceNumber: number;
  eventData: RealtimeEvent;
  metadata: Record<string, unknown>;
  userId: string;
  organizationId: string;
  timestamp: Date;
  createdAt: Date;
}

export type AggregateType = 'work_order' | 'fiber_section' | 'project' | 'task';

// Event Store Interface
export interface EventStore {
  /**
   * Append events to the event store
   */
  append(
    events: RealtimeEvent[],
    aggregateId: string,
    aggregateType: AggregateType
  ): Promise<void>;

  /**
   * Get events for a specific aggregate
   */
  getEvents(aggregateId: string, fromSequence?: number): Promise<StoredEvent[]>;

  /**
   * Get events by type with optional filters
   */
  getEventsByType(
    eventType: EventType,
    filters?: EventFilters
  ): Promise<StoredEvent[]>;

  /**
   * Get aggregate snapshot (for future optimization)
   */
  getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null>;

  /**
   * Save aggregate snapshot (for future optimization)
   */
  saveSnapshot(snapshot: AggregateSnapshot): Promise<void>;

  /**
   * Get event statistics
   */
  getStatistics(timeRange?: TimeRange): Promise<EventStatistics[]>;
}

// Event Filters
export interface EventFilters {
  limit?: number;
  offset?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  aggregateType?: AggregateType;
  userId?: string;
}

// Time Range
export interface TimeRange {
  from: Date;
  to: Date;
}

// Event Statistics
export interface EventStatistics {
  eventType: EventType;
  eventCount: number;
  uniqueAggregates: number;
  firstEvent: Date;
  lastEvent: Date;
}

// Aggregate Snapshot (for future optimization)
export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: AggregateType;
  version: number;
  data: Record<string, unknown>;
  timestamp: Date;
}

// Event Publisher Interface
export interface EventPublisher {
  /**
   * Publish events to real-time subscribers
   */
  publish(events: RealtimeEvent[]): Promise<void>;

  /**
   * Subscribe to events
   */
  subscribe(
    eventTypes: EventType[],
    handler: EventHandler,
    filters?: EventFilters
  ): Promise<EventSubscription>;
}

// Event Handler
export type EventHandler = (event: StoredEvent) => Promise<void> | void;

// Event Subscription
export interface EventSubscription {
  id: string;
  eventTypes: EventType[];
  filters?: EventFilters;
  unsubscribe(): Promise<void>;
}

// Event Sourcing Configuration
export interface EventSourcingConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableSnapshots?: boolean;
  snapshotFrequency?: number;
  maxEventsPerQuery?: number;
  enableMetrics?: boolean;
}

// Event Processing Result
export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  sequenceNumber?: number;
  error?: string;
  processingTime?: number;
}

// Batch Processing Result
export interface BatchProcessingResult {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  results: EventProcessingResult[];
  totalProcessingTime: number;
}

// Event Stream Position
export interface EventStreamPosition {
  aggregateId: string;
  sequenceNumber: number;
  timestamp: Date;
}

// Event Replay Options
export interface EventReplayOptions {
  fromSequence?: number;
  toSequence?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  eventTypes?: EventType[];
  batchSize?: number;
}

// Conflict Detection Result
export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingEvents: StoredEvent[];
  resolution?: ConflictResolution;
}

// Conflict Resolution (for future LUM-589 integration)
export interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  resolvedEvent?: RealtimeEvent;
  metadata: Record<string, unknown>;
}

// Event Store Metrics
export interface EventStoreMetrics {
  totalEvents: number;
  eventsPerSecond: number;
  averageProcessingTime: number;
  errorRate: number;
  storageSize: number;
  oldestEvent: Date;
  newestEvent: Date;
}

// Error Types
export class EventStoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EventStoreError';
  }
}

export class ConcurrencyError extends EventStoreError {
  constructor(
    aggregateId: string,
    expectedSequence: number,
    actualSequence: number
  ) {
    super(
      `Concurrency conflict for aggregate ${aggregateId}. Expected sequence ${expectedSequence}, got ${actualSequence}`,
      'CONCURRENCY_CONFLICT',
      { aggregateId, expectedSequence, actualSequence }
    );
    this.name = 'ConcurrencyError';
  }
}

export class EventNotFoundError extends EventStoreError {
  constructor(eventId: string) {
    super(`Event not found: ${eventId}`, 'EVENT_NOT_FOUND', { eventId });
    this.name = 'EventNotFoundError';
  }
}

export class AggregateNotFoundError extends EventStoreError {
  constructor(aggregateId: string) {
    super(`Aggregate not found: ${aggregateId}`, 'AGGREGATE_NOT_FOUND', {
      aggregateId,
    });
    this.name = 'AggregateNotFoundError';
  }
}
