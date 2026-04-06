import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationsApi, type CreateReservationPayload } from '@/api/reservations.api'

export function useCreateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateReservationPayload) => {
      const res = await reservationsApi.createReservation(payload)
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      // Invalidate availability for the area+date and the member's reservation list
      void queryClient.invalidateQueries({
        queryKey: ['availability', variables.areaId, variables.date],
      })
      void queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
    },
  })
}
