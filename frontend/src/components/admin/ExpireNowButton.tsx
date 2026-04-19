import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { triggerManualExpiration } from '@/api/admin.api'

export function ExpireNowButton() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ processed: number; errors: number } | null>(null)

  const mutation = useMutation({
    mutationFn: triggerManualExpiration,
    onSuccess: (data) => {
      setResult(data)
      setOpen(false)
    },
  })

  return (
    <div className="flex flex-col gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? 'Procesando...' : 'Forzar Expiración de Reservas'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar expiración manual</DialogTitle>
            <DialogDescription>
              Esta acción marcará como expiradas todas las reservas confirmadas cuyo horario ya
              finalizó. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => { setResult(null); mutation.mutate() }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
