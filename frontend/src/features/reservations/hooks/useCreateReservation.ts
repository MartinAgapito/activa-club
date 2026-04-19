import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { reservationsApi, type CreateReservationPayload, type CreateReservationResponse } from '@/api/reservations.api'
import { toast } from '@/hooks/useToast'

// ─── Error code → Spanish message mapping (AC-012 design doc §7.2) ────────────

const RESERVATION_ERROR_MESSAGES: Record<string, string> = {
  SLOT_FULL:
    'El horario ya no está disponible. Por favor, elegí otro.',
  WEEKLY_QUOTA_EXCEEDED:
    'Alcanzaste tu límite semanal de reservas.',
  MEMBERSHIP_INACTIVE:
    'Tu membresía está inactiva. Regularizá tu situación para reservar.',
  AREA_NOT_ACCESSIBLE:
    'No tenés acceso a esta área con tu tipo de membresía.',
  OVERLAP_CONFLICT:
    'Ya tenés una reserva en ese horario.',
  DURATION_EXCEEDS_MAXIMUM:
    'La duración elegida supera el máximo permitido para tu membresía.',
  DURATION_NOT_MULTIPLE:
    'La duración debe ser múltiplo de 60 minutos.',
  DATE_IN_PAST:
    'La fecha seleccionada ya pasó. Elegí una fecha futura.',
  DATE_EXCEEDS_WINDOW:
    'Solo podés reservar hasta 7 días adelante.',
  INVALID_START_TIME:
    'La hora de inicio no es válida para ese día.',
  AREA_NOT_FOUND:
    'El área seleccionada no está disponible.',
}

function mapReservationError(error: unknown): string {
  if (isAxiosError(error)) {
    const code = error.response?.data?.error?.code as string | undefined
    if (code && code in RESERVATION_ERROR_MESSAGES) {
      return RESERVATION_ERROR_MESSAGES[code]
    }
    // Fallback to backend message if available
    const backendMessage = error.response?.data?.error?.message as string | undefined
    if (backendMessage) return backendMessage
  }
  return 'No se pudo crear la reserva. Intentá nuevamente.'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * AC-012: Mutation hook for creating a new reservation.
 *
 * On success:
 *   - Shows a Spanish success toast with the reservation code.
 *   - Invalidates 'my-reservations' and 'area-availability' queries.
 *   - Navigates to /member/reservations.
 *
 * On error:
 *   - Maps API error codes to Spanish user messages.
 *   - Shows a destructive toast.
 */
export function useCreateReservation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation<CreateReservationResponse, unknown, CreateReservationPayload>({
    mutationFn: async (payload: CreateReservationPayload) => {
      const res = await reservationsApi.createReservation(payload)
      return res.data.data
    },

    onSuccess: (data, variables) => {
      // Invalidate availability cache for the affected area + date
      void queryClient.invalidateQueries({
        queryKey: ['area-availability', variables.areaId, variables.date],
      })
      // Invalidate the member's reservation list (AC-014)
      void queryClient.invalidateQueries({ queryKey: ['my-reservations'] })

      toast({
        title: 'Reserva confirmada',
        description: `Código: ${data.reservationId} · ${data.areaName} · ${data.date} ${data.startTime}–${data.endTime}`,
      })

      navigate('/member/reservations')
    },

    onError: (error: unknown) => {
      const message = mapReservationError(error)
      toast({
        title: 'Error al reservar',
        description: message,
        variant: 'destructive',
      })
    },
  })
}
