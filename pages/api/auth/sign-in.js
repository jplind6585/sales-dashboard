// Generates the Google OAuth URL server-side so that the PKCE code verifier
// is stored in a server-set cookie (via setAll) rather than via document.cookie.
// This guarantees the verifier is in req.cookies when the callback fires.
import { createServerSupabaseClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  const supabase = createServerSupabaseClient(req, res)

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const siteUrl = `${proto}://${host}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(' '),
      redirectTo: `${siteUrl}/api/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
      skipBrowserRedirect: true,
    },
  })

  if (error || !data?.url) {
    return res.status(500).json({ error: error?.message || 'Failed to create OAuth URL' })
  }

  // Code verifier is now in Set-Cookie on this response (written by setAll).
  // Return the URL — client will redirect to it.
  return res.status(200).json({ url: data.url })
}
