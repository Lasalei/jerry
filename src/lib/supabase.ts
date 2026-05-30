// Supabase client. Returns null when the env vars are absent, which makes the
// app fall back to the localStorage backend (see ./db).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 5 } },
      })
    : null

/** True when the app is talking to Supabase rather than localStorage. */
export const isRemote = supabase !== null
