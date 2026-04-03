import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refreshUser, isAuthenticated } = useAuth()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await refreshUser()
      } catch {
        navigate('/auth/login?reason=callback-error', { replace: true })
      }
    }

    handleCallback()
  }, [refreshUser, navigate])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/member/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-lg font-medium text-muted-foreground">Completando el inicio de sesión...</p>
      <p className="text-sm text-muted-foreground">Serás redirigido en breve.</p>
    </div>
  )
}
