import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

const API_URL = import.meta.env.VITE_API_URL as string

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// Request interceptor: attach JWT token (stored idToken first, then Amplify session)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Prefer the idToken stored after a backend verify-otp response
    const { idToken } = (await import('@/store')).useAuthStore.getState()
    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`
      return config
    }
    // Fallback: try Amplify session (legacy / SSO flows)
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // Not authenticated; continue without token
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor: handle auth errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear persisted auth state and redirect to login
      localStorage.removeItem('activa-club-auth')
      window.location.href = '/auth/login'
    }

    if (error.response?.status === 403) {
      window.location.href = '/auth/login?reason=forbidden'
    }

    return Promise.reject(error)
  }
)

export default apiClient
