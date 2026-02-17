import { getSupabase } from './supabase'

/**
 * Sign in with Google OAuth
 * @returns {Promise<{error: Error|null}>}
 */
export async function signInWithGoogle() {
  const supabase = getSupabase()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/modules`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  return { error }
}

/**
 * Sign out the current user
 * @returns {Promise<{error: Error|null}>}
 */
export async function signOut() {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Get the current user
 * @returns {Promise<{user: User|null, error: Error|null}>}
 */
export async function getCurrentUser() {
  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

/**
 * Get the current session
 * @returns {Promise<{session: Session|null, error: Error|null}>}
 */
export async function getSession() {
  const supabase = getSupabase()
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with (event, session) on auth changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const supabase = getSupabase()
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}

/**
 * Get user profile from profiles table
 * @param {string} userId
 * @returns {Promise<{profile: Object|null, error: Error|null}>}
 */
export async function getUserProfile(userId) {
  const supabase = getSupabase()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { profile, error }
}

/**
 * Update user profile
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<{profile: Object|null, error: Error|null}>}
 */
export async function updateUserProfile(userId, updates) {
  const supabase = getSupabase()

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  return { profile, error }
}
