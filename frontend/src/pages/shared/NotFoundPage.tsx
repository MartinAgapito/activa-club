import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Página no encontrada</h2>
        <p className="max-w-md text-muted-foreground">
          Lo sentimos, no encontramos la página que buscás. Puede haber sido movida, eliminada o nunca haber existido.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Volver
        </Button>
        <Button onClick={() => navigate('/member/dashboard')}>
          Ir al panel
        </Button>
      </div>
    </div>
  )
}
