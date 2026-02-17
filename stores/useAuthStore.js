import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  profile: null,
  isLoading: true,
  error: null,

  // Actions
  setUser: (user) => set({ user, error: null }),

  setProfile: (profile) => set({ profile }),

  clearUser: () => set({ user: null, profile: null }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Selectors
  isAuthenticated: () => get().user !== null,

  getUserId: () => get().user?.id ?? null,

  getUserEmail: () => get().user?.email ?? null,

  getUserName: () => {
    const { user, profile } = get()
    return profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  },

  getUserAvatar: () => {
    const { user, profile } = get()
    return profile?.avatar_url || user?.user_metadata?.avatar_url || null
  },
}))
