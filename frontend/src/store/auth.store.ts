import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CognitoUser } from '@/types'

interface AuthState {
  user: CognitoUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: CognitoUser) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<CognitoUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: (user: CognitoUser) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading: boolean) =>
        set({
          isLoading: loading,
        }),

      updateUser: (partial: Partial<CognitoUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: 'activa-club-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
