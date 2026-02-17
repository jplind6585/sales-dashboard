import '../styles/globals.css'
import ErrorBoundary from '../components/common/ErrorBoundary'
import AuthGuard from '../components/auth/AuthGuard'
import MigrationPrompt from '../components/auth/MigrationPrompt'
import { isSupabaseConfigured } from '../lib/supabase'

export default function App({ Component, pageProps }) {
  // Check if Supabase is configured
  const useSupabase = isSupabaseConfigured() &&
    process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'

  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to try again."
    >
      {useSupabase ? (
        <AuthGuard>
          <MigrationPrompt />
          <Component {...pageProps} />
        </AuthGuard>
      ) : (
        <Component {...pageProps} />
      )}
    </ErrorBoundary>
  )
}
