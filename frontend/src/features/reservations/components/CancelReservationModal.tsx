import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CancelReservationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  reservationLabel?: string
}

export function CancelReservationModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  reservationLabel,
}: CancelReservationModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar reserva</DialogTitle>
          <DialogDescription>
            {reservationLabel
              ? `¿Confirmás la cancelación de "${reservationLabel}"?`
              : '¿Confirmás la cancelación de esta reserva?'}{' '}
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancelar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
