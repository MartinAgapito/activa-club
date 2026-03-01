import { apiClient } from './client'

// ─── POST /v1/auth/register ─────────────────────────────────────────────────

export interface RegisterRequest {
  dni: string
  email: string
  password: string
}

export interface RegisterResponse {
  status: 'success'
  data: {
    email: string
    message: string
  }
}

// ─── POST /v1/auth/verify-email ─────────────────────────────────────────────

export interface VerifyEmailRequest {
  email: string
  code: string
}

export interface VerifyEmailResponse {
  status: 'success'
  data: {
    member_id: string
    full_name: string
    email: string
    membership_type: string
    account_status: string
    created_at: string
  }
  message: string
}

// ─── POST /v1/auth/resend-code ───────────────────────────────────────────────

export interface ResendCodeRequest {
  email: string
}

// ─── POST /v1/auth/login ────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  status: 'success'
  data: {
    challengeName: string
    session: string
    message: string
  }
}

// ─── POST /v1/auth/verify-otp ───────────────────────────────────────────────

export interface VerifyOtpRequest {
  email: string
  session: string
  otp: string
}

export interface VerifyOtpResponse {
  status: 'success'
  data: {
    accessToken: string
    idToken: string
    refreshToken: string
    expiresIn: number
    tokenType: string
  }
}

// ─── API error shape from the backend ────────────────────────────────────────

export interface AuthApiError {
  status: 'error'
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

const BASE = '/v1/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>(`${BASE}/register`, data),

  verifyEmail: (data: VerifyEmailRequest) =>
    apiClient.post<VerifyEmailResponse>(`${BASE}/verify-email`, data),

  resendCode: (data: ResendCodeRequest) =>
    apiClient.post(`${BASE}/resend-code`, data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(`${BASE}/login`, data),

  verifyOtp: (data: VerifyOtpRequest) =>
    apiClient.post<VerifyOtpResponse>(`${BASE}/verify-otp`, data),
}
