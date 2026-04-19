import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReservationStatus } from '@/api/reservations.api'

// AC-014: status values match the backend enum (UPPERCASE).
const statusConfig: Record<ReservationStatus, { label: string; className: string }> = {
  CONFIRMED: {
    label: 'Confirmada',
    className:
      'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300',
  },
  CANCELLED: {
    label: 'Cancelada',
    className:
      'bg-red-100 text-red-600 border-red-300 dark:bg-red-950/40 dark:text-red-400',
  },
  EXPIRED: {
    label: 'Expirada',
    className:
      'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-900/40 dark:text-gray-400',
  },
}

interface ReservationStatusBadgeProps {
  status: ReservationStatus
  className?: string
}

export function ReservationStatusBadge({ status, className }: ReservationStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: '',
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
