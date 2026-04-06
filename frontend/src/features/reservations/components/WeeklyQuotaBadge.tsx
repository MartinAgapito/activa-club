import { CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeeklyQuotaBadgeProps {
  used: number
  limit: number
  className?: string
}

export function WeeklyQuotaBadge({ used, limit, className }: WeeklyQuotaBadgeProps) {
  const remaining = limit - used
  const isAtLimit = remaining === 0
  const isNearLimit = remaining === 1

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm',
        isAtLimit
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : isNearLimit
          ? 'border-yellow-400/30 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
          : 'border-green-400/30 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
        className
      )}
    >
      <CalendarCheck className="h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">{used}</span> de{' '}
        <span className="font-semibold">{limit}</span> reservas usadas esta semana
        {isAtLimit && (
          <span className="ml-1 font-medium">(cuota alcanzada)</span>
        )}
      </span>
    </div>
  )
}
