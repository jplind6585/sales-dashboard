import { createBrowserClient } from '@supabase/ssr'

// Create a Supabase client for browser-side operations
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Singleton instance for client-side use
let supabaseInstance = null

export function getSupabase() {
  if (typeof window === 'undefined') {
    // Server-side: always create a new instance
    return createClient()
  }

  // Client-side: reuse the same instance
  if (!supabaseInstance) {
    supabaseInstance = createClient()
  }
  return supabaseInstance
}

// Helper to check if Supabase is configured
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
