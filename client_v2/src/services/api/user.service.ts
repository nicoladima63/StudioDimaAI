import { BaseService } from './base.service'
import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types'
import type { User } from '@/types/user' // Assuming User type is defined here

interface CreateUserPayload {
  username: string
  password: string
  role: 'admin' | 'user'
}

interface UpdateUserPayload {
  username?: string
  password?: string
  role?: 'admin' | 'user'
}

/**
 * Service per la gestione degli utenti
 */
class UserService extends BaseService {
  constructor() {
    super('/users') // Base path for user management APIs
  }

  /**
   * Recupera tutti gli utenti (risposta non paginata)
   */
  async apiGetAllUsers(): Promise<ApiResponse<User[]>> {
    return this.apiGet<User[]>('')
  }

  /**
   * Recupera un singolo utente per ID
   */
  async apiGetUserById(userId: number): Promise<ApiResponse<User>> {
    return this.apiGet<User>(`/${userId}`)
  }

  /**
   * Crea un nuovo utente
   */
  async apiCreateUser(payload: CreateUserPayload): Promise<ApiResponse<User>> {
    return this.apiPost<User, CreateUserPayload>('', payload)
  }

  /**
   * Aggiorna un utente esistente
   */
  async apiUpdateUser(userId: number, payload: UpdateUserPayload): Promise<ApiResponse<User>> {
    return this.apiPut<User, UpdateUserPayload>(`/${userId}`, payload)
  }

  /**
   * Elimina un utente
   */
  async apiDeleteUser(userId: number): Promise<ApiResponse<null>> {
    return this.apiDelete<null>(`/${userId}`)
  }
}

export const userService = new UserService()
export { UserService }