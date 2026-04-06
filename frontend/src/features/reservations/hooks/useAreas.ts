import { useQuery } from '@tanstack/react-query'
import { reservationsApi } from '@/api/reservations.api'

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const res = await reservationsApi.getAreas()
      return res.data.data
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — areas change rarely
  })
}
