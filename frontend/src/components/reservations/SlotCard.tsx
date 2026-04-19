import { cn } from '@/lib/utils'
import type { SlotAvailability } from '@/api/areas.api'

// ─── Status display config ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  AVAILABLE: {
    /** Label shown to the member — Spanish per UX rules */
    label: 'Disponible',
    containerClass:
      'border-green-400 bg-green-50 text-green-800 hover:bg-green-100 focus-visible:ring-green-500 cursor-pointer dark:bg-green-950/30 dark:text-green-300',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  FULL: {
    label: 'Sin disponibilidad',
    containerClass:
      'border-slate-300 bg-slate-50 text-slate-500 cursor-not-allowed opacity-70 dark:bg-slate-900/30 dark:text-slate-400',
    badgeClass:
      'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  BLOCKED: {
    /** AC-011: Do not expose block reason to member-role callers. */
    label: 'No disponible',
    containerClass:
      'border-amber-400 bg-amber-50 text-amber-700 cursor-not-allowed opacity-70 dark:bg-amber-950/30 dark:text-amber-400',
    badgeClass:
      'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
  },
} as const

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SlotCardProps {
  slot: SlotAvailability
  /** Called when a member clicks/keyboard-activates an AVAILABLE slot. */
  onSelect?: (slot: SlotAvailability) => void
  /**
   * When true (e.g. weekly quota exhausted or AC-012 not yet released),
   * the "Reservar" CTA is shown but disabled.
   */
  ctaDisabled?: boolean
  /**
   * When true, the Reservar button is completely hidden.
   * Default: false (button visible but may be disabled).
   */
  hideReserveButton?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-011: Single hourly slot card.
 *
 * Color coding:
 * - AVAILABLE  → green background, interactive
 * - FULL       → grey background, not selectable
 * - BLOCKED    → amber background, not selectable (reason hidden from member)
 */
export function SlotCard({ slot, onSelect, ctaDisabled = false, hideReserveButton = false }: SlotCardProps) {
  const config = STATUS_CONFIG[slot.status]
  const isSelectable = slot.status === 'AVAILABLE' && !ctaDisabled

  function handleClick() {
    if (isSelectable && onSelect) {
      onSelect(slot)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (isSelectable && onSelect && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onSelect(slot)
    }
  }

  return (
    <div
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-label={
        isSelectable
          ? `Reservar franja ${slot.startTime} - ${slot.endTime}, ${slot.available} cupos disponibles`
          : `Franja ${slot.startTime} - ${slot.endTime}: ${config.label}`
      }
      aria-disabled={!isSelectable || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-lg border-2 p-3 transition-all focus-visible:outline-none focus-visible:ring-2',
        config.containerClass
      )}
    >
      {/* Time range */}
      <p className="text-sm font-semibold">
        {slot.startTime} – {slot.endTime}
      </p>

      {/* Status badge + occupancy */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            config.badgeClass
          )}
        >
          {config.label}
        </span>

        {/* Show occupancy for non-blocked slots */}
        {slot.status !== 'BLOCKED' && (
          <span className="text-xs opacity-75">
            {slot.available}/{slot.total} cupos
          </span>
        )}
      </div>

      {/* Reserve CTA — hidden by default (AC-012 will activate it) */}
      {!hideReserveButton && slot.status === 'AVAILABLE' && (
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={(e) => {
            e.stopPropagation()
            if (!ctaDisabled && onSelect) {
              onSelect(slot)
            }
          }}
          aria-label={`Reservar franja ${slot.startTime} - ${slot.endTime}`}
          className={cn(
            'mt-2 w-full rounded-md py-1 text-xs font-medium transition-colors',
            ctaDisabled
              ? 'cursor-not-allowed bg-green-200 text-green-600 opacity-50 dark:bg-green-900/30'
              : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
          )}
        >
          Reservar
        </button>
      )}
    </div>
  )
}
