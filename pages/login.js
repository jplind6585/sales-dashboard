import Head from 'next/head'
import { useRouter } from 'next/router'
import LoginButton from '../components/auth/LoginButton'
import { BarChart3, AlertTriangle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const isUnauthorizedDomain = router.query.error === 'unauthorized_domain'

  return (
    <>
      <Head>
        <title>Sign In | Sales Dashboard</title>
        <meta name="description" content="Sign in to your Sales Dashboard account" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-10 w-10 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
            </div>
            <p className="text-gray-600 text-center">
              Track your accounts, analyze calls, and close more deals with AI-powered insights.
            </p>
          </div>

          {isUnauthorizedDomain && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Access is restricted to <strong>@withbanner.com</strong> accounts. Please sign in with your Banner email.
              </p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500 text-center mb-4">
              Sign in with your @withbanner.com account
            </p>
            <LoginButton />
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Your data is securely stored and only visible to you.
          </p>
        </div>
      </div>
    </>
  )
}
