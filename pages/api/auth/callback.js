import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  const code = req.query.code
  const errorParam = req.query.error
  const errorDesc = req.query.error_description

  if (errorParam) {
    return redirect(res, `/login?error=${encodeURIComponent(errorDesc || errorParam)}`)
  }

  if (!code) {
    return redirect(res, '/login?error=no_code')
  }

  const supabase = createServerSupabaseClient(req, res)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.session) {
    return redirect(res, `/login?error=${encodeURIComponent(error?.message || 'no_session')}`)
  }

  const session = data.session
  const email = session.user?.email || ''

  if (!email.endsWith('@withbanner.com')) {
    await supabase.auth.signOut()
    return redirect(res, '/login?error=unauthorized_domain')
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
      rep_type: session.user.user_metadata?.rep_type || null, // set by admin at invite time
    })

    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`
    fetch(`${baseUrl}/api/gong/onboarding-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
    }).catch(err => console.warn('Gong onboarding sync failed:', err))
  }

  return redirect(res, '/modules/today')
}

// Explicit redirect that preserves Set-Cookie headers set via res.setHeader()
function redirect(res, url) {
  res.setHeader('Location', url)
  res.writeHead(302)
  res.end()
}
