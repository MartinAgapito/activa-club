import { CalendarDays, Clock, MapPin, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(y, m - 1, d))
}

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMinutes / 60)
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReservationConfirmCardProps {
  areaName: string
  date: string          // YYYY-MM-DD
  startTime: string     // HH:mm
  durationMinutes: number
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-012: Summary card shown at wizard step 4 (confirmation).
 * Displays area, date, time range and duration before the final submit.
 */
export function ReservationConfirmCard({
  areaName,
  date,
  startTime,
  durationMinutes,
  className,
}: ReservationConfirmCardProps) {
  const endTime = computeEndTime(startTime, durationMinutes)
  const durationHours = durationMinutes / 60

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardContent className="space-y-4 pt-5">
        {/* Area */}
        <div className="flex items-start gap-3">
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Área
            </p>
            <p className="font-semibold">{areaName}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start gap-3">
          <CalendarDays
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fecha
            </p>
            <p className="capitalize font-medium">{formatDisplayDate(date)}</p>
          </div>
        </div>

        {/* Time range */}
        <div className="flex items-start gap-3">
          <Clock
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Horario
            </p>
            <p className="font-medium">
              {startTime} – {endTime}
            </p>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-start gap-3">
          <Timer
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Duración
            </p>
            <p className="font-medium">
              {durationHours === 1 ? '1 hora' : `${durationHours} horas`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
