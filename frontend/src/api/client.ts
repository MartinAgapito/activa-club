import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useAuthStore } from '@/store'

const API_URL = import.meta.env.VITE_API_URL as string

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// Request interceptor: attach JWT token
// Priority: idToken from store (CUSTOM_AUTH flow) > Amplify session (OAuth/Hosted UI flow)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Try the idToken stored after CUSTOM_AUTH verify-otp
    const storedToken = useAuthStore.getState().idToken
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`
      return config
    }

    // 2. Fall back to Amplify session (covers OAuth / Hosted UI sign-in)
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // User is not authenticated; continue without token
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
