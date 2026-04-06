import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAreaBlockSchema, type CreateAreaBlockFormValues } from '@/lib/zod-schemas'
import type { AreaSummary } from '@/api/reservations.api'

interface CreateBlockModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (values: CreateAreaBlockFormValues) => void
  isLoading: boolean
  areas: AreaSummary[]
  preselectedAreaId?: string
  preselectedDate?: string
}

export function CreateBlockModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  areas,
  preselectedAreaId,
  preselectedDate,
}: CreateBlockModalProps) {
  const form = useForm<CreateAreaBlockFormValues>({
    resolver: zodResolver(createAreaBlockSchema),
    defaultValues: {
      areaId: preselectedAreaId ?? '',
      date: preselectedDate ?? '',
      startTime: '',
      endTime: '',
      reason: '',
    },
  })

  function handleSubmit(values: CreateAreaBlockFormValues) {
    onConfirm(values)
  }

  function handleClose() {
    form.reset()
    onClose()
  }

  const activeAreas = areas.filter((a) => a.isActive)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bloquear franja horaria</DialogTitle>
          <DialogDescription>
            Bloqueá una franja para impedir nuevas reservas en ese horario.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Area */}
            <FormField
              control={form.control}
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Seleccionar área">
                        <SelectValue placeholder="Seleccioná un área" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeAreas.map((area) => (
                        <SelectItem key={area.areaId} value={area.areaId}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isLoading}
                      aria-label="Fecha del bloqueo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora inicio</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        disabled={isLoading}
                        aria-label="Hora de inicio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora fin</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        disabled={isLoading}
                        aria-label="Hora de fin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Describí el motivo del bloqueo…"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Bloquear franja
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
