import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabase } from '../../lib/supabase'

/**
 * Auth callback page — handles PKCE code exchange after Google sign-in.
 *
 * @supabase/ssr's createBrowserClient does not auto-exchange the authorization
 * code. We must call exchangeCodeForSession() explicitly with the code from
 * the URL, then redirect once the session is established.
 */
export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Completing sign in...')

  useEffect(() => {
    const supabase = getSupabase()
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      // No code in URL — check if already signed in (e.g. page refresh)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace('/modules/tasks')
        } else {
          router.replace('/login')
        }
      })
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        console.error('[auth/callback] exchangeCodeForSession error:', error?.message)
        setStatus('Sign in failed. Redirecting...')
        router.replace('/login')
        return
      }

      const session = data.session

      // Restrict to @withbanner.com
      const email = session.user?.email || ''
      if (!email.endsWith('@withbanner.com')) {
        await supabase.auth.signOut()
        router.replace('/login?error=unauthorized_domain')
        return
      }

      // Auto-provision profile on first sign-in
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        await supabase.from('profiles').insert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
          role: 'rep',
        })

        fetch('/api/gong/onboarding-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
        }).catch(err => console.warn('Gong onboarding sync failed:', err))
      }

      router.replace('/modules/tasks')
    })
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  )
}
