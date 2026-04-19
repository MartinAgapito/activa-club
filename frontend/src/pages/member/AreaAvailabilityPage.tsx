import { useState, useMemo } from 'react'
import { AlertCircle, CalendarDays, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { AreaSelector } from '@/components/reservations/AreaSelector'
import { SlotGrid } from '@/components/reservations/SlotGrid'
import { WeeklyQuotaBadge } from '@/components/reservations/WeeklyQuotaBadge'

import { useAreaAvailability } from '@/hooks/useAreaAvailability'
import { useAreas } from '@/features/reservations/hooks/useAreas'
import { useAuthStore } from '@/store'

// ─── Membership → allowed areas mapping (AC-011 business rules) ───────────────

// ─── Date helpers ──────────────────────────────────────────────────────────────

function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildDateConstraints(isManager: boolean) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isManager) {
    // Managers have no upper date restriction per design doc (section 5)
    return { min: toLocalISODate(today), max: undefined, default: toLocalISODate(today) }
  }

  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 7)
  return {
    min: toLocalISODate(today),
    max: toLocalISODate(maxDate),
    default: toLocalISODate(today),
  }
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(y, m - 1, d))
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SlotGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 13 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

/**
 * AC-011: Area Availability Page
 * Route: /member/availability
 *
 * Allows a member to select an area and a date to see hourly slot availability.
 * Areas are filtered client-side by membership type. The backend also enforces
 * RBAC and returns 403 for inaccessible areas.
 */
export default function AreaAvailabilityPage() {
  const { user } = useAuthStore()
  const isManager = user?.role === 'Manager' || user?.role === 'Admin'
  const dateConstraints = useMemo(() => buildDateConstraints(isManager), [isManager])

  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(dateConstraints.default)

  // Fetch all active areas from the backend
  const {
    data: allAreas,
    isLoading: areasLoading,
    isError: areasError,
  } = useAreas()

  /**
   * Filter areas by membership type for Member role.
   * Managers and Admins see all areas.
   */
  const accessibleAreas = useMemo(() => {
    if (!allAreas) return []
    if (isManager) return allAreas.filter((a) => a.isActive)

    // Infer membership tier from user display name or role metadata.
    // The CognitoUser type does not carry membershipType, so we rely on the
    // allowedMemberships field that comes from the areas API when available,
    // or default to showing all areas (backend will enforce 403 on access).
    // NOTE: When the backend sends allowedMemberships per area, apply the filter.
    // For now we show all active areas and let the backend enforce the 403.
    return allAreas.filter((a) => a.isActive)
  }, [allAreas, isManager])

  // Fetch availability — only fires when both area and date are selected
  const {
    data: availability,
    isLoading: availabilityLoading,
    isError: availabilityError,
    error: availabilityRawError,
  } = useAreaAvailability(selectedAreaId, selectedDate)

  // Extract structured API error code from Axios error
  const apiErrorCode = useMemo<string | undefined>(() => {
    const err = availabilityRawError as
      | { response?: { data?: { error?: { code?: string } } } }
      | null
      | undefined
    return err?.response?.data?.error?.code
  }, [availabilityRawError])

  const apiErrorMessage = useMemo<string>(() => {
    const err = availabilityRawError as
      | { response?: { data?: { error?: { message?: string } } } }
      | null
      | undefined
    return (
      err?.response?.data?.error?.message ??
      'No se pudo cargar la disponibilidad. Intentá nuevamente.'
    )
  }, [availabilityRawError])

  // Weekly quota (only present for Member callers per design doc)
  const quota = availability?.weeklyQuotaInfo
  const quotaExhausted = quota?.exhausted ?? false

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disponibilidad de áreas</h1>
        <p className="text-muted-foreground">
          Consultá los cupos disponibles por área y franja horaria.
        </p>
      </div>

      {/* Filters card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Area selector */}
            <AreaSelector
              areas={accessibleAreas}
              value={selectedAreaId}
              onChange={setSelectedAreaId}
              isLoading={areasLoading}
              isError={areasError}
            />

            {/* Date picker */}
            <div className="space-y-1.5">
              <Label htmlFor="date-input">Fecha</Label>
              <Input
                id="date-input"
                type="date"
                value={selectedDate}
                min={dateConstraints.min}
                max={dateConstraints.max}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Seleccionar fecha"
              />
              {!isManager && (
                <p className="text-xs text-muted-foreground">
                  Solo podés consultar hasta 7 días adelante.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly quota badge — only shown to Member callers (backend omits for Manager/Admin) */}
      {quota && (
        <WeeklyQuotaBadge
          used={quota.used}
          limit={quota.limit}
          exhausted={quota.exhausted}
        />
      )}

      {/* Availability panel */}
      {!selectedAreaId ? (
        /* No area selected yet */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              Seleccioná un área para ver las franjas disponibles.
            </p>
          </CardContent>
        </Card>
      ) : availabilityLoading ? (
        /* Loading skeleton — 13 rows for 09:00–22:00 */
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-4 w-56" />
          </CardHeader>
          <CardContent>
            <SlotGridSkeleton />
          </CardContent>
        </Card>
      ) : availabilityError ? (
        /* API error — display friendly message based on error code */
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            {apiErrorCode === 'MEMBERSHIP_INACTIVE' ? (
              <>
                <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden="true" />
                <p className="text-sm font-medium text-destructive">Membresía inactiva</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Tu membresía no está activa en este momento. Por favor contactá al club para
                  regularizar tu situación.
                </p>
              </>
            ) : apiErrorCode === 'AREA_NOT_ACCESSIBLE' ? (
              <>
                <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden="true" />
                <p className="text-sm font-medium text-destructive">Acceso no permitido</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  No tenés acceso a esta área con tu tipo de membresía.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-sm text-destructive">{apiErrorMessage}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : availability ? (
        /* Slot grid */
        <Card>
          <CardHeader>
            <CardTitle className="text-base capitalize">{availability.areaName}</CardTitle>
            <CardDescription>
              Disponibilidad para el{' '}
              <span className="capitalize">{formatDisplayDate(selectedDate)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlotGrid
              slots={availability.slots}
              onSlotSelect={undefined}
              ctaDisabled={quotaExhausted}
              hideReserveButton={false}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
