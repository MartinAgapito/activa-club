import { useInfiniteQuery } from '@tanstack/react-query'
import { reservationsApi } from '@/api/reservations.api'

/**
 * AC-014: Infinite query hook for the member's own reservations.
 *
 * - `upcoming` view: CONFIRMED reservations, ascending order.
 * - `history` view:  CANCELLED + EXPIRED reservations, descending order.
 *
 * Pagination is cursor-based: `lastKey` is passed as the `pageParam` for each
 * subsequent page. Returns `null` lastKey when no more pages exist.
 *
 * Query keys:
 *   ['my-reservations', 'upcoming']
 *   ['my-reservations', 'history']
 *
 * Invalidated by:
 *   - `useCreateReservation` (AC-012) on success
 *   - `useCancelReservation` (AC-013) on success
 */
export function useMyReservations(view: 'upcoming' | 'history') {
  return useInfiniteQuery({
    queryKey: ['my-reservations', view],
    queryFn: async ({ pageParam }) => {
      const lastKey = typeof pageParam === 'string' ? pageParam : undefined
      const res = await reservationsApi.getMyReservations(view, lastKey)
      return res.data.data
    },
    initialPageParam: undefined as string | undefined,
    // AC-014 §3: lastKey is null when no more pages; undefined signals "no next page"
    getNextPageParam: (lastPage) => lastPage.lastKey ?? undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}
