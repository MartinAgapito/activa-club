import { useReducer, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { SlotGrid } from '@/components/reservations/SlotGrid'
import { WeeklyQuotaBadge } from '@/components/reservations/WeeklyQuotaBadge'
import { ReservationConfirmCard } from '@/components/reservations/ReservationConfirmCard'

import { useAreas } from '@/features/reservations/hooks/useAreas'
import { useAreaAvailability } from '@/hooks/useAreaAvailability'
import { useCreateReservation } from '@/features/reservations/hooks/useCreateReservation'

import type { SlotAvailability, AreaSummaryAC011 } from '@/api/areas.api'
import type { AreaSummary } from '@/api/reservations.api'
import { cn } from '@/lib/utils'

// ─── Wizard state ─────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  step: WizardStep
  /** Step 1 */
  areaId: string
  /** Step 2 */
  date: string
  /** Step 3 */
  startTime: string
  durationMinutes: number
}

type WizardAction =
  | { type: 'SELECT_AREA'; areaId: string }
  | { type: 'SELECT_DATE'; date: string }
  | { type: 'SELECT_SLOT'; startTime: string }
  | { type: 'SELECT_DURATION'; durationMinutes: number }
  | { type: 'GO_BACK' }
  | { type: 'GO_TO_STEP'; step: WizardStep }

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildDateConstraints() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, min] = startTime.split(':').map(Number)
  const totalMins = h * 60 + min + durationMinutes
  const endH = Math.floor(totalMins / 60)
  const endM = totalMins % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

// ─── Membership duration limits (AC-012 design doc §5) ────────────────────────

const DURATION_OPTIONS = [60, 120, 180, 240] as const
type DurationOption = (typeof DURATION_OPTIONS)[number]

const DURATION_LABEL: Record<DurationOption, string> = {
  60: '1 hora',
  120: '2 horas',
  180: '3 horas',
  240: '4 horas',
}

/**
 * Returns the max allowed durationMinutes for a given closing time and selected startTime.
 * Ensures endTime <= closingTime.
 */
function getMaxDurationBySchedule(
  startTime: string,
  closingTime: string,
  membershipMax: number
): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [ch, cm] = closingTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const closingMins = ch * 60 + cm
  const minutesUntilClose = closingMins - startMins
  return Math.min(membershipMax, Math.floor(minutesUntilClose / 60) * 60)
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const DATE_CONSTRAINTS = buildDateConstraints()

const INITIAL_STATE: WizardState = {
  step: 1,
  areaId: '',
  date: DATE_CONSTRAINTS.default,
  startTime: '',
  durationMinutes: 0,
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_AREA':
      return { ...state, areaId: action.areaId, step: 2 }
    case 'SELECT_DATE':
      return { ...state, date: action.date }
    case 'SELECT_SLOT':
      return { ...state, startTime: action.startTime, step: 3 }
    case 'SELECT_DURATION':
      return { ...state, durationMinutes: action.durationMinutes, step: 4 }
    case 'GO_BACK':
      if (state.step <= 1) return state
      return { ...state, step: (state.step - 1) as WizardStep }
    case 'GO_TO_STEP':
      return { ...state, step: action.step }
    default:
      return state
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Elegí el área',
  2: 'Elegí la fecha y horario',
  3: 'Elegí la duración',
  4: 'Confirmá tu reserva',
}

interface StepIndicatorProps {
  currentStep: WizardStep
  totalSteps: number
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Paso {currentStep} de {totalSteps}
        </span>
        <span className="text-muted-foreground">{STEP_LABELS[currentStep]}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            role="presentation"
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              step <= currentStep ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Slot grid skeleton ───────────────────────────────────────────────────────

function SlotGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  )
}

// ─── Step 1: Area selection ───────────────────────────────────────────────────

interface Step1Props {
  areas: AreaSummaryAC011[] | AreaSummary[] | undefined
  areasLoading: boolean
  areasError: boolean
  onSelect: (areaId: string) => void
}

function Step1AreaSelect({ areas, areasLoading, areasError, onSelect }: Step1Props) {
  const areaOptions = useMemo(
    () =>
      (areas ?? [])
        .filter((a) => a.isActive)
        .map((a) => ({ areaId: a.areaId, name: a.name })),
    [areas]
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Seleccioná un área</h2>
        <p className="text-sm text-muted-foreground">
          Elegí el espacio que querés reservar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {areasLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))
          : areasError
          ? (
            <p className="col-span-2 text-sm text-destructive" role="alert">
              Error al cargar las áreas. Recargá la página.
            </p>
          )
          : areaOptions.length === 0
          ? (
            <p className="col-span-2 text-sm text-muted-foreground" role="status">
              No hay áreas disponibles para tu tipo de membresía.
            </p>
          )
          : areaOptions.map((area) => (
            <button
              key={area.areaId}
              type="button"
              onClick={() => onSelect(area.areaId)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all',
                'hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              aria-label={`Seleccionar área ${area.name}`}
            >
              <span className="font-medium">{area.name}</span>
            </button>
          ))}
      </div>
    </div>
  )
}

// ─── Step 2: Date + slot selection ───────────────────────────────────────────

interface Step2Props {
  areaId: string
  date: string
  onDateChange: (date: string) => void
  onSlotSelect: (slot: SlotAvailability) => void
  quotaExhausted: boolean
}

function Step2DateSlot({
  areaId,
  date,
  onDateChange,
  onSlotSelect,
  quotaExhausted,
}: Step2Props) {
  const { data: availability, isLoading, isError } = useAreaAvailability(areaId, date)
  const quota = availability?.weeklyQuotaInfo

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Elegí la fecha y horario</h2>
        <p className="text-sm text-muted-foreground">
          Seleccioná un día y luego hacé clic en el horario disponible.
        </p>
      </div>

      {/* Date picker */}
      <div className="space-y-1.5">
        <Label htmlFor="wizard-date">Fecha</Label>
        <Input
          id="wizard-date"
          type="date"
          value={date}
          min={DATE_CONSTRAINTS.min}
          max={DATE_CONSTRAINTS.max}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Seleccionar fecha"
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Solo podés reservar hasta 7 días adelante.
        </p>
      </div>

      {/* Weekly quota badge */}
      {quota && (
        <WeeklyQuotaBadge
          used={quota.used}
          limit={quota.limit}
          exhausted={quota.exhausted}
        />
      )}

      {/* Slot grid */}
      <div className="space-y-2">
        <p className="text-sm font-medium capitalize">
          {formatDisplayDate(date)}
        </p>

        {isLoading ? (
          <SlotGridSkeleton />
        ) : isError ? (
          <p className="py-4 text-sm text-destructive" role="alert">
            No se pudo cargar la disponibilidad. Intentá nuevamente.
          </p>
        ) : availability ? (
          <>
            {quotaExhausted && (
              <div
                role="alert"
                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
              >
                Alcanzaste tu límite semanal de reservas. No podés reservar más esta semana.
              </div>
            )}
            <SlotGrid
              slots={availability.slots}
              onSlotSelect={quotaExhausted ? undefined : onSlotSelect}
              ctaDisabled={quotaExhausted}
              hideReserveButton={false}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Step 3: Duration selection ───────────────────────────────────────────────

interface Step3Props {
  startTime: string
  selectedDuration: number
  /** Max allowed minutes based on membership + closing time */
  maxDuration: number
  onSelect: (durationMinutes: number) => void
}

function Step3Duration({ startTime, selectedDuration, maxDuration, onSelect }: Step3Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Elegí la duración</h2>
        <p className="text-sm text-muted-foreground">
          Horario de inicio: <strong>{startTime}</strong>. Duración máxima permitida por tu
          membresía: <strong>{maxDuration / 60}h</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Opciones de duración">
        {DURATION_OPTIONS.map((minutes) => {
          const endTime = computeEndTime(startTime, minutes)
          const isDisabled = minutes > maxDuration
          const isSelected = selectedDuration === minutes

          return (
            <button
              key={minutes}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(minutes)}
              aria-pressed={isSelected}
              aria-label={`${DURATION_LABEL[minutes]}, termina a las ${endTime}`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isDisabled
                  ? 'cursor-not-allowed border-muted bg-muted/30 text-muted-foreground opacity-50'
                  : isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary hover:bg-primary/5'
              )}
            >
              <span className="text-base font-bold">
                {DURATION_LABEL[minutes]}
              </span>
              <span className="text-xs opacity-75">hasta {endTime}</span>
            </button>
          )
        })}
      </div>

      {selectedDuration > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => onSelect(selectedDuration)}
            className="gap-2"
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Confirmation ────────────────────────────────────────────────────

interface Step4Props {
  areaName: string
  date: string
  startTime: string
  durationMinutes: number
  isPending: boolean
  onConfirm: () => void
}

function Step4Confirm({
  areaName,
  date,
  startTime,
  durationMinutes,
  isPending,
  onConfirm,
}: Step4Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Confirmá tu reserva</h2>
        <p className="text-sm text-muted-foreground">
          Revisá los detalles antes de confirmar. Una vez confirmada, la reserva estará activa.
        </p>
      </div>

      <ReservationConfirmCard
        areaName={areaName}
        date={date}
        startTime={startTime}
        durationMinutes={durationMinutes}
      />

      <Button
        type="button"
        size="lg"
        className="w-full gap-2"
        onClick={onConfirm}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Confirmando reserva…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Confirmar reserva
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * AC-012: Create Reservation wizard page.
 * Route: /member/reservations/new
 * Access: Member only (enforced by ProtectedRoute in router).
 *
 * 4-step wizard:
 *   Step 1 — Area selection
 *   Step 2 — Date + slot selection
 *   Step 3 — Duration selection
 *   Step 4 — Summary & confirm
 *
 * State managed locally with useReducer (transient wizard state — no Zustand).
 */
export default function CreateReservationPage() {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE)

  const { data: areas, isLoading: areasLoading, isError: areasError } = useAreas()
  const { mutate: createReservation, isPending } = useCreateReservation()

  // Resolve selected area name for step 3 and 4 displays
  const selectedAreaName = useMemo(() => {
    if (!areas || !state.areaId) return ''
    return areas.find((a) => a.areaId === state.areaId)?.name ?? ''
  }, [areas, state.areaId])

  // Resolve area closing time to compute maxDuration per schedule
  const selectedAreaData = useMemo(
    () => areas?.find((a) => a.areaId === state.areaId),
    [areas, state.areaId]
  )

  // Weekly quota from the availability query (needed in step 2)
  const { data: availability } = useAreaAvailability(state.areaId, state.date)
  const quota = availability?.weeklyQuotaInfo
  const quotaExhausted = quota?.exhausted ?? false

  // Max duration based on membership (backend enforces this; UI disables options above it)
  // Default to 240 (VIP) when backend does not expose membership type in the area response.
  // The 'maxDurationMinutes' field may be present on AreaSummaryAC011 if the backend provides it.
  const membershipMaxDuration =
    (selectedAreaData as { maxDurationMinutes?: number } | undefined)?.maxDurationMinutes ?? 240

  const scheduleMaxDuration = useMemo(() => {
    if (!state.startTime || !selectedAreaData) return membershipMaxDuration
    const closingTime =
      (selectedAreaData as { closingTime?: string } | undefined)?.closingTime ?? '23:00'
    return getMaxDurationBySchedule(state.startTime, closingTime, membershipMaxDuration)
  }, [state.startTime, selectedAreaData, membershipMaxDuration])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAreaSelect = useCallback((areaId: string) => {
    dispatch({ type: 'SELECT_AREA', areaId })
  }, [])

  const handleDateChange = useCallback((date: string) => {
    dispatch({ type: 'SELECT_DATE', date })
  }, [])

  const handleSlotSelect = useCallback((slot: SlotAvailability) => {
    dispatch({ type: 'SELECT_SLOT', startTime: slot.startTime })
  }, [])

  const handleDurationSelect = useCallback((durationMinutes: number) => {
    dispatch({ type: 'SELECT_DURATION', durationMinutes })
  }, [])

  const handleBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' })
  }, [])

  const handleConfirm = useCallback(() => {
    if (!state.areaId || !state.date || !state.startTime || !state.durationMinutes) return

    createReservation({
      areaId: state.areaId,
      date: state.date,
      startTime: state.startTime,
      durationMinutes: state.durationMinutes,
    })
  }, [state, createReservation])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva reserva</h1>
        <p className="text-muted-foreground">
          Seguí los pasos para reservar un espacio del club.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={state.step} totalSteps={4} />

      {/* Wizard content */}
      <Card>
        <CardContent className="pt-6">
          {state.step === 1 && (
            <Step1AreaSelect
              areas={areas}
              areasLoading={areasLoading}
              areasError={areasError}
              onSelect={handleAreaSelect}
            />
          )}

          {state.step === 2 && (
            <Step2DateSlot
              areaId={state.areaId}
              date={state.date}
              onDateChange={handleDateChange}
              onSlotSelect={handleSlotSelect}
              quotaExhausted={quotaExhausted}
            />
          )}

          {state.step === 3 && (
            <Step3Duration
              startTime={state.startTime}
              selectedDuration={state.durationMinutes}
              maxDuration={scheduleMaxDuration}
              onSelect={handleDurationSelect}
            />
          )}

          {state.step === 4 && (
            <Step4Confirm
              areaName={selectedAreaName}
              date={state.date}
              startTime={state.startTime}
              durationMinutes={state.durationMinutes}
              isPending={isPending}
              onConfirm={handleConfirm}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation: Back button (hidden on step 1) */}
      {state.step > 1 && (
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isPending}
            className="gap-1.5 text-muted-foreground"
            aria-label="Volver al paso anterior"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Atrás
          </Button>
        </div>
      )}

      {/* Step 1: optional cancel link back to dashboard */}
      {state.step === 1 && (
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/member/dashboard')}
            className="gap-1.5 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  )
}
