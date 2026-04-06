import { useState } from 'react'
import { CalendarDays, AlertCircle, Loader2, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WeeklyQuotaBadge } from '@/features/reservations/components/WeeklyQuotaBadge'
import { CancelReservationModal } from '@/features/reservations/components/CancelReservationModal'
import { ReservationStatusBadge } from '@/features/reservations/components/ReservationStatusBadge'
import {
  useMyReservations,
  useCancelReservation,
} from '@/features/reservations/hooks/useMyReservations'
import { toast } from '@/hooks/useToast'
import type { ReservationRecord } from '@/api/reservations.api'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ViewTab = 'upcoming' | 'history'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(date: string, start: string, end: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const formatted = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(y, m - 1, d))
  return `${formatted} · ${start} – ${end}`
}

// ─── Reservation card ─────────────────────────────────────────────────────────

interface ReservationCardProps {
  reservation: ReservationRecord
  onCancel: (reservation: ReservationRecord) => void
}

function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
  const canCancel = reservation.status === 'Confirmed'

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium">{reservation.areaName}</p>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(reservation.date, reservation.startTime, reservation.endTime)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <ReservationStatusBadge status={reservation.status} />
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onCancel(reservation)}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function MyReservationsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ViewTab>('upcoming')
  const [reservationToCancel, setReservationToCancel] = useState<ReservationRecord | null>(null)

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyReservations(activeTab)

  const { mutate: cancelReservation, isPending: isCancelling } = useCancelReservation()

  // Flatten all pages into a single list and extract quota from first page
  const allReservations = data?.pages.flatMap((p) => p.reservations) ?? []
  const weeklyQuota = data?.pages[0]?.weeklyQuota ?? null

  function handleCancelRequest(reservation: ReservationRecord) {
    setReservationToCancel(reservation)
  }

  function handleCancelConfirm() {
    if (!reservationToCancel) return

    cancelReservation(reservationToCancel.reservationId, {
      onSuccess: () => {
        toast({
          title: 'Reserva cancelada',
          description: 'La reserva fue cancelada exitosamente.',
        })
        setReservationToCancel(null)
      },
      onError: (error: unknown) => {
        const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
        const message =
          axiosError?.response?.data?.error?.message ??
          'No se pudo cancelar la reserva. Intentá nuevamente.'
        toast({
          title: 'Error al cancelar',
          description: message,
          variant: 'destructive',
        })
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis reservas</h1>
          <p className="text-muted-foreground">
            Administrá tus reservas activas e historial.
          </p>
        </div>
        <Button onClick={() => navigate('/member/reservations/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nueva reserva
        </Button>
      </div>

      {/* Weekly quota */}
      {weeklyQuota && (
        <WeeklyQuotaBadge used={weeklyQuota.used} limit={weeklyQuota.limit} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
        {(['upcoming', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'upcoming' ? 'Próximas' : 'Historial'}
          </button>
        ))}
      </div>

      {/* Reservations list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {activeTab === 'upcoming' ? 'Próximas reservas' : 'Historial de reservas'}
          </CardTitle>
          {activeTab === 'upcoming' && (
            <CardDescription>
              Solo se muestran reservas con estado Confirmada.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">
                No se pudo cargar tus reservas. Intentá nuevamente.
              </p>
            </div>
          ) : allReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {activeTab === 'upcoming'
                  ? 'No tenés próximas reservas.'
                  : 'Todavía no tenés reservas en tu historial.'}
              </p>
              {activeTab === 'upcoming' && (
                <Button variant="outline" onClick={() => navigate('/member/reservations/new')}>
                  Hacer una reserva
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {allReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.reservationId}
                  reservation={reservation}
                  onCancel={handleCancelRequest}
                />
              ))}

              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cargar más
                  </Button>
                </div>
              )}

              {!hasNextPage && allReservations.length > 0 && (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  — Fin de la lista —
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge legend */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Estados:</span>
        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 font-normal">Confirmada</Badge>
        <Badge variant="outline" className="bg-red-100 text-red-600 border-red-300 font-normal">Cancelada</Badge>
        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 font-normal">Completada</Badge>
        <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 font-normal">No presentado</Badge>
      </div>

      {/* Cancel confirmation modal */}
      <CancelReservationModal
        open={!!reservationToCancel}
        onClose={() => setReservationToCancel(null)}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
        reservationLabel={
          reservationToCancel
            ? `${reservationToCancel.areaName} — ${reservationToCancel.date}`
            : undefined
        }
      />
    </div>
  )
}
