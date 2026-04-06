import { useQuery } from '@tanstack/react-query'
import { reservationsApi } from '@/api/reservations.api'

export function useAvailability(areaId: string, date: string) {
  return useQuery({
    queryKey: ['availability', areaId, date],
    queryFn: async () => {
      const res = await reservationsApi.getAvailability(areaId, date)
      return res.data.data
    },
    enabled: Boolean(areaId) && Boolean(date),
    staleTime: 1000 * 60 * 1, // 1 minute — availability changes fast
  })
}
