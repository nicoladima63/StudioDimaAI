import { BaseService } from './base.service'
import type { LoginCredentials, User, ApiResponse } from '@/types'

interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_in: number
}

interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

/**
 * Auth Service per gestione autenticazione
 */
class AuthService extends BaseService {
  constructor() {
    super('') // No prefix needed, endpoints are directly under /api/v2/
  }

  /**
   * Login utente
   */
  async apiLogin(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    return this.apiPost<LoginResponse, LoginCredentials>('/login', credentials)
  }

  /**
   * Logout utente
   */
  async apiLogout(): Promise<ApiResponse<null>> {
    return this.apiPost<null>('/logout')
  }

  /**
   * Refresh token
   */
  async apiRefreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponse>> {
    return this.apiPost<RefreshTokenResponse, { refresh_token: string }>('/refresh', {
      refresh_token: refreshToken,
    })
  }

  /**
   * Verifica token corrente
   */
  async apiVerifyToken(): Promise<ApiResponse<User>> {
    return this.apiGet<User>('/verify')
  }

  /**
   * Get profilo utente corrente
   */
  async apiGetProfile(): Promise<ApiResponse<User>> {
    return this.apiGet<User>('/profile')
  }

  /**
   * Aggiorna profilo utente
   */
  async apiUpdateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.apiPut<User, Partial<User>>('/profile', data)
  }
}

// Export singleton instance
export const authService = new AuthService()

// Export class per testing
export { AuthService }