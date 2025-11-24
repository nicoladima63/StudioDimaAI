import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AuthState, User, AuthTokens } from '@/types'
import { authService } from '@/services/api'
import { setTokens, clearTokens } from '@/services/api/client'

interface AuthStore extends AuthState {
  // Actions
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  setTokens: (tokens: AuthTokens) => void
  checkAuth: () => Promise<void>
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      login: async (username: string, password: string) => {
        try {
          set({ isLoading: true })

          const response = await authService.apiLogin({ username, password })

          if (response.success && response.data) {
            const { user, access_token, refresh_token, expires_in } = response.data

            const tokens: AuthTokens = {
              accessToken: access_token,
              refreshToken: refresh_token,
              expiresIn: expires_in,
            }

            // Set tokens in API client
            setTokens(access_token, refresh_token)

            set({
              user,
              tokens,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            throw new Error(response.error || 'Login fallito')
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (username: string, password: string) => {
        try {
          set({ isLoading: true })
          const response = await authService.apiRegister({ username, password })
          if (response.success) {
            set({ isLoading: false })
            // Optionally, you could automatically log the user in here
          } else {
            throw new Error(response.error || 'Registrazione fallita')
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        // Call API logout (fire and forget)
        authService.apiLogout().catch(() => {
          // Ignore errors on logout
        })

        // Clear local state
        get().clearAuth()
      },

      setUser: (user: User) => {
        set({ user })
      },

      setTokens: (tokens: AuthTokens) => {
        setTokens(tokens.accessToken, tokens.refreshToken)
        set({ tokens, isAuthenticated: true })
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true })

          // Check if we have tokens first
          const state = get()
          if (!state.tokens?.accessToken) {
            set({ isLoading: false })
            return
          }

          const response = await authService.apiVerifyToken()

          if (response.success && response.data) {
            // Backend returns { user: {...}, authenticated: true }
            const userData = response.data.user || response.data
            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            get().clearAuth()
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('Auth check failed:', error)
          get().clearAuth()
          set({ isLoading: false })
        }
      },

      clearAuth: () => {
        clearTokens()
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },
    }),
    {
      name: 'auth-store',
      partialize: state => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)