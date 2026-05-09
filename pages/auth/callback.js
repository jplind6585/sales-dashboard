// This page is no longer the primary callback handler.
// OAuth redirects go to /api/auth/callback (server-side PKCE exchange).
// This page only renders if someone navigates here directly.
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // If landed here with a code, forward to the API route handler
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.location.replace(`/api/auth/callback${window.location.search}`)
    } else {
      router.replace('/login')
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
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}
