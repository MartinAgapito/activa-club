import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CognitoUser, UserRole } from '@/types'

// ─── JWT decode helper (no external dependency needed) ───────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1]
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ─── State interface ──────────────────────────────────────────────────────────

interface AuthState {
  user: CognitoUser | null
  idToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (user: CognitoUser) => void
  logout: () => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<CognitoUser>) => void
  /**
   * Decodes the JWT idToken, builds a CognitoUser from its claims,
   * and persists both to the store. Used after CUSTOM_AUTH verify-otp success.
   */
  setTokens: (idToken: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      idToken: null,
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
          idToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      clearAuth: () =>
        set({
          user: null,
          idToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      updateUser: (partial: Partial<CognitoUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      setTokens: (idToken: string) => {
        const claims = decodeJwtPayload(idToken)

        const cognitoUser: CognitoUser = {
          userId: (claims['sub'] as string) ?? '',
          username:
            (claims['cognito:username'] as string) ?? (claims['email'] as string) ?? '',
          email: (claims['email'] as string) ?? '',
          role: ((claims['custom:role'] as UserRole) ?? 'Member') as UserRole,
          signInDetails: {
            loginId: (claims['email'] as string) ?? '',
            authFlowType: 'CUSTOM_AUTH',
          },
        }

        set({
          idToken,
          user: cognitoUser,
          isAuthenticated: true,
          isLoading: false,
        })
      },
    }),
    {
      name: 'activa-club-auth',
      // Tokens and auth state are intentionally excluded — JWTs must not persist
      // in localStorage (AC-006/AC-007). On page refresh the user re-authenticates.
      // Only the user profile is kept for display purposes (e.g. welcome messages).
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
)
