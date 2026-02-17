import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '../../stores/useAuthStore'
import { onAuthStateChange, getSession } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function AuthGuard({ children }) {
  const router = useRouter()
  const { user, setUser, clearUser, isLoading, setIsLoading } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)

  // Check if we should bypass auth (Supabase not configured or feature flag off)
  const shouldBypassAuth = !isSupabaseConfigured() ||
    process.env.NEXT_PUBLIC_USE_SUPABASE === 'false'

  useEffect(() => {
    // If Supabase isn't configured, bypass auth
    if (shouldBypassAuth) {
      setIsInitialized(true)
      setIsLoading(false)
      return
    }

    // Initialize auth state
    const initAuth = async () => {
      const { session } = await getSession()
      if (session?.user) {
        setUser(session.user)
      } else {
        clearUser()
      }
      setIsInitialized(true)
      setIsLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        clearUser()
      }
    })

    return () => unsubscribe()
  }, [shouldBypassAuth, setUser, clearUser, setIsLoading])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isInitialized || shouldBypassAuth) return

    const isLoginPage = router.pathname === '/login'

    if (!user && !isLoginPage) {
      router.push('/login')
    } else if (user && isLoginPage) {
      router.push('/')
    }
  }, [user, isInitialized, router, shouldBypassAuth])

  // Show loading state while initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // If bypassing auth, always render children
  if (shouldBypassAuth) {
    return children
  }

  // Don't render protected content if not authenticated (except login page)
  if (!user && router.pathname !== '/login') {
    return null
  }

  return children
}
