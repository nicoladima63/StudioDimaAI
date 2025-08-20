import type { AxiosResponse } from 'axios'
import apiClient from './client'
import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types'

/**
 * Base service class con metodi comuni per tutte le API
 */
export class BaseService {
  protected basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  /**
   * GET request generico
   */
  protected async apiGet<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.get(
      `${this.basePath}${endpoint}`,
      { params }
    )
    return response.data
  }

  /**
   * POST request generico
   */
  protected async apiPost<T, U = any>(
    endpoint: string,
    data?: U
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.post(
      `${this.basePath}${endpoint}`,
      data
    )
    return response.data
  }

  /**
   * PUT request generico
   */
  protected async apiPut<T, U = any>(
    endpoint: string,
    data?: U
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.put(
      `${this.basePath}${endpoint}`,
      data
    )
    return response.data
  }

  /**
   * DELETE request generico
   */
  protected async apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.delete(
      `${this.basePath}${endpoint}`
    )
    return response.data
  }

  /**
   * GET con paginazione
   */
  protected async apiGetPaginated<T>(
    endpoint: string,
    params: PaginationParams & Record<string, any> = { page: 1, limit: 20 }
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<T>>> = await apiClient.get(
      `${this.basePath}${endpoint}`,
      { params }
    )
    return response.data
  }
}

// Utility functions per i service
export const createService = (basePath: string) => new BaseService(basePath)

// Export service pattern per compatibilità con CLAUDE.md
export const servicePattern = {
  /**
   * Wrapper per chiamate API con prefisso "api"
   */
  api: <T>(serviceInstance: BaseService, method: keyof BaseService, ...args: any[]): Promise<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (serviceInstance as any)[method](...args)
  },
}