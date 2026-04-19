import { useQuery } from '@tanstack/react-query'
import { getAreaAvailability } from '@/api/areas.api'

/**
 * AC-011: React Query hook that fetches slot availability for a given area + date.
 *
 * Query key convention: ['area-availability', areaId, date]
 * This key is intentionally separate from the existing ['availability', ...] key
 * used by useAvailability (reservations.api.ts) so that AC-012/AC-013/AC-016
 * invalidation hooks can target either key independently.
 *
 * staleTime is 30 s because occupancy can change frequently (bookings, blocks).
 */
export function useAreaAvailability(areaId: string, date: string) {
  return useQuery({
    queryKey: ['area-availability', areaId, date] as const,
    queryFn: async () => {
      const res = await getAreaAvailability(areaId, date)
      return res.data
    },
    enabled: Boolean(areaId) && Boolean(date),
    staleTime: 30_000,   // 30 seconds — matches AC-011 design doc
    gcTime: 60_000,      // 1 minute
    retry: 1,
  })
}
