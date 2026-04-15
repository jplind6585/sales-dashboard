import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ── Browser client (for React components / client-side code) ──────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Singleton for client-side use
let supabaseInstance = null

export function getSupabase() {
  if (typeof window === 'undefined') {
    // Server-side: use service role key so DB operations succeed regardless of RLS.
    // Auth is validated at the API route level via createServerSupabaseClient().
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  if (!supabaseInstance) supabaseInstance = createClient()
  return supabaseInstance
}

// ── Server client for API routes (reads session from request cookies) ──────────
// Use this in API route handlers to verify the logged-in user.
export function createServerSupabaseClient(req, res) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options = {} }) => {
            const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
            if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
            if (options.domain) parts.push(`Domain=${options.domain}`)
            if (options.secure) parts.push('Secure')
            const existing = res.getHeader('Set-Cookie') || []
            res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : [existing]), parts.join('; ')])
          })
        },
      },
    }
  )
}

// Helper to check if Supabase is configured
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
