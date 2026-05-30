/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Optional: gate the app behind one shared passcode. */
  readonly VITE_APP_PASSCODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
