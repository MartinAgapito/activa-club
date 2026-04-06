import { Loader2, CalendarDays, Clock, MapPin } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AvailabilitySlot, AreaSummary } from '@/api/reservations.api'

interface ConfirmReservationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  area: AreaSummary | null
  date: string
  slot: AvailabilitySlot | null
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(year, month - 1, day))
}

export function ConfirmReservationModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  area,
  date,
  slot,
}: ConfirmReservationModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar reserva</DialogTitle>
          <DialogDescription>
            Revisá los detalles antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {area && slot && (
          <div className="space-y-3 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{area.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{area.type}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="capitalize">{formatDate(date)}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p>
                {slot.startTime} – {slot.endTime}
              </p>
            </div>

            <div className="border-t pt-2 text-xs text-muted-foreground">
              Cupos disponibles: {slot.available} de {slot.capacity}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
