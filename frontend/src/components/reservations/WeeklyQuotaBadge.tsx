import { AlertTriangle, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WeeklyQuotaBadgeProps {
  used: number
  limit: number
  /** True when the member has consumed all reservations for the current week. */
  exhausted: boolean
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-011: Displays a member's weekly reservation quota status.
 *
 * States:
 * - Normal   → green, shows "X de Y reservas usadas esta semana"
 * - Near     → amber, shows same text (remaining === 1)
 * - Exhausted → red destructive banner with informational warning
 *
 * When exhausted, the member can still browse availability but cannot reserve
 * (CTA buttons in SlotGrid are disabled).
 */
export function WeeklyQuotaBadge({
  used,
  limit,
  exhausted,
  className,
}: WeeklyQuotaBadgeProps) {
  const remaining = limit - used
  const isNearLimit = !exhausted && remaining === 1

  return (
    <div className={cn('space-y-2', className)}>
      {/* Compact inline badge */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm',
          exhausted
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : isNearLimit
            ? 'border-amber-400/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
            : 'border-green-400/30 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
        )}
        role="status"
        aria-live="polite"
        aria-label={`Reservas semanales: ${used} de ${limit} usadas`}
      >
        <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">{used}</span> de{' '}
          <span className="font-semibold">{limit}</span> reservas usadas esta semana
          {exhausted && (
            <span className="ml-1 font-medium">(cuota alcanzada)</span>
          )}
        </span>
      </div>

      {/* Extended warning banner when quota is exhausted (AC-011 requirement) */}
      {exhausted && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Alcanzaste tu límite semanal. Podés seguir consultando disponibilidad,
            pero no podés crear nuevas reservas hasta la próxima semana.
          </p>
        </div>
      )}
    </div>
  )
}
