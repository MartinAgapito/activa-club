import { SlotCard } from './SlotCard'
import type { SlotAvailability } from '@/api/areas.api'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SlotGridProps {
  slots: SlotAvailability[]
  /** Called when the member selects an AVAILABLE slot. */
  onSlotSelect?: (slot: SlotAvailability) => void
  /**
   * When true, all slot CTA buttons are shown but disabled.
   * Typically set when weeklyQuota is exhausted.
   */
  ctaDisabled?: boolean
  /**
   * When true, the "Reservar" button is hidden from every slot.
   * Default: false.
   */
  hideReserveButton?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-011: Responsive grid of hourly slot cards.
 * Delegates slot rendering to SlotCard for easy testing and reuse.
 */
export function SlotGrid({
  slots,
  onSlotSelect,
  ctaDisabled = false,
  hideReserveButton = false,
}: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay franjas horarias disponibles para esta fecha.
      </p>
    )
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Grilla de disponibilidad horaria"
    >
      {slots.map((slot) => (
        <SlotCard
          key={`${slot.startTime}-${slot.endTime}`}
          slot={slot}
          onSelect={onSlotSelect}
          ctaDisabled={ctaDisabled}
          hideReserveButton={hideReserveButton}
        />
      ))}
    </div>
  )
}
