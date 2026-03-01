import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CognitoUser, UserRole } from '@/types'

/** Decodes the payload of a JWT without any external library. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}

interface AuthState {
  user: CognitoUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Cognito IdToken — used as Bearer token for API calls. */
  idToken: string | null

  login: (user: CognitoUser) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<CognitoUser>) => void
  /**
   * Called after a successful verify-otp response.
   * Decodes the idToken to build the CognitoUser and persists the token.
   */
  setTokens: (idToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      idToken: null,

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
          idToken: null,
        }),

      setLoading: (loading: boolean) =>
        set({ isLoading: loading }),

      updateUser: (partial: Partial<CognitoUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      setTokens: (idToken: string) => {
        const payload = decodeJwtPayload(idToken)
        const groups = (payload['cognito:groups'] as string[] | undefined) ?? []
        const role: UserRole = groups.includes('Admin')
          ? 'Admin'
          : groups.includes('Manager')
            ? 'Manager'
            : 'Member'

        const user: CognitoUser = {
          userId: (payload['sub'] as string) ?? '',
          username: (payload['cognito:username'] as string) ?? (payload['email'] as string) ?? '',
          email: (payload['email'] as string) ?? '',
          role,
        }

        set({
          idToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      },
    }),
    {
      name: 'activa-club-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        idToken: state.idToken,
      }),
    },
  ),
)
