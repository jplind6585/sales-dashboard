// Server-side PKCE code exchange — avoids "code verifier not found in storage"
// error that occurs when client-side createBrowserClient can't find the verifier
// after a full page reload through Google's OAuth redirect.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  const code = req.query.code
  const errorParam = req.query.error
  const errorDesc = req.query.error_description

  if (errorParam) {
    return res.redirect(`/login?error=${encodeURIComponent(errorDesc || errorParam)}`)
  }

  if (!code) {
    return res.redirect('/login?error=no_code')
  }

  // DEBUG: log cookie names to understand what's arriving
  const cookieKeys = Object.keys(req.cookies || {})
  console.log('[auth/callback] cookies received:', cookieKeys)
  console.log('[auth/callback] code verifier present:', cookieKeys.some(k => k.includes('code-verifier')))

  const supabase = createServerSupabaseClient(req, res)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.session) {
    const debugInfo = `${error?.message || 'no_session'} | cookies: ${cookieKeys.filter(k => k.includes('sb-')).join(',') || 'none'}`
    return res.redirect(`/login?error=${encodeURIComponent(debugInfo)}`)
  }

  const session = data.session
  const email = session.user?.email || ''

  if (!email.endsWith('@withbanner.com')) {
    await supabase.auth.signOut()
    return res.redirect('/login?error=unauthorized_domain')
  }

  // Auto-provision profile on first sign-in
  const db = getSupabase()
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    await db.from('profiles').insert({
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
      role: 'rep',
    })

    // Fire-and-forget Gong onboarding sync
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`
    fetch(`${baseUrl}/api/gong/onboarding-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
    }).catch(err => console.warn('Gong onboarding sync failed:', err))
  }

  return res.redirect('/modules/tasks')
}
