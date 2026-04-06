import { useState, useMemo } from 'react'
import { AlertCircle, Loader2, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SlotGrid } from '@/features/reservations/components/SlotGrid'
import { ConfirmReservationModal } from '@/features/reservations/components/ConfirmReservationModal'
import { WeeklyQuotaBadge } from '@/features/reservations/components/WeeklyQuotaBadge'
import { useAvailability } from '@/features/reservations/hooks/useAvailability'
import { useAreas } from '@/features/reservations/hooks/useAreas'
import { useCreateReservation } from '@/features/reservations/hooks/useCreateReservation'
import { toast } from '@/hooks/useToast'
import type { AvailabilitySlot, AreaSummary } from '@/api/reservations.api'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function buildDateConstraints() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 7)
  return {
    min: toISODate(today),
    max: toISODate(maxDate),
    default: toISODate(today),
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const dateConstraints = useMemo(() => buildDateConstraints(), [])

  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(dateConstraints.default)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: areas, isLoading: areasLoading, isError: areasError } = useAreas()

  const activeAreas = useMemo<AreaSummary[]>(
    () => (areas ?? []).filter((a) => a.isActive),
    [areas]
  )

  const selectedArea = useMemo(
    () => activeAreas.find((a) => a.areaId === selectedAreaId) ?? null,
    [activeAreas, selectedAreaId]
  )

  const {
    data: availability,
    isLoading: availabilityLoading,
    isError: availabilityError,
    error: availabilityErrorObj,
  } = useAvailability(selectedAreaId, selectedDate)

  const { mutate: createReservation, isPending: isCreating } = useCreateReservation()

  function handleSlotSelect(slot: AvailabilitySlot) {
    if (availability?.weeklyQuota && availability.weeklyQuota.used >= availability.weeklyQuota.limit) {
      toast({
        title: 'Cuota semanal alcanzada',
        description: 'Ya utilizaste todas tus reservas disponibles para esta semana.',
        variant: 'destructive',
      })
      return
    }
    setSelectedSlot(slot)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    if (!selectedAreaId || !selectedDate || !selectedSlot) return

    createReservation(
      {
        areaId: selectedAreaId,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Reserva confirmada',
            description: `Reserva del ${selectedDate} de ${selectedSlot.startTime} a ${selectedSlot.endTime} creada exitosamente.`,
          })
          setConfirmOpen(false)
          setSelectedSlot(null)
        },
        onError: (error: unknown) => {
          const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
          const message =
            axiosError?.response?.data?.error?.message ??
            'No se pudo crear la reserva. Intentá nuevamente.'
          toast({
            title: 'Error al reservar',
            description: message,
            variant: 'destructive',
          })
          setConfirmOpen(false)
        },
      }
    )
  }

  const quotaAtLimit =
    !!availability?.weeklyQuota &&
    availability.weeklyQuota.used >= availability.weeklyQuota.limit

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva reserva</h1>
        <p className="text-muted-foreground">
          Elegí un área y una fecha para ver las franjas disponibles.
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
            <div className="space-y-1.5">
              <Label htmlFor="area-select">Área</Label>
              {areasLoading ? (
                <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando áreas…
                </div>
              ) : areasError ? (
                <p className="text-sm text-destructive">
                  Error al cargar las áreas. Recargá la página.
                </p>
              ) : (
                <Select
                  value={selectedAreaId}
                  onValueChange={setSelectedAreaId}
                >
                  <SelectTrigger id="area-select" aria-label="Seleccionar área">
                    <SelectValue placeholder="Seleccioná un área" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAreas.map((area) => (
                      <SelectItem key={area.areaId} value={area.areaId}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

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
              <p className="text-xs text-muted-foreground">
                Solo podés reservar hasta 7 días adelante.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly quota indicator */}
      {availability?.weeklyQuota && (
        <WeeklyQuotaBadge
          used={availability.weeklyQuota.used}
          limit={availability.weeklyQuota.limit}
        />
      )}

      {/* Availability grid */}
      {!selectedAreaId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Seleccioná un área para ver las franjas disponibles.
            </p>
          </CardContent>
        </Card>
      ) : availabilityLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : availabilityError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">
              {(availabilityErrorObj as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message ??
                'No se pudo cargar la disponibilidad. Intentá nuevamente.'}
            </p>
          </CardContent>
        </Card>
      ) : availability ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{availability.areaName}</CardTitle>
            <CardDescription>
              Franjas disponibles para el{' '}
              {new Intl.DateTimeFormat('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'America/Argentina/Buenos_Aires',
              }).format((() => {
                const [y, m, d] = selectedDate.split('-').map(Number)
                return new Date(y, m - 1, d)
              })())}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlotGrid
              slots={availability.slots}
              onSelect={handleSlotSelect}
              disabled={quotaAtLimit || isCreating}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Confirm modal */}
      <ConfirmReservationModal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setSelectedSlot(null)
        }}
        onConfirm={handleConfirm}
        isLoading={isCreating}
        area={selectedArea}
        date={selectedDate}
        slot={selectedSlot}
      />
    </div>
  )
}
