import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  reservationsApi,
  type CreateAreaBlockPayload,
} from '@/api/reservations.api'

export function useManagerReservations(date: string, areaId?: string) {
  return useQuery({
    queryKey: ['manager-reservations', date, areaId],
    queryFn: async () => {
      const res = await reservationsApi.getManagerReservations(date, areaId)
      return res.data.data
    },
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 1,
  })
}

export function useManagerCancelReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reservationId,
      reason,
    }: {
      reservationId: string
      reason: string
    }) => {
      const res = await reservationsApi.managerCancelReservation(reservationId, reason)
      return res.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-reservations'] })
    },
  })
}

export function useCreateAreaBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      areaId,
      payload,
    }: {
      areaId: string
      payload: CreateAreaBlockPayload
    }) => {
      const res = await reservationsApi.createAreaBlock(areaId, payload)
      return res.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-reservations'] })
    },
  })
}

export function useDeleteAreaBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      areaId,
      blockId,
    }: {
      areaId: string
      blockId: string
    }) => {
      const res = await reservationsApi.deleteAreaBlock(areaId, blockId)
      return res.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-reservations'] })
    },
  })
}
