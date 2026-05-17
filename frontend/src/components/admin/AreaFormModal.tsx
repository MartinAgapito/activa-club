import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AreaRecord, CreateAreaPayload } from '@/api/areas.api'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const TIME_RE = /^\d{2}:\d{2}$/

const areaSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  capacity: z.coerce.number().int().min(1, 'Mínimo 1'),
  slotDuration: z.coerce.number().int().min(15, 'Mínimo 15 min'),
  openingTime: z.string().regex(TIME_RE, 'Formato HH:MM'),
  closingTime: z.string().regex(TIME_RE, 'Formato HH:MM'),
  cancelWindowHours: z.coerce.number().int().min(0),
  silverEnabled: z.boolean(),
  goldEnabled: z.boolean(),
  vipEnabled: z.boolean(),
  silverMax: z.coerce.number().int().min(1).optional(),
  goldMax: z.coerce.number().int().min(1).optional(),
  vipMax: z.coerce.number().int().min(1).optional(),
  silverWeekly: z.coerce.number().int().min(1).optional(),
  goldWeekly: z.coerce.number().int().min(1).optional(),
  vipWeekly: z.coerce.number().int().min(1).optional(),
})

type AreaFormValues = z.infer<typeof areaSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFormValues(area?: AreaRecord): AreaFormValues {
  if (!area) {
    return {
      name: '',
      capacity: 10,
      slotDuration: 60,
      openingTime: '08:00',
      closingTime: '20:00',
      cancelWindowHours: 2,
      silverEnabled: true,
      goldEnabled: true,
      vipEnabled: true,
      silverMax: 60,
      goldMax: 90,
      vipMax: 120,
      silverWeekly: 3,
      goldWeekly: 5,
      vipWeekly: 7,
    }
  }
  return {
    name: area.name,
    capacity: area.capacity,
    slotDuration: area.slotDuration,
    openingTime: area.openingTime,
    closingTime: area.closingTime,
    cancelWindowHours: area.cancelWindowHours,
    silverEnabled: area.allowedMemberships.includes('Silver'),
    goldEnabled: area.allowedMemberships.includes('Gold'),
    vipEnabled: area.allowedMemberships.includes('VIP'),
    silverMax: area.maxDurationMinutes['Silver'],
    goldMax: area.maxDurationMinutes['Gold'],
    vipMax: area.maxDurationMinutes['VIP'],
    silverWeekly: area.weeklyLimit['Silver'],
    goldWeekly: area.weeklyLimit['Gold'],
    vipWeekly: area.weeklyLimit['VIP'],
  }
}

function toPayload(values: AreaFormValues): CreateAreaPayload {
  const allowedMemberships: string[] = []
  const maxDurationMinutes: Record<string, number> = {}
  const weeklyLimit: Record<string, number> = {}

  if (values.silverEnabled) {
    allowedMemberships.push('Silver')
    maxDurationMinutes['Silver'] = values.silverMax ?? 60
    weeklyLimit['Silver'] = values.silverWeekly ?? 3
  }
  if (values.goldEnabled) {
    allowedMemberships.push('Gold')
    maxDurationMinutes['Gold'] = values.goldMax ?? 90
    weeklyLimit['Gold'] = values.goldWeekly ?? 5
  }
  if (values.vipEnabled) {
    allowedMemberships.push('VIP')
    maxDurationMinutes['VIP'] = values.vipMax ?? 120
    weeklyLimit['VIP'] = values.vipWeekly ?? 7
  }

  return {
    name: values.name,
    capacity: values.capacity,
    slotDuration: values.slotDuration,
    openingTime: values.openingTime,
    closingTime: values.closingTime,
    cancelWindowHours: values.cancelWindowHours,
    allowedMemberships,
    maxDurationMinutes,
    weeklyLimit,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AreaFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateAreaPayload) => void
  isLoading: boolean
  area?: AreaRecord
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AreaFormModal({ open, onClose, onSubmit, isLoading, area }: AreaFormModalProps) {
  const isEdit = !!area

  const form = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: toFormValues(area),
  })

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(area))
    }
  }, [open, area])

  const { watch, setValue } = form
  const silverEnabled = watch('silverEnabled')
  const goldEnabled = watch('goldEnabled')
  const vipEnabled = watch('vipEnabled')

  function handleSubmit(values: AreaFormValues) {
    const payload = toPayload(values)
    if (payload.allowedMemberships.length === 0) {
      form.setError('silverEnabled', { message: 'Seleccioná al menos una membresía.' })
      return
    }
    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar área' : 'Nueva área'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Piscina Olímpica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capacity + Slot Duration */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slotDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turno (min)</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Opening / Closing time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apertura</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="closingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cierre</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cancel window */}
            <FormField
              control={form.control}
              name="cancelWindowHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ventana de cancelación (horas)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Memberships */}
            <div>
              <p className="mb-2 text-sm font-medium">Membresías y límites</p>
              {form.formState.errors.silverEnabled && (
                <p className="mb-2 text-sm text-destructive">
                  {form.formState.errors.silverEnabled.message}
                </p>
              )}
              <div className="space-y-3">
                {(
                  [
                    { key: 'silver', label: 'Silver', enabled: silverEnabled, maxField: 'silverMax', weeklyField: 'silverWeekly' },
                    { key: 'gold', label: 'Gold', enabled: goldEnabled, maxField: 'goldMax', weeklyField: 'goldWeekly' },
                    { key: 'vip', label: 'VIP', enabled: vipEnabled, maxField: 'vipMax', weeklyField: 'vipWeekly' },
                  ] as const
                ).map(({ key, label, enabled, maxField, weeklyField }) => (
                  <div key={key} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${key}Enabled`}
                        checked={enabled}
                        onChange={(e) =>
                          setValue(`${key}Enabled` as keyof AreaFormValues, e.target.checked as never)
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      <label htmlFor={`${key}Enabled`} className="text-sm font-medium">
                        {label}
                      </label>
                    </div>
                    {enabled && (
                      <div className="grid grid-cols-2 gap-3 pl-6">
                        <FormField
                          control={form.control}
                          name={maxField}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Duración máx (min)</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={weeklyField}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Límite semanal</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear área'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
