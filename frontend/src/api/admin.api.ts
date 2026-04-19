import apiClient from '@/api/client'

export interface ExpireNowResult {
  processed: number
  errors: number
}

export async function triggerManualExpiration(): Promise<ExpireNowResult> {
  const response = await apiClient.post<ExpireNowResult>('/v1/admin/reservations/expire-now')
  return response.data
}
