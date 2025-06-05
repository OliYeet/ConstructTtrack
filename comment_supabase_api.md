## 🔌 Supabase Real-Time Subscription API — Specification & Lifecycle

This comment documents the public surface that landed with the recent client refactor. It should
answer **what lives where**, **what to call**, and **how the runtime behaves** when you wire
real-time events into the UI.

---

### 1. File responsibilities

| File                                   | Role                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/supabase/client/core.ts`     | _Single source of truth_ for the Supabase singleton. The instance is **lazily initialised** – the first call to `getSupabaseClient()` spins it up. No other file constructs a client. |
| `packages/supabase/client/get.ts`      | Exposes `getSupabaseClient()` – a tiny helper that returns the singleton from `core.ts`, triggering creation on first-use.                                                         |
| `packages/supabase/client/index.ts`    | Auth helpers (`signIn`, `signOut`, `getUser`, …) **plus** re-exports of the real-time utilities so consumers can do `import { subscribeToTable } from '@constructtrack/supabase'`. |
| `packages/supabase/client/realtime.ts` | All subscription logic, channel bookkeeping, and strongly-typed helpers live here.                                                                                                 |

---

### 2. Key types & generics

```ts
// Tuple of tables that we manage centrally
export const managedTableNames = [
  'projects',
  'fiber_routes',
  'fiber_connections',
  'tasks',
  'photos',
  'customer_agreements',
] as const;

export type ManagedTableName = (typeof managedTableNames)[number];

// Dispatch signature delivered to every handler
export type RealtimeDispatch<
  T extends ManagedTableName | keyof Database['public']['Tables'] = ManagedTableName,
> = (
  payload: RealtimePostgresChangesPayload<
    Database['public']['Tables'][T & keyof Database['public']['Tables']]['Row']
  >,
  table: T
) => void;
```

_Why so specific?_ The extra generics give us **fully-typed payload rows** for every table while
still letting consumers down-cast to `any` if they really want.

---

### 3. Public API surface

```ts
// 3.0  — obtain (or lazily create) the singleton Supabase client
getSupabaseClient(): SupabaseClient<Database>;

// 3.1  — subscribe to ONE table
subscribeToTable<
  T extends keyof Database['public']['Tables']
>(
  table: T,
  handler: RealtimeDispatch<T>,
): RealtimeChannel;

// 3.2  — subscribe to ALL managed tables (see tuple above)
initRealtimeSubscriptions(
  dispatch: RealtimeDispatch,
): void;

// 3.3  — teardown everything initialised by #2
removeRealtimeSubscriptions(): void;
```

- Every helper **returns `void`** except:
  - `subscribeToTable`, which gives you the raw
    `RealtimeChannel` in case you want to pause/resume or attach additional listeners.
  - `getSupabaseClient`, which returns the lazily-initialised singleton Supabase client so
    callers can issue normal queries outside the real-time helpers.

---

### 4. Error & status propagation

`subscribeToTable` now passes a callback to `channel.subscribe(status => …)`.

```ts
// inside realtime.ts
.subscribe((status) => {
  if (status !== 'SUBSCRIBED') {
    // "CLOSED", "TIMED_OUT", etc. — surface it.
    console.warn(`[supabase] channel %s: %s`, table, status); // dev-friendly
  }
});
```

We deliberately **log** instead of throwing to avoid crashing the UI; callers can still attach
`RealtimeChannel.on('error', …)` for finer handling.

---

### 5. Channel registry & leak prevention

```ts
// module-level Map< tableName, RealtimeChannel >
const activeChannels = new Map<string, RealtimeChannel>();
```

- **One channel per table**: duplicate calls to `subscribeToTable('projects', …)` reuse the existing
channel.
- **Hot-module reload & SSR safe**: Because `activeChannels` lives _inside_ `realtime.ts`, each
module instance (client-side bundle or Node SSR pass) maintains its own registry. No global leaks
into `window` or `globalThis`.

---

### 6. Lifecycle semantics

1. **App start** ➜ call `initRealtimeSubscriptions(dispatch)` once (e.g. in a root React effect or
   Redux thunk).
2. Internally, the helper loops the `managedTableNames` tuple and creates channels for each table,
   wiring **insert / update / delete** events to your `dispatch` function.
3. **App stop / route change / test teardown** ➜ call `removeRealtimeSubscriptions()`; it iterates
   the registry, unsubscribes every channel, and clears the map.
4. For ad-hoc or advanced scenarios you can still use `subscribeToTable` directly and manage the
   returned `RealtimeChannel` yourself.

_Side-effects_: The helpers do **not** mutate any global store; the consumer-supplied `dispatch`
decides how to merge the payload into Zustand, Redux, React state, etc.

---

### 7. Example usage

```ts
// ProjectRealtimeProvider.tsx (React)
import { useEffect } from 'react';
import { initRealtimeSubscriptions, removeRealtimeSubscriptions } from '@constructtrack/supabase';

import { useProjectStore } from '@/store/project-store';

export function ProjectRealtimeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useProjectStore((state) => state.applyRealtimeChange);

  useEffect(() => {
    // 1️⃣ wire everything up once the component mounts
    initRealtimeSubscriptions(dispatch);

    // 2️⃣ clean up on unmount (or hot-reload)
    return () => removeRealtimeSubscriptions();
  }, [dispatch]);

  return <>{children}</>;
}
```

```ts
// ad-hoc: background job subscribing to a single table
import { subscribeToTable } from '@constructtrack/supabase';

const channel = subscribeToTable('tasks', payload => {
  console.log('task changed →', payload.new);
});

// later
await channel.unsubscribe();
```

---

### 8. Questions / tweaks

Have naming, typing, or error-handling ideas? Drop them below and we’ll iterate. Otherwise, this
spec represents the **intended contract** going forward. Breaking changes will be versioned under
`@constructtrack/supabase`.
