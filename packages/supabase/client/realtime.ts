import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import { supabase } from './core';
import type { Database } from '../types/database';

// ---------------------------------------------------------------------------
// Table meta
// ---------------------------------------------------------------------------

export const managedTableNames = [
  'projects',
  'fiber_routes',
  'fiber_connections',
  'tasks',
  'photos',
  'customer_agreements',
] as const;

export type ManagedTableName = (typeof managedTableNames)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeDispatch<
  T extends ManagedTableName | keyof Database['public']['Tables'] = ManagedTableName,
> = (
  payload: RealtimePostgresChangesPayload<
    Database['public']['Tables'][T & keyof Database['public']['Tables']]['Row']
  >,
  table: T,
) => void;

// ---------------------------------------------------------------------------
// Internals – global channel registry
// ---------------------------------------------------------------------------

/**
 * Registry of active channels, keyed by table name.  Ensures we never create
 * more than one channel for the same table.
 */
let activeChannels: Map<string, RealtimeChannel> = new Map();

/**
 * Subscribe to a single table, wiring all events (`*`) to `handler`.
 *
 * If a channel for the given table already exists, that channel is re-used and
 * the new handler is simply attached to it.
 */
export const subscribeToTable = <
  T extends keyof Database['public']['Tables'],
>(
  table: T,
  handler: RealtimeDispatch<T>,
): RealtimeChannel => {
  const tableName = String(table);

  // -------------------------------------------------------------------------
  // Ensure a single channel per table
  // -------------------------------------------------------------------------
  let channel = activeChannels.get(tableName);
  let isNewChannel = false;

  if (!channel) {
    channel = supabase.channel(`public:${tableName}`);
    activeChannels.set(tableName, channel);
    isNewChannel = true;
  }

  // -------------------------------------------------------------------------
  // Attach the event listener *before* subscribing to avoid missing messages
  // -------------------------------------------------------------------------
  channel.on(
    'postgres_changes',
    { schema: 'public', table: tableName, event: '*' },
    (payload) => {
      handler(
        payload as RealtimePostgresChangesPayload<
          Database['public']['Tables'][T]['Row']
        >,
        table,
      );
    },
  );

  // -------------------------------------------------------------------------
  // Subscribe only once, and only for newly–created channels
  // -------------------------------------------------------------------------
  if (isNewChannel) {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') return;
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        // eslint-disable-next-line no-console
        console.error(
          `[supabase:realtime] Channel error (${status}) on table "${tableName}".`,
        );
      }
      if (status === 'CLOSED') {
        activeChannels.delete(tableName);
      }
    });
  }

  return channel;
};

// ---------------------------------------------------------------------------
// Centralised subscription helpers
// ---------------------------------------------------------------------------

/**
 * Initialises real-time listeners for all `managedTableNames`.
 * Re-invoking this function will clear any existing listeners first.
 */
export const initRealtimeSubscriptions = (
  dispatch: RealtimeDispatch<ManagedTableName>,
) => {
  removeRealtimeSubscriptions();

  managedTableNames.forEach((table) =>
    subscribeToTable(table, dispatch as RealtimeDispatch<typeof table>),
  );
};

/**
 * Clean-up helper that disconnects and removes *all* active channels created
 * via any of this module’s helpers.
 */
export const removeRealtimeSubscriptions = () => {
  activeChannels.forEach((channel) => supabase.removeChannel(channel));
  activeChannels.clear();
};
