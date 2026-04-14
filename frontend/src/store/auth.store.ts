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
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (user: CognitoUser) => void
  /**
   * AC-008/AC-010: Full logout.
   * Calls backend GlobalSignOut, removes the refresh token from localStorage,
   * and clears all local auth state. On the next visit, LoginPage will show
   * the login form (no silent refresh because the refresh token is gone).
   */
  logout: () => Promise<void>
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<CognitoUser>) => void
  /**
   * Decodes the JWT idToken, builds a CognitoUser from its claims,
   * and persists both to the store. Used after CUSTOM_AUTH verify-otp success.
   */
  setTokens: (idToken: string, accessToken: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      idToken: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: (user: CognitoUser) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: async () => {
        // Soft logout — the refresh token in localStorage is intentionally kept
        // so the remember-device flow (AC-010) remains active for 30 days.
        //
        // The flag tells LoginPage to show the login form instead of silently
        // refreshing. We do NOT use window.location.href here — the caller
        // (Header) navigates via React Router so there is no full page reload,
        // meaning the store's in-memory state (isAuthenticated: false) is already
        // correct when LoginPage mounts. No sessionStorage race condition.
        sessionStorage.setItem('activa-club-logged-out', 'true')
        set({ user: null, idToken: null, accessToken: null, isAuthenticated: false, isLoading: false })
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

      setTokens: (idToken: string, accessToken: string) => {
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
          accessToken,
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
        // accessToken is intentionally excluded — kept only in memory for this tab
      }),
    }
  )
)
