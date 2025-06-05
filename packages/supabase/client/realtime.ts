import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import type { Database } from '../types/database';

import { supabase } from './core';

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
// Internals - per-channel handler registry to avoid duplicate listeners
// ---------------------------------------------------------------------------

type AnyRealtimeDispatch = RealtimeDispatch<any>;

/**
 * Stores, for each channel, a map of the external `handler` provided to
 * `subscribeToTable` → the internally-created callback passed to
 * `channel.on(...)`.  Using WeakMaps means entries disappear automatically
 * when either the channel or handler becomes unreachable.
 */
const channelHandlerRegistry: WeakMap<
  RealtimeChannel,
  WeakMap<AnyRealtimeDispatch, (payload: unknown) => void>
> = new WeakMap();

// ---------------------------------------------------------------------------
// Internals - global channel registry
// ---------------------------------------------------------------------------

/**
 * Registry of active channels, keyed by table name.  Ensures we never create
 * more than one channel for the same table.
 */
const activeChannels: Map<string, RealtimeChannel> = new Map();

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

  // and prevent duplicate handlers for the same channel
  // -------------------------------------------------------------------------

  let handlerMap = channelHandlerRegistry.get(channel);
  if (!handlerMap) {
    handlerMap = new WeakMap();
    channelHandlerRegistry.set(channel, handlerMap);
  }

  // Only register the listener if this exact handler hasn’t been added yet.
  if (!handlerMap.has(handler as AnyRealtimeDispatch)) {
    // Store a callback whose parameter type is `unknown` so it is compatible
    // with the `channelHandlerRegistry` value type. The concrete
    // `RealtimePostgresChangesPayload` type is restored when forwarding the
    // payload to the user-supplied `handler`.
    const wrappedCallback = (payload: unknown) => {
      handler(
        payload as RealtimePostgresChangesPayload<
          Database['public']['Tables'][T]['Row']
        >,
        table,
      );
    };

    handlerMap.set(handler as AnyRealtimeDispatch, wrappedCallback);

    channel.on(
      'postgres_changes',
      { schema: 'public', table: tableName, event: '*' },
      wrappedCallback,
    );
  }

  // -------------------------------------------------------------------------
  // Subscribe only once, and only for newly-created channels
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
        // Remove any handler registry for this channel to free memory
        channelHandlerRegistry.delete(channel);
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
  activeChannels.forEach((channel) => {
    supabase.removeChannel(channel);
    channelHandlerRegistry.delete(channel);
  });
  activeChannels.clear();
};
