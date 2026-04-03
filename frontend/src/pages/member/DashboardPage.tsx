import { CalendarDays, Tag, Activity, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store'

interface StatCardProps {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}

function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function MemberDashboardPage() {
  const { user } = useAuthStore()

  const upcomingReservations = [
    {
      id: '1',
      area: 'Tennis Court A',
      date: '2026-02-22',
      time: '09:00 - 10:00',
      status: 'Confirmed' as const,
    },
    {
      id: '2',
      area: 'Swimming Pool',
      date: '2026-02-24',
      time: '14:00 - 15:30',
      status: 'Pending' as const,
    },
  ]

  const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    Confirmed: 'default',
    Pending: 'secondary',
    Cancelled: 'destructive',
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {user?.username ?? 'Member'}
        </h1>
        <p className="text-muted-foreground">
          Aquí tenés un resumen de tu cuenta y próximas reservas.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Estado de membresía"
          value="Activo"
          description="Vence el 31 de diciembre de 2026"
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Próximas reservas"
          value="2"
          description="Próxima: 22 feb a las 09:00"
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <StatCard
          title="Este mes"
          value="5"
          description="Total de reservas realizadas"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Promociones activas"
          value="3"
          description="Disponibles para tu membresía"
          icon={<Tag className="h-5 w-5" />}
        />
      </div>

      {/* Upcoming reservations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Próximas reservas</CardTitle>
            <CardDescription>Tus próximas actividades programadas</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <CalendarDays className="mr-2 h-4 w-4" />
            Nueva reserva
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin próximas reservas</p>
              <Button variant="link" size="sm" className="mt-2">
                Hacé tu primera reserva
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{reservation.area}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.date} · {reservation.time}
                    </p>
                  </div>
                  <Badge variant={statusVariantMap[reservation.status] ?? 'outline'}>
                    {reservation.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
