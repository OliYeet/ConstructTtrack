import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

/**
 * Internal cache for the singleton Supabase client instance.
 */
let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Lazily create (or return) the Supabase client.
 *
 * Environment variables are validated *only* when this function is first
 * invoked, avoiding eager crashes during module import and giving consumers
 * flexibility to set env-vars programmatically (e.g. in tests).
 */
export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (cachedClient) return cachedClient;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables (SUPABASE_URL / SUPABASE_ANON_KEY)'
    );
  }

  cachedClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
};

/**
 * A proxy that forwards all property access to the lazily-initialised client
 * returned by `getSupabaseClient()`.  This maintains full compatibility with
 * existing `import { supabase } from './core'` call-sites.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop: keyof SupabaseClient<Database>) {
    const client = getSupabaseClient();

    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(_target, prop: keyof SupabaseClient<Database>, value) {
    const client = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[prop] = value;
    return true;
  },
}) as SupabaseClient<Database>;
