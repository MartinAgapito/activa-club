import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const benefits = [
  'Access first-class sports facilities',
  'Book courts and exclusive areas in seconds',
  'Manage your membership and payments online',
  'Receive exclusive promotions and member benefits',
]

/**
 * Left brand column shared across all auth pages.
 * Hidden on mobile; on desktop occupies the left cell of the split-view grid.
 */
export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex justify-end">
      <div className="space-y-10 max-w-sm">
        {/* Badge */}
        <Badge
          variant="outline"
          className="w-fit text-xs font-medium tracking-widest uppercase text-slate-500 border-slate-300 bg-transparent"
        >
          Member Access
        </Badge>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Activa Club
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            Your trusted sports club. Everything you need, from a single place.
          </p>
        </div>

        {/* Benefits list */}
        <ul className="space-y-4">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-slate-700 mt-0.5 shrink-0" />
              <span className="text-slate-500 text-sm leading-relaxed">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
