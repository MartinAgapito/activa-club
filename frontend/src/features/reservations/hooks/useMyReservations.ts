import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationsApi } from '@/api/reservations.api'

export function useMyReservations(view: 'upcoming' | 'history') {
  return useInfiniteQuery({
    queryKey: ['my-reservations', view],
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : undefined
      const res = await reservationsApi.getMyReservations(view, cursor)
      return res.data.data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await reservationsApi.cancelReservation(reservationId)
      return res.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
    },
  })
}
