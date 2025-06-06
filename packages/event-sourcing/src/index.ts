/**
 * Event Sourcing Package Entry Point
 * Exports all public APIs for the event sourcing system
 */

// Core types
export type {
  StoredEvent,
  AggregateType,
  EventStore,
  EventPublisher,
  EventHandler,
  EventSubscription,
  EventFilters,
  EventStatistics,
  AggregateSnapshot,
  TimeRange,
  EventSourcingConfig,
  EventProcessingResult,
  BatchProcessingResult,
  EventStreamPosition,
  EventReplayOptions,
  ConflictDetectionResult,
  ConflictResolution,
  EventStoreMetrics,
} from './types';

// Error types
export {
  EventStoreError,
  ConcurrencyError,
  EventNotFoundError,
  AggregateNotFoundError,
} from './types';

// Core implementations
export { SupabaseEventStore } from './supabase-event-store';
export {
  RealtimeEventPublisher,
  WebSocketGatewayPublisher,
  CompositeEventPublisher,
} from './event-publisher';

// Event sourcing service
export { EventSourcingService } from './event-sourcing-service';

// Utilities and helpers
export { createEventSourcingService } from './factory';
export { EventSourcingMonitor } from './monitoring';
