import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AuthState, User, AuthTokens } from '@/types'
import { authService } from '@/services/api'
import { setTokens, clearTokens } from '@/services/api/client'

interface AuthStore extends AuthState {
  // Actions
  login: (username: string, password: string) => Promise<void>
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

          const response = await authService.apiVerifyToken()

          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            get().clearAuth()
          }
        } catch {
          get().clearAuth()
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