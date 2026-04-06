import { cn } from '@/lib/utils'
import type { AvailabilitySlot } from '@/api/reservations.api'

interface SlotGridProps {
  slots: AvailabilitySlot[]
  onSelect: (slot: AvailabilitySlot) => void
  disabled?: boolean
}

const slotStatusConfig = {
  available: {
    label: 'Disponible',
    className:
      'border-green-400 bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer dark:bg-green-950/30 dark:text-green-300',
    badgeClassName: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  full: {
    label: 'Completo',
    className:
      'border-red-300 bg-red-50 text-red-600 cursor-not-allowed opacity-70 dark:bg-red-950/30 dark:text-red-400',
    badgeClassName: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
  },
  blocked: {
    label: 'Bloqueado',
    className:
      'border-yellow-400 bg-yellow-50 text-yellow-700 cursor-not-allowed opacity-70 dark:bg-yellow-950/30 dark:text-yellow-400',
    badgeClassName: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
  },
}

function SlotCard({
  slot,
  onSelect,
  disabled,
}: {
  slot: AvailabilitySlot
  onSelect: (slot: AvailabilitySlot) => void
  disabled?: boolean
}) {
  const config = slotStatusConfig[slot.status]
  const isSelectable = slot.status === 'available' && !disabled

  const handleClick = () => {
    if (isSelectable) {
      onSelect(slot)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSelectable && (e.key === 'Enter' || e.key === ' ')) {
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
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-lg border-2 p-3 transition-all',
        config.className
      )}
    >
      <p className="text-sm font-semibold">
        {slot.startTime} – {slot.endTime}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            config.badgeClassName
          )}
        >
          {config.label}
        </span>
        {slot.status !== 'blocked' && (
          <span className="text-xs opacity-80">
            {slot.available}/{slot.capacity} cupos
          </span>
        )}
        {slot.status === 'blocked' && slot.blockReason && (
          <span className="truncate text-xs opacity-70">{slot.blockReason}</span>
        )}
      </div>
    </div>
  )
}

export function SlotGrid({ slots, onSelect, disabled }: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay franjas horarias disponibles para esta fecha.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {slots.map((slot) => (
        <SlotCard
          key={`${slot.startTime}-${slot.endTime}`}
          slot={slot}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
