import apiClient from '@/api/client'

// ─── Domain types (aligned with AC-011 design doc) ────────────────────────────

/** Slot status as returned by the backend (uppercase enum). */
export type SlotStatus = 'AVAILABLE' | 'FULL' | 'BLOCKED'

export interface SlotAvailability {
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  /** Seats remaining. For BLOCKED slots this will be 0. */
  available: number
  /** Total capacity configured for the area. */
  total: number
  status: SlotStatus
  blocked: boolean
}

export interface WeeklyQuotaInfo {
  used: number
  limit: number
  exhausted: boolean
  resetsAt: string    // ISO-8601 — next Monday 00:00 UTC
}

/**
 * AC-011: Response shape for GET /v1/areas/{areaId}/availability
 * `weeklyQuotaInfo` is present only when the caller is a Member.
 */
export interface AreaAvailabilityResponse {
  areaId: string
  areaName: string
  date: string          // YYYY-MM-DD
  capacity: number
  weeklyQuotaInfo?: WeeklyQuotaInfo
  slots: SlotAvailability[]
}

/** Lightweight area descriptor returned by GET /v1/areas */
export interface AreaSummaryAC011 {
  areaId: string
  name: string
  /** Membership tiers that may access this area: Silver, Gold, VIP */
  allowedMemberships: string[]
  capacity: number
  openingTime: string   // HH:mm
  closingTime: string   // HH:mm
  isActive: boolean
}

// ─── API error envelope ───────────────────────────────────────────────────────

export interface ApiErrorEnvelope {
  status: number
  error: {
    code: string
    message: string
  }
}

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * AC-011: Fetch hourly slot availability for an area on a specific date.
 * Requires a valid Bearer token (attached automatically by the Axios interceptor).
 *
 * @param areaId  - ULID of the target area
 * @param date    - Date to query in YYYY-MM-DD format
 */
export function getAreaAvailability(areaId: string, date: string) {
  return apiClient.get<AreaAvailabilityResponse>(
    `/v1/areas/${areaId}/availability`,
    { params: { date } }
  )
}
