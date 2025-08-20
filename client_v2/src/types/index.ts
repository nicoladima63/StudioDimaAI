// Core types per l'applicazione Studio Dima V2

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  message: string
  status: number
  code?: string
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Auth types
export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Common utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface StoreState<T> {
  data: T | null
  status: LoadingState
  error: string | null
  lastUpdated: number | null
}

// Route types
export interface RouteConfig {
  path: string
  component: React.ComponentType
  exact?: boolean
  protected?: boolean
  roles?: User['role'][]
}