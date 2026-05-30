// Single persistence entry point.
//
// The rest of the app imports `db` from here and never knows which backend is
// behind it. Backend selection is decided once, at module load:
//   - Supabase env vars present  → SupabaseDB  (shared live data + realtime)
//   - otherwise                  → LocalStorageDB (Phase 1 local-only mode)
//
// localStorage also acts as an offline read cache when Supabase is active.

import { LocalStorageDB } from './localDb'
import { SupabaseDB } from './supabaseDb'
import { supabase, isRemote } from './supabase'

export type { DraktlagerDB, NewTransaction } from './dbTypes'
export { isRemote }

/** The single db instance the whole app talks to. */
export const db = supabase ? new SupabaseDB(supabase) : new LocalStorageDB()
