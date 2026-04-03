import { Users, CalendarDays, Tag, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface StatCardProps {
  title: string
  value: string
  change: string
  positive: boolean
  icon: React.ReactNode
}

function StatCard({ title, value, change, positive, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`mt-1 text-xs ${positive ? 'text-green-600' : 'text-red-500'}`}>
          {change}
        </p>
      </CardContent>
    </Card>
  )
}

const recentActivity = [
  {
    id: '1',
    type: 'reservation',
    description: 'Nueva reserva: Cancha de Tenis A por Juan Pérez',
    time: '5 minutes ago',
    status: 'Confirmed',
  },
  {
    id: '2',
    type: 'member',
    description: 'Nuevo socio registrado: María García',
    time: '23 minutes ago',
    status: 'Active',
  },
  {
    id: '3',
    type: 'reservation',
    description: 'Reserva cancelada: Piscina por Roberto López',
    time: '1 hour ago',
    status: 'Cancelled',
  },
  {
    id: '4',
    type: 'promotion',
    description: 'Promoción activada: Verano 20% de descuento',
    time: '2 hours ago',
    status: 'Active',
  },
]

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Confirmed: 'default',
  Active: 'default',
  Pending: 'secondary',
  Cancelled: 'destructive',
}

const statusLabelMap: Record<string, string> = {
  Confirmed: 'Confirmado',
  Active: 'Activo',
  Pending: 'Pendiente',
  Cancelled: 'Cancelado',
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
          <p className="text-muted-foreground">
            Resumen de operaciones del club y métricas clave.
          </p>
        </div>
        <Button>
          <Users className="mr-2 h-4 w-4" />
          Agregar socio
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de socios"
          value="1,248"
          change="+12 este mes"
          positive
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Reservas activas"
          value="87"
          change="+5% respecto a la semana pasada"
          positive
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <StatCard
          title="Promociones activas"
          value="4"
          change="2 vencen esta semana"
          positive={false}
          icon={<Tag className="h-5 w-5" />}
        />
        <StatCard
          title="Ingresos del mes"
          value="$24,380"
          change="+8.2% respecto al mes pasado"
          positive
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>Últimos eventos en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                <Badge variant={statusVariantMap[activity.status] ?? 'outline'}>
                  {statusLabelMap[activity.status] ?? activity.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
