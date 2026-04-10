import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Check if Supabase is configured
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false';

      if (useAuth) {
        // Auth is enabled - check if user is logged in
        const { user } = await getCurrentUser();

        if (user) {
          router.replace('/modules/tasks');
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/modules/tasks');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  // Show loading spinner while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
