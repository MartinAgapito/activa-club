import { useCallback } from 'react'
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth'
import { useAuthStore } from '@/store'
import type { CognitoUser, UserRole } from '@/types'

interface SignInParams {
  email: string
  password: string
}

interface UseAuthReturn {
  user: CognitoUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (params: SignInParams) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isLoading, login, logout, setLoading } = useAuthStore()

  const handleSignIn = useCallback(
    async ({ email, password }: SignInParams) => {
      setLoading(true)
      try {
        await signIn({ username: email, password })
        await refreshUser()
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  const handleSignOut = useCallback(async () => {
    setLoading(true)
    try {
      await signOut()
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout, setLoading])

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      const attributes = await fetchUserAttributes()

      const cognitoUser: CognitoUser = {
        userId: currentUser.userId,
        username: currentUser.username,
        email: attributes.email ?? '',
        role: (attributes['custom:role'] as UserRole) ?? 'Member',
        signInDetails: currentUser.signInDetails,
      }

      login(cognitoUser)
    } catch {
      logout()
    }
  }, [login, logout])

  return {
    user,
    isAuthenticated,
    isLoading,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshUser,
  }
}
