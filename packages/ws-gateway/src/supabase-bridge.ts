/**
 * Supabase Event Bridge
 * Maps Supabase real-time events to WebSocket protocol events
 * Focus on work_orders and fiber_sections per Charlie's guidance
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

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

  constructor(gateway: WebSocketGateway) {
    this.gateway = gateway;
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
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
        payload =>
          this.handleWorkOrderEvent(
            payload as RealtimePostgresChangesPayload<WorkOrder>
          )
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
        payload =>
          this.handleFiberSectionEvent(
            payload as RealtimePostgresChangesPayload<FiberSection>
          )
      )
      .subscribe();

    this.channels.push(workOrdersChannel, fiberSectionsChannel);

    logger.info('Supabase real-time subscriptions active', {
      channels: ['work_orders', 'fiber_sections'],
    });
  }

  private handleWorkOrderEvent(
    payload: RealtimePostgresChangesPayload<WorkOrder>
  ): void {
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

    // Broadcast to relevant rooms
    rooms.forEach(room => {
      this.gateway.broadcastToRoom(room, protocolEvent);
      logger.debug('Broadcasted work order event', {
        room,
        eventType: payload.eventType,
      });
    });
  }

  private handleFiberSectionEvent(
    payload: RealtimePostgresChangesPayload<FiberSection>
  ): void {
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
