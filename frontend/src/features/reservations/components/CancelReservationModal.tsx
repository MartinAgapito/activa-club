import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ReservationItem } from '@/api/reservations.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(y, m - 1, d))
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CancelReservationModalProps {
  /** The reservation to cancel. When null/undefined the dialog is closed. */
  reservation: ReservationItem | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  /** Optional inline error message to display inside the dialog. */
  errorMessage?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-013: Confirmation dialog for cancelling a member reservation.
 *
 * Displays the reservation details (area, date, time range) and a warning that
 * cancellation is irreversible and will decrement the weekly quota.
 */
export function CancelReservationModal({
  reservation,
  onClose,
  onConfirm,
  isLoading,
  errorMessage,
}: CancelReservationModalProps) {
  const open = reservation !== null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar reserva</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1">
              {reservation && (
                <div className="rounded-md border bg-muted/50 p-3 text-sm">
                  <p className="font-semibold text-foreground">{reservation.areaName}</p>
                  <p className="text-muted-foreground capitalize">
                    {formatDate(reservation.date)}
                  </p>
                  <p className="text-muted-foreground">
                    {reservation.startTime} – {reservation.endTime}
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Al cancelar, se liberará el cupo y se restará una reserva de tu cuota semanal.
                Esta acción no se puede deshacer.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Inline error message */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
