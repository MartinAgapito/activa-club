import apiClient from '@/api/client'
import type { ApiResponse } from '@/types'

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
  /** True when the authenticated member already has a confirmed reservation overlapping this slot. */
  bookedByMe?: boolean
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

// ─── Admin area types ─────────────────────────────────────────────────────────

export interface AreaRecord {
  areaId: string
  name: string
  status: 'Active' | 'Inactive'
  capacity: number
  slotDuration: number
  openingTime: string
  closingTime: string
  cancelWindowHours: number
  allowedMemberships: string[]
  maxDurationMinutes: Record<string, number>
  weeklyLimit: Record<string, number>
}

export interface CreateAreaPayload {
  name: string
  capacity: number
  slotDuration: number
  openingTime: string
  closingTime: string
  cancelWindowHours: number
  allowedMemberships: string[]
  maxDurationMinutes: Record<string, number>
  weeklyLimit: Record<string, number>
}

export type UpdateAreaPayload = Partial<CreateAreaPayload>

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * AC-011: Fetch hourly slot availability for an area on a specific date.
 */
export function getAreaAvailability(areaId: string, date: string) {
  return apiClient.get<ApiResponse<AreaAvailabilityResponse>>(
    `/v1/areas/${areaId}/availability`,
    { params: { date } }
  )
}

// ─── Admin CRUD functions ─────────────────────────────────────────────────────

export function adminListAllAreas() {
  return apiClient.get<ApiResponse<AreaRecord[]>>('/v1/admin/areas')
}

export function adminCreateArea(payload: CreateAreaPayload) {
  return apiClient.post<ApiResponse<AreaRecord>>('/v1/admin/areas', payload)
}

export function adminUpdateArea(areaId: string, payload: UpdateAreaPayload) {
  return apiClient.put<ApiResponse<AreaRecord>>(`/v1/admin/areas/${areaId}`, payload)
}

export function adminToggleAreaStatus(areaId: string, status: 'Active' | 'Inactive') {
  return apiClient.patch<ApiResponse<{ areaId: string; status: string }>>(
    `/v1/admin/areas/${areaId}/status`,
    { status }
  )
}
