/**
 * Supabase Event Bridge
 * Maps Supabase real-time events to WebSocket protocol events
 * Focus on work_orders and fiber_sections per Charlie's guidance
 */

// ⚠️ SECURITY WARNING: This file contains service role key access
// NEVER bundle this file for browser/client-side use - server-only!
// The service role key provides root-level database access

// Built-in modules must be imported first
import { randomUUID } from 'crypto';
// Use the canonical event-sourcing types
import type {
  EventSourcingService,
  RealtimeEvent,
} from '@constructtrack/event-sourcing';

// External libraries
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

// Internal imports
import { config } from './config';
import type { WebSocketGateway } from './gateway';
import { logger } from './utils/logger';

// Database row types - following Charlie's guidance for proper typing
interface WorkOrder {
  id: string;
  project_id: string;
  status: string;
  priority: string;
  assigned_to?: string;
  location?: Record<string, unknown>;
  updated_at: string;
}

interface FiberSection {
  id: string;
  project_id: string;
  work_order_id?: string;
  status: string;
  start_point?: Record<string, unknown>;
  end_point?: Record<string, unknown>;
  length_meters?: number;
  updated_at: string;
}

export class SupabaseBridge {
  private supabase: SupabaseClient;
  private gateway: WebSocketGateway;
  private channels: RealtimeChannel[] = [];
  private eventSourcingService: EventSourcingService | null = null;

  constructor(gateway: WebSocketGateway) {
    this.gateway = gateway;
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // TODO: Re-enable event sourcing service after module resolution is fixed
    // const eventSourcingConfig = createDefaultConfig(
    //   config.supabase.url,
    //   config.supabase.serviceRoleKey
    // );
    // this.eventSourcingService = createEventSourcingService(eventSourcingConfig);

    // Runtime safety: surface warning when event sourcing is disabled
    if (!this.eventSourcingService) {
      logger.warn(
        'SupabaseBridge initialised without an EventSourcingService. ' +
          'Realtime events will be broadcast but NOT persisted for replay or audit.'
      );
    }
  }

  public async start(): Promise<void> {
    logger.info('Starting Supabase real-time bridge');

    // Subscribe to work_orders changes
    const workOrdersChannel = this.supabase
      .channel('work_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
        },
        async payload => {
          try {
            await this.handleWorkOrderEvent(
              payload as RealtimePostgresChangesPayload<WorkOrder>
            );
          } catch (error) {
            logger.error('Work order event handler failed', { error, payload });
          }
        }
      )
      .subscribe();

    // Subscribe to fiber_sections changes
    const fiberSectionsChannel = this.supabase
      .channel('fiber_sections_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fiber_sections',
        },
        async payload => {
          try {
            await this.handleFiberSectionEvent(
              payload as RealtimePostgresChangesPayload<FiberSection>
            );
          } catch (error) {
            logger.error('Fiber section event handler failed', {
              error,
              payload,
            });
          }
        }
      )
      .subscribe();

    this.channels.push(workOrdersChannel, fiberSectionsChannel);

    logger.info('Supabase real-time subscriptions active', {
      channels: ['work_orders', 'fiber_sections'],
    });
  }

  private async handleWorkOrderEvent(
    payload: RealtimePostgresChangesPayload<WorkOrder>
  ): Promise<void> {
    logger.debug('Work order event received', {
      eventType: payload.eventType,
      table: payload.table,
    });

    const workOrder = payload.new as WorkOrder;
    const oldWorkOrder = payload.old as WorkOrder;

    // Determine affected rooms
    const rooms = this.getAffectedRooms(workOrder, oldWorkOrder);

    // Create protocol event
    const protocolEvent = {
      type: 'work_order_updated',
      data: {
        eventType: payload.eventType.toLowerCase(),
        workOrder,
        oldWorkOrder: payload.eventType === 'UPDATE' ? oldWorkOrder : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    // Create RealtimeEvent for event sourcing
    const realtimeEvent = {
      id: `work_order_${workOrder.id}_${randomUUID()}`,
      type: 'WorkOrderUpdated',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: workOrder.id,
      userId: workOrder.assigned_to || 'system',
      metadata: {
        eventType: payload.eventType,
        table: payload.table,
        rooms,
      },
      payload: {
        workOrder,
        oldWorkOrder: payload.eventType === 'UPDATE' ? oldWorkOrder : undefined,
        eventType: payload.eventType.toLowerCase(),
      },
    } as unknown as RealtimeEvent;

    // TODO: Re-enable event sourcing after module resolution is fixed
    if (this.eventSourcingService) {
      try {
        // Store event in event sourcing system
        await this.eventSourcingService.processEvents(
          [realtimeEvent],
          workOrder.id,
          'work_order'
        );
      } catch (error) {
        logger.error(
          'Failed to store work order event in event sourcing system',
          {
            error,
            eventId: realtimeEvent.id,
            workOrderId: workOrder.id,
          }
        );
        // Continue with broadcast even if event sourcing fails
      }
    }

    // Broadcast to relevant rooms
    rooms.forEach(room => {
      this.gateway.broadcastToRoom(room, protocolEvent);
      logger.debug('Broadcasted work order event', {
        room,
        eventType: payload.eventType,
      });
    });
  }

  private async handleFiberSectionEvent(
    payload: RealtimePostgresChangesPayload<FiberSection>
  ): Promise<void> {
    logger.debug('Fiber section event received', {
      eventType: payload.eventType,
      table: payload.table,
    });

    const fiberSection = payload.new as FiberSection;
    const oldFiberSection = payload.old as FiberSection;

    // Determine affected rooms
    const rooms = this.getAffectedRoomsForFiberSection(
      fiberSection,
      oldFiberSection
    );

    // Create protocol event
    const protocolEvent = {
      type: 'fiber_section_updated',
      data: {
        eventType: payload.eventType.toLowerCase(),
        fiberSection,
        oldFiberSection:
          payload.eventType === 'UPDATE' ? oldFiberSection : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    // Create RealtimeEvent for event sourcing
    const realtimeEvent = {
      id: `fiber_section_${fiberSection.id}_${randomUUID()}`,
      type: 'FiberSectionProgress',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: fiberSection.work_order_id || fiberSection.project_id,
      userId: 'system', // FiberSection doesn't have assigned_to field
      metadata: {
        eventType: payload.eventType,
        table: payload.table,
        rooms,
      },
      payload: {
        sectionId: fiberSection.id,
        overallProgress: 0, // Default progress since field doesn't exist
        currentPhase: 'planning' as const, // Default phase
        location: {
          latitude: 0, // Default location since field structure is different
          longitude: 0,
        },
        estimatedTimeRemaining: 0, // Default time
      },
    } as unknown as RealtimeEvent;

    // TODO: Re-enable event sourcing after module resolution is fixed
    if (this.eventSourcingService) {
      try {
        // Store event in event sourcing system
        await this.eventSourcingService.processEvents(
          [realtimeEvent],
          fiberSection.id,
          'fiber_section'
        );
      } catch (error) {
        logger.error(
          'Failed to store fiber section event in event sourcing system',
          {
            error,
            eventId: realtimeEvent.id,
            fiberSectionId: fiberSection.id,
          }
        );
        // Continue with broadcast even if event sourcing fails
      }
    }

    // Broadcast to relevant rooms
    rooms.forEach(room => {
      this.gateway.broadcastToRoom(room, protocolEvent);
      logger.debug('Broadcasted fiber section event', {
        room,
        eventType: payload.eventType,
      });
    });
  }

  private getAffectedRooms(
    workOrder: WorkOrder,
    oldWorkOrder?: WorkOrder
  ): string[] {
    const rooms: string[] = [];

    if (workOrder?.project_id) {
      // Project-wide room
      rooms.push(`project:${workOrder.project_id}`);

      // Work order specific room
      rooms.push(`work_order:${workOrder.id}`);

      // Assigned user room
      if (workOrder.assigned_to) {
        rooms.push(`user:${workOrder.assigned_to}`);
      }
    }

    // If assignment changed, notify old assignee too
    if (
      oldWorkOrder?.assigned_to &&
      oldWorkOrder.assigned_to !== workOrder?.assigned_to
    ) {
      rooms.push(`user:${oldWorkOrder.assigned_to}`);
    }

    return [...new Set(rooms)]; // Remove duplicates
  }

  private getAffectedRoomsForFiberSection(
    fiberSection: FiberSection,
    oldFiberSection?: FiberSection
  ): string[] {
    const rooms: string[] = [];

    if (fiberSection?.project_id) {
      // Project-wide room
      rooms.push(`project:${fiberSection.project_id}`);

      // Fiber section specific room
      rooms.push(`fiber_section:${fiberSection.id}`);

      // Related work order room
      if (fiberSection.work_order_id) {
        rooms.push(`work_order:${fiberSection.work_order_id}`);
      }
    }

    // If work order association changed, notify old work order room too
    if (
      oldFiberSection?.work_order_id &&
      oldFiberSection.work_order_id !== fiberSection?.work_order_id
    ) {
      rooms.push(`work_order:${oldFiberSection.work_order_id}`);
    }

    return [...new Set(rooms)]; // Remove duplicates
  }

  public async stop(): Promise<void> {
    logger.info('Stopping Supabase real-time bridge');

    // Unsubscribe from all channels
    await Promise.all(
      this.channels.map(channel => this.supabase.removeChannel(channel))
    );

    this.channels = [];
    logger.info('Supabase real-time bridge stopped');
  }
}
