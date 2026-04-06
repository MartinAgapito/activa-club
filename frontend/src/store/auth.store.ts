import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
  /**
   * AC-008: Logout action.
   * Calls POST /v1/auth/logout to invalidate all Cognito sessions,
   * then clears the local store.
   *
   * Behavior:
   *   - Success (200): clears the store and redirects to /auth/login.
   *   - 401 (token expired/revoked): clears the store and redirects to /auth/login.
   *   - Network error: surfaces the error and does NOT clear the store.
   */
  logout: () => Promise<void>
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

      logout: async () => {
        const { idToken } = useAuthStore.getState()

        // If there is no token the session is already gone — just clear local state.
        if (!idToken) {
          set({ user: null, idToken: null, isAuthenticated: false, isLoading: false })
          window.location.href = '/auth/login'
          return
        }

        set({ isLoading: true })

        try {
          // Lazy import avoids a circular dependency:
          // auth.store → auth.api → client → useAuthStore → auth.store
          const { authApi } = await import('@/api/auth.api')
          await authApi.logout(idToken)
          // Success — clear the store and redirect to login
          set({ user: null, idToken: null, isAuthenticated: false, isLoading: false })
          window.location.href = '/auth/login'
        } catch (error: unknown) {
          const axiosError = error as {
            response?: { status?: number }
            message?: string
          }
          const status = axiosError?.response?.status

          if (status === 401) {
            // Token already expired or revoked — treat as logged out
            set({ user: null, idToken: null, isAuthenticated: false, isLoading: false })
            window.location.href = '/auth/login'
            return
          }

          // Network error or unexpected server error — do NOT clear the store
          set({ isLoading: false })
          throw error
        }
      },

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

        // Resolve role from cognito:groups with precedence: Admin > Manager > Member
        const groups = (claims['cognito:groups'] as string[] | undefined) ?? []
        let role: UserRole = 'Member'
        if (groups.includes('Admin')) {
          role = 'Admin'
        } else if (groups.includes('Manager')) {
          role = 'Manager'
        }

        const cognitoUser: CognitoUser = {
          userId: (claims['sub'] as string) ?? '',
          username:
            (claims['cognito:username'] as string) ?? (claims['email'] as string) ?? '',
          email: (claims['email'] as string) ?? '',
          role,
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
      // sessionStorage: tokens survive F5 but are cleared when the tab is closed.
      // This avoids the original localStorage concern (AC-006/AC-007) while keeping
      // the user logged in across page refreshes within the same browser session.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        idToken: state.idToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
