import Head from 'next/head'
import LoginButton from '../components/auth/LoginButton'
import { BarChart3 } from 'lucide-react'

export default function LoginPage() {
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

          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500 text-center mb-4">
              Sign in to continue
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
