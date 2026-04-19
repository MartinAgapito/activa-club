import { useState } from 'react'
import { AlertCircle, AlertTriangle, CalendarDays, Loader2, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WeeklyQuotaBadge } from '@/features/reservations/components/WeeklyQuotaBadge'
import { CancelReservationModal } from '@/features/reservations/components/CancelReservationModal'
import { ReservationStatusBadge } from '@/features/reservations/components/ReservationStatusBadge'
import { useMyReservations } from '@/features/reservations/hooks/useMyReservations'
import { useCancelReservation } from '@/features/reservations/hooks/useCancelReservation'
import type { ReservationItem } from '@/api/reservations.api'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewTab = 'upcoming' | 'history'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(y, m - 1, d))
}

/**
 * AC-013 §7.1: Determine if a CONFIRMED reservation can still be cancelled.
 * The cancellation window closes at startDatetime - 2 hours.
 * The boundary is exclusive: < 2h remaining means cancel is NOT allowed.
 */
function isWithinCancellationWindow(date: string, startTime: string): boolean {
  const [h, min] = startTime.split(':').map(Number)
  // Treat reservation date+time as club local time (Argentina/Buenos_Aires = UTC-3)
  // We build the ISO string explicitly and let Date parse it.
  const startIso = `${date}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00-03:00`
  const startMs = new Date(startIso).getTime()
  const nowMs = Date.now()
  const twoHoursMs = 2 * 60 * 60 * 1000
  // Returns true when cancellation is STILL allowed (more than 2h before start)
  return nowMs < startMs - twoHoursMs
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReservationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-4 rounded-lg border p-4 animate-pulse"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
          </div>
          <div className="h-6 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

// ─── Reservation card ─────────────────────────────────────────────────────────

interface ReservationCardProps {
  reservation: ReservationItem
  onCancel: (reservation: ReservationItem) => void
}

/**
 * AC-014 §7.2: Individual reservation card.
 * Shows area, date, time range, status badge, and a cancel button when eligible.
 * Cancel button only shown for CONFIRMED reservations outside the 2-hour window.
 */
function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
  const canCancel =
    reservation.status === 'CONFIRMED' &&
    isWithinCancellationWindow(reservation.date, reservation.startTime)

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium">{reservation.areaName}</p>
        <p className="text-sm text-muted-foreground">
          {formatDate(reservation.date)} · {reservation.startTime} – {reservation.endTime}
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
            aria-label={`Cancelar reserva en ${reservation.areaName}`}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

/**
 * AC-014: Member reservation list page.
 *
 * Two tabs:
 *   - "Próximas" — CONFIRMED reservations ordered ascending by date.
 *   - "Historial" — CANCELLED + EXPIRED reservations, descending, paginated.
 *
 * Shows:
 *   - Weekly quota badge (always visible when data is loaded).
 *   - Membership inactive banner when membershipStatus !== 'active'.
 *   - Empty state with CTA for upcoming tab.
 *   - "Cargar más" button for paginated history.
 *   - Cancel confirmation modal (AC-013).
 */
export default function MyReservationsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ViewTab>('upcoming')
  const [reservationToCancel, setReservationToCancel] = useState<ReservationItem | null>(null)
  const [cancelError, setCancelError] = useState<string | undefined>(undefined)

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyReservations(activeTab)

  const { mutate: cancelReservation, isPending: isCancelling } = useCancelReservation()

  // Flatten all pages into a single list and extract quota/status from first page
  const allReservations: ReservationItem[] = data?.pages.flatMap((p) => p.items) ?? []
  const weeklyQuota = data?.pages[0]?.weeklyQuota ?? null
  const membershipStatus = data?.pages[0]?.membershipStatus ?? null
  const isMembershipInactive =
    membershipStatus !== null && membershipStatus !== 'active'

  function handleCancelRequest(reservation: ReservationItem) {
    setCancelError(undefined)
    setReservationToCancel(reservation)
  }

  function handleCancelClose() {
    setReservationToCancel(null)
    setCancelError(undefined)
  }

  function handleCancelConfirm() {
    if (!reservationToCancel) return

    cancelReservation(reservationToCancel.reservationId, {
      onSuccess: () => {
        handleCancelClose()
      },
      onError: (error: unknown) => {
        // Also show error inline inside the modal (in addition to the toast in the hook)
        if (isAxiosError(error)) {
          const msg =
            (error.response?.data?.error?.message as string | undefined) ??
            'No se pudo cancelar la reserva. Intentá nuevamente.'
          setCancelError(msg)
        } else {
          setCancelError('No se pudo cancelar la reserva. Intentá nuevamente.')
        }
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
        {!isMembershipInactive && (
          <Button onClick={() => navigate('/member/reservations/new')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva reserva
          </Button>
        )}
      </div>

      {/* Membership inactive banner — AC-014 §7.1 */}
      {isMembershipInactive && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-400/40 bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Tu membresía está inactiva. Regularizá tu situación para crear nuevas reservas.
          </span>
        </div>
      )}

      {/* Weekly quota badge — shown once data is available */}
      {weeklyQuota && (
        <WeeklyQuotaBadge used={weeklyQuota.used} limit={weeklyQuota.limit} />
      )}

      {/* Tab switcher */}
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
            aria-selected={activeTab === tab}
            role="tab"
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
          {activeTab === 'upcoming' && !isMembershipInactive && (
            <CardDescription>
              Solo se muestran reservas confirmadas. Podés cancelar hasta 2 horas antes del inicio.
            </CardDescription>
          )}
          {activeTab === 'upcoming' && isMembershipInactive && (
            <CardDescription>
              Tus reservas activas se muestran a continuación. No podés crear nuevas reservas
              mientras tu membresía esté inactiva.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ReservationSkeleton />
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
              {activeTab === 'upcoming' && !isMembershipInactive && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/member/reservations/new')}
                >
                  Hacer una reserva
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Lista de reservas">
              {allReservations.map((reservation) => (
                <div key={reservation.reservationId} role="listitem">
                  <ReservationCard
                    reservation={reservation}
                    onCancel={handleCancelRequest}
                  />
                </div>
              ))}

              {/* Load more — pagination for history tab */}
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

      {/* AC-013: Cancellation confirmation modal */}
      <CancelReservationModal
        reservation={reservationToCancel}
        onClose={handleCancelClose}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
        errorMessage={cancelError}
      />
    </div>
  )
}
