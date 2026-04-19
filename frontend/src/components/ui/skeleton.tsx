import { cn } from '@/lib/utils'

/**
 * Shadcn/ui Skeleton — CSS-only loading placeholder.
 * No Radix dependency required.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
