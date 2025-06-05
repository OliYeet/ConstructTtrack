import { supabase } from './core';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export const signUp = async (
  email: string,
  password: string,
  metadata?: Record<string, unknown>
) => {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
};

export const signIn = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signOut = () => supabase.auth.signOut();
export const getCurrentUser = () => supabase.auth.getUser();
export const getSession = () => supabase.auth.getSession();

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { supabase, getSupabaseClient } from './core';

export {
  subscribeToTable,
  initRealtimeSubscriptions,
  removeRealtimeSubscriptions,
  type ManagedTableName,
  type RealtimeDispatch,
} from './realtime';
