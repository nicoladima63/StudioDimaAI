import apiClient from './client'

export interface Work {
  id: number
  name: string
  description?: string
  created_at: string
  updated_at: string
}

const WORKS_URL = '/works'

export const worksService = {
  apiGetAll: async (): Promise<Work[]> => {
    const response = await apiClient.get<any>(WORKS_URL)
    return response.data.data || []
  },

  apiGetById: async (id: number): Promise<Work | null> => {
    try {
      const response = await apiClient.get<any>(`${WORKS_URL}/${id}`)
      return response.data.data || null
    } catch (error: any) {
      if (error.response?.status === 404) return null
      throw error
    }
  }
}

export default worksService
