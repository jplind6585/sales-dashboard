import '../styles/globals.css'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ErrorBoundary from '../components/common/ErrorBoundary'
import AuthGuard from '../components/auth/AuthGuard'
import MigrationPrompt from '../components/auth/MigrationPrompt'
import GlobalAssistant from '../components/layout/GlobalAssistant'
import CommandPalette from '../components/layout/CommandPalette'
import { isSupabaseConfigured } from '../lib/supabase'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  // Public prospect-facing pages (/share/*) get no internal chrome (assistant, palette, prompts).
  const isPublic = (router.pathname || '').startsWith('/share/')
  // Check if Supabase is configured
  const useSupabase = isSupabaseConfigured() &&
    process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/Banner_Icon.jpg" />
        <title>Banner Sales</title>
      </Head>
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to try again."
    >
      {useSupabase ? (
        <AuthGuard>
          {!isPublic && <MigrationPrompt />}
          <Component {...pageProps} />
          {!isPublic && <CommandPalette />}
          {!isPublic && <GlobalAssistant />}
        </AuthGuard>
      ) : (
        <Component {...pageProps} />
      )}
    </ErrorBoundary>
    </>
  )
}
