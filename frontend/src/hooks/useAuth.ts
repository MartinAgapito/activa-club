import { useCallback } from 'react'
import { useAuthStore } from '@/store'
import type { CognitoUser } from '@/types'

interface UseAuthReturn {
  user: CognitoUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore()

  const handleSignOut = useCallback(async () => {
    await logout()
  }, [logout])

  return {
    user,
    isAuthenticated,
    isLoading,
    signOut: handleSignOut,
  }
}
