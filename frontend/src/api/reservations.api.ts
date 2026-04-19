import apiClient from '@/api/client'
import type { ApiResponse } from '@/types'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  startTime: string       // HH:mm
  endTime: string         // HH:mm
  available: number       // seats available
  capacity: number        // total capacity
  status: 'available' | 'full' | 'blocked'
  blockId?: string        // present when status === 'blocked'
  blockReason?: string
}

export interface AreaAvailabilityResponse {
  areaId: string
  areaName: string
  date: string
  slots: AvailabilitySlot[]
  weeklyQuota: {
    used: number
    limit: number
  }
}

export interface AreaSummary {
  areaId: string
  name: string
  type: string
  capacity: number
  isActive: boolean
}

/**
 * AC-014: Status values as returned by the backend (UPPERCASE).
 * CONFIRMED = upcoming reservation; CANCELLED/EXPIRED = history.
 */
export type ReservationStatus = 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'

/**
 * AC-014: Single reservation item returned by GET /v1/reservations/me.
 */
export interface ReservationItem {
  reservationId: string
  areaId: string
  areaName: string
  date: string             // YYYY-MM-DD
  startTime: string        // HH:mm
  endTime: string          // HH:mm
  durationMinutes: number
  status: ReservationStatus
  createdAt: string        // ISO-8601 UTC
}

/**
 * @deprecated Use ReservationItem for AC-014 responses.
 * Kept temporarily for components that reference ReservationRecord from manager views.
 */
export interface ReservationRecord {
  reservationId: string
  areaId: string
  areaName: string
  date: string          // YYYY-MM-DD
  startTime: string     // HH:mm
  endTime: string       // HH:mm
  status: ReservationStatus
  memberId?: string
  memberName?: string
  memberEmail?: string
  createdAt: string
}

export interface WeeklyQuota {
  used: number
  limit: number
  resetsAt?: string  // ISO-8601 UTC — when the weekly counter resets
}

/**
 * AC-014: Response shape of GET /v1/reservations/me.
 * `lastKey` is null when no more pages exist.
 */
export interface MyReservationsResponse {
  items: ReservationItem[]
  weeklyQuota: WeeklyQuota
  membershipStatus: string   // 'active' | 'suspended' | etc.
  lastKey: string | null
}

export interface ManagerReservationsResponse {
  date: string
  areas: {
    areaId: string
    areaName: string
    slots: Array<{
      startTime: string
      endTime: string
      status: 'available' | 'full' | 'blocked'
      reservation?: ReservationRecord
      blockId?: string
      blockReason?: string
    }>
  }[]
}

// ─── Request payloads ─────────────────────────────────────────────────────────

/**
 * AC-012: POST /v1/reservations request body.
 * Note: `durationMinutes` replaces the old `endTime` field — the backend
 * computes endTime from startTime + durationMinutes atomically.
 */
export interface CreateReservationPayload {
  areaId: string
  date: string              // YYYY-MM-DD
  startTime: string         // HH:mm (hourly boundary)
  durationMinutes: number   // multiple of 60; max depends on membership tier
}

/**
 * AC-012: POST /v1/reservations response body (HTTP 201).
 */
export interface CreateReservationResponse {
  reservationId: string
  areaId: string
  areaName: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  durationMinutes: number
  status: 'CONFIRMED'
  createdAt: string   // ISO-8601 UTC
}

export interface CancelReservationPayload {
  reason?: string
}

export interface CreateAreaBlockPayload {
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  date: string        // YYYY-MM-DD
  reason: string
}

// ─── API functions ────────────────────────────────────────────────────────────

export const reservationsApi = {
  /**
   * AC-011: Fetch availability slots for an area on a given date.
   * Also returns the member's weekly quota.
   */
  getAvailability(areaId: string, date: string) {
    return apiClient.get<ApiResponse<AreaAvailabilityResponse>>(
      `/v1/areas/${areaId}/availability`,
      { params: { date } }
    )
  },

  /**
   * Fetch the list of all active areas.
   */
  getAreas() {
    return apiClient.get<ApiResponse<AreaSummary[]>>('/v1/areas')
  },

  /**
   * AC-012: Create a new reservation.
   * Body: { areaId, date, startTime, durationMinutes }
   * Success: HTTP 201 with CreateReservationResponse
   */
  createReservation(payload: CreateReservationPayload) {
    return apiClient.post<ApiResponse<CreateReservationResponse>>('/v1/reservations', payload)
  },

  /**
   * AC-013: Cancel own reservation.
   */
  cancelReservation(reservationId: string) {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/v1/reservations/${reservationId}`
    )
  },

  /**
   * AC-014: Fetch own reservations with view filter and cursor-based pagination.
   * Query params: view, limit=20, lastKey (cursor).
   */
  getMyReservations(view: 'upcoming' | 'history', lastKey?: string) {
    return apiClient.get<ApiResponse<MyReservationsResponse>>('/v1/reservations/me', {
      params: {
        view,
        limit: 20,
        ...(lastKey ? { lastKey } : {}),
      },
    })
  },

  /**
   * AC-015: Manager — fetch all reservations for a date (and optional area).
   */
  getManagerReservations(date: string, areaId?: string) {
    return apiClient.get<ApiResponse<ManagerReservationsResponse>>(
      '/v1/manager/reservations',
      { params: { date, ...(areaId ? { areaId } : {}) } }
    )
  },

  /**
   * AC-015: Manager — cancel any reservation with a required reason.
   */
  managerCancelReservation(reservationId: string, reason: string) {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/v1/manager/reservations/${reservationId}`,
      { data: { reason } }
    )
  },

  /**
   * AC-016: Manager — block a time slot in an area.
   */
  createAreaBlock(areaId: string, payload: CreateAreaBlockPayload) {
    return apiClient.post<ApiResponse<{ blockId: string; message: string }>>(
      `/v1/areas/${areaId}/blocks`,
      payload
    )
  },

  /**
   * AC-016: Manager — remove a block from an area.
   */
  deleteAreaBlock(areaId: string, blockId: string) {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/v1/areas/${areaId}/blocks/${blockId}`
    )
  },
}
