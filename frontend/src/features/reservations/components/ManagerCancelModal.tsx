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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  managerCancelReservationSchema,
  type ManagerCancelReservationFormValues,
} from '@/lib/zod-schemas'

interface ManagerCancelModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isLoading: boolean
  reservationLabel?: string
}

export function ManagerCancelModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  reservationLabel,
}: ManagerCancelModalProps) {
  const form = useForm<ManagerCancelReservationFormValues>({
    resolver: zodResolver(managerCancelReservationSchema),
    defaultValues: { reason: '' },
  })

  function handleSubmit(values: ManagerCancelReservationFormValues) {
    onConfirm(values.reason)
  }

  function handleClose() {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar reserva</DialogTitle>
          <DialogDescription>
            {reservationLabel
              ? `Vas a cancelar la reserva de "${reservationLabel}".`
              : 'Vas a cancelar esta reserva.'}{' '}
            Ingresá el motivo de la cancelación (obligatorio).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de cancelación</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Describí el motivo de la cancelación…"
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
                Volver
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancelar reserva
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
