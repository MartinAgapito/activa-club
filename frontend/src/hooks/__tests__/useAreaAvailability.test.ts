import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAreaAvailability } from '../useAreaAvailability'
import * as areasApi from '@/api/areas.api'
import type { AreaAvailabilityResponse } from '@/api/areas.api'

// ─── Mock the API module ───────────────────────────────────────────────────────

vi.mock('@/api/areas.api', () => ({
  getAreaAvailability: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const mockResponse: AreaAvailabilityResponse = {
  areaId: '01JTEST000000000000000001',
  areaName: 'Cancha de Tenis',
  date: '2026-04-20',
  capacity: 4,
  weeklyQuotaInfo: {
    used: 1,
    limit: 3,
    exhausted: false,
    resetsAt: '2026-04-27T00:00:00Z',
  },
  slots: [
    { startTime: '09:00', endTime: '10:00', available: 3, total: 4, status: 'AVAILABLE', blocked: false },
    { startTime: '10:00', endTime: '11:00', available: 0, total: 4, status: 'FULL', blocked: false },
    { startTime: '11:00', endTime: '12:00', available: 0, total: 4, status: 'BLOCKED', blocked: true },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAreaAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is disabled when areaId is empty', () => {
    const { result } = renderHook(
      () => useAreaAvailability('', '2026-04-20'),
      { wrapper: createWrapper() }
    )
    // query should not be triggered
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('is disabled when date is empty', () => {
    const { result } = renderHook(
      () => useAreaAvailability('01JTEST000000000000000001', ''),
      { wrapper: createWrapper() }
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('fetches availability when areaId and date are provided', async () => {
    vi.mocked(areasApi.getAreaAvailability).mockResolvedValue({
      data: { success: true, data: mockResponse, timestamp: '2026-04-20T00:00:00.000Z' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(
      () => useAreaAvailability('01JTEST000000000000000001', '2026-04-20'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockResponse)
    expect(result.current.data?.slots).toHaveLength(3)
    expect(result.current.data?.weeklyQuotaInfo?.exhausted).toBe(false)
  })

  it('uses the correct query key', async () => {
    vi.mocked(areasApi.getAreaAvailability).mockResolvedValue({
      data: { success: true, data: mockResponse, timestamp: '2026-04-20T00:00:00.000Z' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const areaId = '01JTEST000000000000000001'
    const date = '2026-04-20'

    const { result } = renderHook(
      () => useAreaAvailability(areaId, date),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(areasApi.getAreaAvailability).toHaveBeenCalledWith(areaId, date)
  })

  it('returns error state when API call fails', async () => {
    vi.mocked(areasApi.getAreaAvailability).mockRejectedValue(
      new Error('Network Error')
    )

    const { result } = renderHook(
      () => useAreaAvailability('01JTEST000000000000000001', '2026-04-20'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
