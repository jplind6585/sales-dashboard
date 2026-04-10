import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabase } from '../../lib/supabase'

/**
 * Auth callback page — handles the OAuth code exchange after Google sign-in.
 *
 * Supabase redirects here after the user completes Google OAuth.
 * The browser client detects the code in the URL, exchanges it for a session,
 * then fires onAuthStateChange with SIGNED_IN. We wait for that event
 * before redirecting the user to /modules.
 *
 * Without this page, the code lands on /modules and getSession() races
 * against the exchange — usually losing, which sends the user back to /login.
 */
export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Completing sign in...')

  useEffect(() => {
    const supabase = getSupabase()

    // onAuthStateChange fires once the code is exchanged and session is set
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/modules')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })

    // Fallback: if already signed in (e.g. page refresh), redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/modules')
      }
    })

    // Safety timeout — if nothing fires in 10s, send to login
    const timeout = setTimeout(() => {
      setStatus('Something went wrong. Redirecting...')
      router.replace('/login')
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
