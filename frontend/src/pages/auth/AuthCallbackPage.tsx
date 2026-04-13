import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    // OAuth/Hosted UI callback — not used in the current CUSTOM_AUTH flow.
    // Redirect to login; if a valid refresh token exists LoginPage will
    // silently re-authenticate and forward to the dashboard.
    if (!isAuthenticated) {
      navigate('/auth/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

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
