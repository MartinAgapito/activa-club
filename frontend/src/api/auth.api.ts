import apiClient from '@/api/client'
import type { ApiResponse } from '@/types'

// ─── Request payload types ────────────────────────────────────────────────────

export interface RegisterPayload {
  dni: string
  email: string
  password: string
}

export interface VerifyEmailPayload {
  email: string
  token: string
}

export interface ResendCodePayload {
  email: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface VerifyOtpPayload {
  email: string
  session: string
  otp: string
}

// ─── Response data types ──────────────────────────────────────────────────────

export interface RegisterData {
  message: string
  userSub?: string
}

export interface VerifyEmailData {
  message: string
}

export interface ResendCodeData {
  message: string
}

export interface LoginData {
  session: string
  challengeName: string
  email: string
}

export interface VerifyOtpData {
  idToken: string
  accessToken?: string
  refreshToken?: string
}

export interface LogoutData {
  message: string
}

// ─── Error shape returned by the backend ─────────────────────────────────────

export interface AuthApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  timestamp: string
}

// ─── API functions ────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Step 1 of registration: create Cognito user.
   * Backend verifies the DNI against the members table before creating the account.
   */
  register(payload: RegisterPayload) {
    return apiClient.post<ApiResponse<RegisterData>>('/v1/auth/register', payload)
  },

  /**
   * Step 2 of registration: confirm the email verification code sent by Cognito.
   */
  verifyEmail(payload: VerifyEmailPayload) {
    return apiClient.post<ApiResponse<VerifyEmailData>>('/v1/auth/verify-email', payload)
  },

  /**
   * Resend the email verification code for a given email address.
   */
  resendCode(payload: ResendCodePayload) {
    return apiClient.post<ApiResponse<ResendCodeData>>('/v1/auth/resend-code', payload)
  },

  /**
   * Step 1 of login (CUSTOM_AUTH flow).
   * Returns a `session` string that must be passed to verifyOtp.
   */
  login(payload: LoginPayload) {
    return apiClient.post<ApiResponse<LoginData>>('/v1/auth/login', payload)
  },

  /**
   * Step 2 of login: verify the OTP code sent to the user's email.
   * Returns an idToken (JWT) that is stored in the auth store.
   */
  verifyOtp(payload: VerifyOtpPayload) {
    return apiClient.post<ApiResponse<VerifyOtpData>>('/v1/auth/verify-otp', payload)
  },

  /**
   * AC-008: Global sign-out.
   * Calls the backend to invalidate all Cognito sessions for the authenticated member.
   * The accessToken is passed in the Authorization header by the apiClient interceptor.
   */
  logout(accessToken: string) {
    return apiClient.post<ApiResponse<LogoutData>>(
      '/v1/auth/logout',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
  },
}
