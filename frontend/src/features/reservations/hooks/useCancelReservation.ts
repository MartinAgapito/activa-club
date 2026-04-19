import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { reservationsApi } from '@/api/reservations.api'
import { toast } from '@/hooks/useToast'

// ─── Error code → Spanish message mapping (AC-013 design doc §7.3) ─────────────

const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  CANCELLATION_WINDOW_CLOSED: 'No podés cancelar con menos de 2 horas de anticipación.',
  INVALID_STATUS: 'Esta reserva ya fue cancelada o finalizada.',
  FORBIDDEN: 'No tenés permiso para cancelar esta reserva.',
  RESERVATION_NOT_FOUND:
    'No se encontró la reserva. Es posible que ya haya sido cancelada.',
}

function mapCancellationError(error: unknown): string {
  if (isAxiosError(error)) {
    const code = error.response?.data?.error?.code as string | undefined
    if (code && code in CANCEL_ERROR_MESSAGES) {
      return CANCEL_ERROR_MESSAGES[code]
    }
    const backendMessage = error.response?.data?.error?.message as string | undefined
    if (backendMessage) return backendMessage
  }
  return 'No se pudo cancelar la reserva. Intentá nuevamente.'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * AC-013: Mutation hook for cancelling a member's own reservation.
 *
 * On success:
 *   - Shows a Spanish success toast.
 *   - Invalidates 'my-reservations' (both upcoming and history views).
 *   - Invalidates 'area-availability' so the freed slot appears immediately.
 *
 * On error:
 *   - Maps API error codes (403, 409) to Spanish user messages via toast.
 */
export function useCancelReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await reservationsApi.cancelReservation(reservationId)
      return res.data.data
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['area-availability'] })

      toast({
        title: 'Reserva cancelada',
        description: 'La reserva fue cancelada exitosamente.',
      })
    },

    onError: (error: unknown) => {
      const message = mapCancellationError(error)
      toast({
        title: 'Error al cancelar',
        description: message,
        variant: 'destructive',
      })
    },
  })
}
