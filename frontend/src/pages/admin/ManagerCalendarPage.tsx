import { useState, useMemo } from 'react'
import { AlertCircle, Loader2, ShieldBan, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ManagerCancelModal } from '@/features/reservations/components/ManagerCancelModal'
import { CreateBlockModal } from '@/features/reservations/components/CreateBlockModal'
import {
  useManagerReservations,
  useManagerCancelReservation,
  useCreateAreaBlock,
  useDeleteAreaBlock,
} from '@/features/reservations/hooks/useManagerReservations'
import { useAreas } from '@/features/reservations/hooks/useAreas'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { CreateAreaBlockFormValues } from '@/lib/zod-schemas'
import type { ReservationRecord, AreaSummary } from '@/api/reservations.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISODate(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Slot cell for the calendar table ─────────────────────────────────────────

interface SlotEntry {
  startTime: string
  endTime: string
  status: 'available' | 'full' | 'blocked'
  reservation?: ReservationRecord
  blockId?: string
  blockReason?: string
}

interface SlotCellProps {
  entry: SlotEntry
  onCancelReservation: (reservation: ReservationRecord) => void
  onRemoveBlock: (areaId: string, blockId: string) => void
  areaId: string
  isRemoving: boolean
}

function SlotCell({ entry, onCancelReservation, onRemoveBlock, areaId, isRemoving }: SlotCellProps) {
  if (entry.status === 'available') {
    return (
      <div className="min-h-[3rem] rounded border border-dashed border-muted-foreground/20 bg-muted/20 p-1">
        <span className="text-xs text-muted-foreground/50">Libre</span>
      </div>
    )
  }

  if (entry.status === 'blocked') {
    return (
      <div className="min-h-[3rem] rounded border border-yellow-400/50 bg-yellow-50 p-2 dark:bg-yellow-950/30">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <Badge
              variant="outline"
              className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs dark:bg-yellow-900/50 dark:text-yellow-400"
            >
              Bloqueado
            </Badge>
            {entry.blockReason && (
              <p className="mt-1 truncate text-xs text-yellow-600 dark:text-yellow-500">
                {entry.blockReason}
              </p>
            )}
          </div>
          {entry.blockId && (
            <button
              onClick={() => onRemoveBlock(areaId, entry.blockId!)}
              disabled={isRemoving}
              aria-label="Quitar bloqueo"
              title="Quitar bloqueo"
              className="ml-1 shrink-0 rounded p-0.5 text-yellow-600 hover:bg-yellow-200 disabled:opacity-50 dark:text-yellow-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // full — has reservation
  const r = entry.reservation
  return (
    <div className="min-h-[3rem] rounded border border-blue-300 bg-blue-50 p-2 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-blue-800 dark:text-blue-300">
            {r?.memberName ?? r?.memberEmail ?? 'Socio'}
          </p>
          <Badge
            variant="outline"
            className={cn(
              'mt-0.5 text-xs',
              r?.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            )}
          >
            {r?.status === 'CONFIRMED' ? 'Confirmada' : r?.status ?? 'Reservada'}
          </Badge>
        </div>
        {r?.status === 'CONFIRMED' && (
          <button
            onClick={() => r && onCancelReservation(r)}
            aria-label={`Cancelar reserva de ${r?.memberName ?? 'socio'}`}
            title="Cancelar reserva"
            className="ml-1 shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ManagerCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayISODate())
  const [filterAreaId, setFilterAreaId] = useState<string>('all')
  const [reservationToCancel, setReservationToCancel] = useState<ReservationRecord | null>(null)
  const [blockModalOpen, setBlockModalOpen] = useState(false)

  const { data: areasData } = useAreas()
  const activeAreas: AreaSummary[] = useMemo(
    () => (areasData ?? []).filter((a) => a.isActive),
    [areasData]
  )

  const {
    data: calendarData,
    isLoading,
    isError,
  } = useManagerReservations(
    selectedDate,
    filterAreaId === 'all' ? undefined : filterAreaId
  )

  const { mutate: cancelReservation, isPending: isCancelling } = useManagerCancelReservation()
  const { mutate: createBlock, isPending: isBlocking } = useCreateAreaBlock()
  const { mutate: deleteBlock, isPending: isRemovingBlock } = useDeleteAreaBlock()

  // Collect all unique time slots across all areas for table header
  const allTimeSlots = useMemo<string[]>(() => {
    if (!calendarData) return []
    const slotSet = new Set<string>()
    calendarData.areas.forEach((area) => {
      area.slots.forEach((slot) => slotSet.add(`${slot.startTime}-${slot.endTime}`))
    })
    return Array.from(slotSet).sort()
  }, [calendarData])

  function handleCancelConfirm(reason: string) {
    if (!reservationToCancel) return
    cancelReservation(
      { reservationId: reservationToCancel.reservationId, reason },
      {
        onSuccess: () => {
          toast({ title: 'Reserva cancelada', description: 'La reserva fue cancelada exitosamente.' })
          setReservationToCancel(null)
        },
        onError: (error: unknown) => {
          const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
          const message =
            axiosError?.response?.data?.error?.message ?? 'No se pudo cancelar la reserva.'
          toast({ title: 'Error', description: message, variant: 'destructive' })
        },
      }
    )
  }

  function handleCreateBlock(values: CreateAreaBlockFormValues) {
    createBlock(
      {
        areaId: values.areaId,
        payload: {
          date: values.date,
          startTime: values.startTime,
          endTime: values.endTime,
          reason: values.reason,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Franja bloqueada', description: 'La franja fue bloqueada exitosamente.' })
          setBlockModalOpen(false)
        },
        onError: (error: unknown) => {
          const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
          const message =
            axiosError?.response?.data?.error?.message ?? 'No se pudo bloquear la franja.'
          toast({ title: 'Error', description: message, variant: 'destructive' })
        },
      }
    )
  }

  function handleRemoveBlock(areaId: string, blockId: string) {
    deleteBlock(
      { areaId, blockId },
      {
        onSuccess: () => {
          toast({ title: 'Bloqueo eliminado', description: 'La franja está disponible nuevamente.' })
        },
        onError: (error: unknown) => {
          const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
          const message =
            axiosError?.response?.data?.error?.message ?? 'No se pudo eliminar el bloqueo.'
          toast({ title: 'Error', description: message, variant: 'destructive' })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario de reservas</h1>
          <p className="text-muted-foreground">
            Vista diaria de todas las reservas y bloqueos por área.
          </p>
        </div>
        <Button onClick={() => setBlockModalOpen(true)}>
          <ShieldBan className="mr-2 h-4 w-4" />
          Bloquear franja
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="manager-date">Fecha</Label>
              <Input
                id="manager-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Fecha del calendario"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manager-area">Área</Label>
              <Select value={filterAreaId} onValueChange={setFilterAreaId}>
                <SelectTrigger id="manager-area" aria-label="Filtrar por área">
                  <SelectValue placeholder="Todas las áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {activeAreas.map((area) => (
                    <SelectItem key={area.areaId} value={area.areaId}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar table */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">
              No se pudo cargar el calendario. Intentá nuevamente.
            </p>
          </CardContent>
        </Card>
      ) : !calendarData || calendarData.areas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-muted-foreground">
              No hay datos para esta fecha
              {filterAreaId !== 'all' ? ' y área seleccionada' : ''}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {new Intl.DateTimeFormat('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'America/Argentina/Buenos_Aires',
              }).format((() => {
                const [y, m, d] = selectedDate.split('-').map(Number)
                return new Date(y, m - 1, d)
              })())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid" aria-label="Calendario de reservas">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-semibold text-muted-foreground">
                      Área
                    </th>
                    {allTimeSlots.map((slotKey) => {
                      const [start, end] = slotKey.split('-')
                      return (
                        <th
                          key={slotKey}
                          className="min-w-[120px] px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                        >
                          {start}–{end}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {calendarData.areas.map((area) => {
                    // Build a map of slotKey → slot for this area
                    const slotMap = new Map<string, SlotEntry>()
                    area.slots.forEach((slot) => {
                      slotMap.set(`${slot.startTime}-${slot.endTime}`, slot)
                    })

                    return (
                      <tr key={area.areaId} className="border-t">
                        <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
                          {area.areaName}
                        </td>
                        {allTimeSlots.map((slotKey) => {
                          const entry = slotMap.get(slotKey)
                          return (
                            <td key={slotKey} className="px-2 py-2">
                              {entry ? (
                                <SlotCell
                                  entry={entry}
                                  areaId={area.areaId}
                                  onCancelReservation={setReservationToCancel}
                                  onRemoveBlock={handleRemoveBlock}
                                  isRemoving={isRemovingBlock}
                                />
                              ) : (
                                <div className="min-h-[3rem] rounded border border-dashed border-transparent" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Referencias:</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border border-dashed border-muted-foreground/30 bg-muted/20" />
                Libre
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-50" />
                Reservado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border border-yellow-400/50 bg-yellow-50" />
                Bloqueado
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager cancel modal */}
      <ManagerCancelModal
        open={!!reservationToCancel}
        onClose={() => setReservationToCancel(null)}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
        reservationLabel={
          reservationToCancel
            ? `${reservationToCancel.areaName} — ${reservationToCancel.memberName ?? reservationToCancel.memberEmail ?? ''}`
            : undefined
        }
      />

      {/* Create block modal */}
      <CreateBlockModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={handleCreateBlock}
        isLoading={isBlocking}
        areas={activeAreas}
        preselectedAreaId={filterAreaId !== 'all' ? filterAreaId : undefined}
        preselectedDate={selectedDate}
      />
    </div>
  )
}
