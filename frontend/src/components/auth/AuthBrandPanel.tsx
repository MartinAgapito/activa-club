import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const benefits = [
  'Accede a instalaciones deportivas de primer nivel',
  'Reserva canchas y áreas exclusivas en segundos',
  'Gestiona tu membresía y pagos en línea',
  'Recibe promociones y beneficios exclusivos',
]

/**
 * Left brand column for auth pages.
 * Hidden on mobile; on desktop it sits in the left cell of the max-w-5xl grid
 * and pushes its content to the RIGHT edge so it reads close to the form card.
 */
export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex justify-end">
      <div className="max-w space-y-10">
        {/* Badge */}
        <Badge
          variant="secondary"
          className="w-fit text-xs font-medium tracking-wide uppercase text-slate-600 bg-slate-100"
        >
          Member Access
        </Badge>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Activa Club
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            Tu club deportivo de confianza. Todo lo que necesitas, desde un solo lugar.
          </p>
        </div>

        {/* Benefits list */}
        <ul className="space-y-5">
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
