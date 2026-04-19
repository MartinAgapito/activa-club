import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { triggerManualExpiration } from '@/api/admin.api'

export function ExpireNowButton() {
  const [result, setResult] = useState<{ processed: number; errors: number } | null>(null)

  const mutation = useMutation({
    mutationFn: triggerManualExpiration,
    onSuccess: (data) => setResult(data),
  })

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? 'Procesando...' : 'Forzar Expiración de Reservas'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar expiración manual</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará como expiradas todas las reservas confirmadas cuyo horario ya
              finalizó. Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setResult(null); mutation.mutate() }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          Error al ejecutar la expiración. Intenta de nuevo.
        </p>
      )}

      {result && (
        <p className="text-sm text-muted-foreground">
          Se procesaron <strong>{result.processed}</strong> reservas
          {result.errors > 0 && ` (${result.errors} errores registrados en logs)`}.
        </p>
      )}
    </div>
  )
}
