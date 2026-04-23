import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios'
import toast from 'react-hot-toast'

import type { ApiResponse, ApiError } from '@/types'
import { config } from '@/utils'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token management
let accessToken: string | null = null
let refreshToken: string | null = null

// Callback called when a 401 forces logout (registered by auth store to avoid circular imports)
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedCallback = (cb: () => void): void => {
  onUnauthorized = cb
}

export const setTokens = (access: string, refresh: string): void => {
  accessToken = access
  refreshToken = refresh
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
  
  // Also update Zustand store if available
  try {
    const authStore = localStorage.getItem('auth-store')
    if (authStore) {
      const parsed = JSON.parse(authStore)
      if (parsed.state) {
        parsed.state.tokens = {
          accessToken: access,
          refreshToken: refresh,
          expiresIn: parsed.state.tokens?.expiresIn || 3600
        }
        parsed.state.isAuthenticated = true
        localStorage.setItem('auth-store', JSON.stringify(parsed))
      }
    }
  } catch (error) {
    console.warn('Failed to sync tokens with Zustand store:', error)
  }
}

export const clearTokens = (): void => {
  accessToken = null
  refreshToken = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  
  // Also clear Zustand store if available
  try {
    const authStore = localStorage.getItem('auth-store')
    if (authStore) {
      const parsed = JSON.parse(authStore)
      if (parsed.state) {
        parsed.state.tokens = null
        parsed.state.user = null
        parsed.state.isAuthenticated = false
        localStorage.setItem('auth-store', JSON.stringify(parsed))
      }
    }
  } catch (error) {
    console.warn('Failed to clear Zustand store:', error)
  }
}

export const getTokens = (): { accessToken: string | null; refreshToken: string | null } => {
  // Always reload from localStorage to ensure we have the latest tokens
  // This is important because tokens can be updated from multiple places
  accessToken = localStorage.getItem('access_token')
  refreshToken = localStorage.getItem('refresh_token')
  return { accessToken, refreshToken }
}

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  config => {
    const { accessToken } = getTokens()
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config

    // Handle token refresh for 401 errors
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true

      const { refreshToken } = getTokens()
      if (refreshToken) {
        try {
          const response = await axios.post(
            `${config.api.baseUrl}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } }
          )

          const { access_token, refresh_token } = response.data.data
          // Server may not return a new refresh token - keep the existing one in that case
          setTokens(access_token, refresh_token || refreshToken)

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed - clear auth state (triggers redirect via ProtectedRoute)
          onUnauthorized ? onUnauthorized() : clearTokens()
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token - clear auth state (triggers redirect via ProtectedRoute)
        onUnauthorized ? onUnauthorized() : clearTokens()
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || error.message || 'Errore sconosciuto'
    
    // Don't show toast for auth errors (handled by redirect)
    if (error.response?.status !== 401) {
      toast.error(errorMessage)
    }

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status || 500,
      code: error.response?.data?.code,
    })
  }
)

export default apiClient