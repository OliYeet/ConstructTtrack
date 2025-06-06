/**
 * Event Sourcing Factory
 * Factory functions for creating event sourcing components
 */

import {
  RealtimeEventPublisher,
  WebSocketGatewayPublisher,
  CompositeEventPublisher,
} from './event-publisher';
import { EventSourcingService } from './event-sourcing-service';
import { SupabaseEventStore } from './supabase-event-store';
import type { EventSourcingConfig } from './types';

/**
 * Create a complete event sourcing service with default configuration
 */
export function createEventSourcingService(
  config: EventSourcingConfig
): EventSourcingService {
  // Create event store
  const eventStore = new SupabaseEventStore(config);

  // Create event publishers
  const realtimePublisher = new RealtimeEventPublisher();

  // If WebSocket gateway URL is provided, add it to the composite
  const publishers = [realtimePublisher];

  // Create composite publisher
  const eventPublisher = new CompositeEventPublisher(publishers);

  // Create and return the service
  return new EventSourcingService(eventStore, eventPublisher, config);
}

/**
 * Create event sourcing service with WebSocket gateway integration
 */
export function createEventSourcingServiceWithGateway(
  config: EventSourcingConfig,
  gatewayUrl: string
): EventSourcingService {
  // Create event store
  const eventStore = new SupabaseEventStore(config);

  // Create event publishers
  const realtimePublisher = new RealtimeEventPublisher();
  const gatewayPublisher = new WebSocketGatewayPublisher(gatewayUrl);

  // Create composite publisher with both
  const eventPublisher = new CompositeEventPublisher([
    realtimePublisher,
    gatewayPublisher,
  ]);

  // Create and return the service
  return new EventSourcingService(eventStore, eventPublisher, config);
}

/**
 * Create default event sourcing configuration
 */
export function createDefaultConfig(
  supabaseUrl: string,
  supabaseKey: string
): EventSourcingConfig {
  return {
    supabaseUrl,
    supabaseKey,
    enableSnapshots: false, // Disabled for initial implementation
    snapshotFrequency: 100, // Every 100 events
    maxEventsPerQuery: 1000,
    enableMetrics: true,
  };
}
