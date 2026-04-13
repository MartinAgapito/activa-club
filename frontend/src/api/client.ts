import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store'

const API_URL = import.meta.env.VITE_API_URL as string

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// Request interceptor: attach JWT token from the CUSTOM_AUTH store
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const storedToken = useAuthStore.getState().idToken
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor: handle auth errors globally
// Auth endpoints (/v1/auth/*) handle their own errors in the component catch blocks —
// the interceptor must not redirect for those routes or it races with the component.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.startsWith('/v1/auth/')

    if (!isAuthEndpoint) {
      if (error.response?.status === 401) {
        // The Zustand session in sessionStorage will be cleared when the tab closes.
        // The refresh token in localStorage is left intact so LoginPage can attempt
        // a silent refresh on arrival — which will fail if the token is truly expired.
        window.location.href = '/auth/login'
      }

      if (error.response?.status === 403) {
        window.location.href = '/auth/login?reason=forbidden'
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
