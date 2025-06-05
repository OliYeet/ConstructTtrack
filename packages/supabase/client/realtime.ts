import { type RealtimeChannel, type RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from './index';
import type { Database } from '../types/database';

/**
 * All tables we actively maintain real-time listeners for.
 *
 * Extend this tuple if more tables need to be managed centrally.
 */
export const managedTableNames = [
  'projects',
  'fiber_routes',
  'fiber_connections',
  'tasks',
  'photos',
  'customer_agreements',
] as const;

/**
 * Convenience union type of the managed table names.
 */
export type ManagedTableName = (typeof managedTableNames)[number];

/**
 * Generic dispatch signature for table change events.
 *
 * `payload`  – Raw Postgres change payload for the corresponding table.
 * `table`    – Name of the table that produced the change.
 */
export type RealtimeDispatch<
  T extends ManagedTableName | keyof Database['public']['Tables'] = ManagedTableName,
> = (
  payload: RealtimePostgresChangesPayload<
    // prettier-ignore
    Database['public']['Tables'][T & keyof Database['public']['Tables']]['Row']
  >,
  table: T,
) => void;

/**
 * Subscribe to a single table and forward every INSERT/UPDATE/DELETE
 * payload to the provided handler.
 *
 * The returned `RealtimeChannel` should be stored if you need to manage
 * the subscription life-cycle manually (e.g. for ad-hoc listeners).
 */
export const subscribeToTable = <
  T extends keyof Database['public']['Tables'],
>(
  table: T,
  handler: RealtimeDispatch<T>,
): RealtimeChannel => {
  const channel = supabase
    .channel(`public:${String(table)}`)
    .on(
      'postgres_changes',
      { schema: 'public', table: table as string, event: '*' },
      (payload) => {
        handler(
          payload as RealtimePostgresChangesPayload<
            Database['public']['Tables'][T]['Row']
          >,
          table,
        );
      },
    )
    .subscribe();

  return channel;
};

// ------------------------------------------------------------------
// Centralised, application-wide real-time management helpers
// ------------------------------------------------------------------

/**
 * Internally tracked channels created by `initRealtimeSubscriptions`.
 * Cleared by `removeRealtimeSubscriptions`.
 */
let activeChannels: RealtimeChannel[] = [];

/**
 * Initialise real-time listeners for every table listed in
 * `managedTableNames`.  
 *
 * If initialised more than once, any previous set of listeners is first
 * removed to ensure subscriptions do not accumulate.
 */
export const initRealtimeSubscriptions = (
  dispatch: RealtimeDispatch<ManagedTableName>,
) => {
  // Remove any existing listeners to avoid duplicates.
  removeRealtimeSubscriptions();

  activeChannels = managedTableNames.map((table) =>
    subscribeToTable(table, dispatch as RealtimeDispatch<typeof table>),
  );
};

/**
 * Disconnect and clean up all channels previously created via
 * `initRealtimeSubscriptions`.
 *
 * Safe to call even if no active channels exist.
 */
export const removeRealtimeSubscriptions = () => {
  if (activeChannels.length === 0) return;

  activeChannels.forEach((channel) => {
    // `removeChannel` handles both open and already-closed channels.
    supabase.removeChannel(channel);
  });

  activeChannels = [];
};
