import apiClient from './client'

export interface PrestazioneWorkMapping {
  id: number
  codice_prestazione: string
  work_id: number
  created_at: string
  updated_at: string
}

const MAPPING_URL = '/prestazione-work-mapping'

export const prestazioneWorkMappingService = {
  apiGetAll: async (): Promise<PrestazioneWorkMapping[]> => {
    const response = await apiClient.get<any>(MAPPING_URL)
    return response.data.data || []
  },

  apiGetByPrestazione: async (codice: string): Promise<{ codice_prestazione: string; work_id: number } | null> => {
    try {
      const response = await apiClient.get<any>(`${MAPPING_URL}/${codice}`)
      return response.data.data || null
    } catch (error: any) {
      if (error.response?.status === 404) return null
      throw error
    }
  },

  apiUpsert: async (codice_prestazione: string, work_id: number): Promise<PrestazioneWorkMapping> => {
    const response = await apiClient.post<any>(MAPPING_URL, { codice_prestazione, work_id })
    return response.data.data
  },

  apiDelete: async (codice: string): Promise<void> => {
    await apiClient.delete(`${MAPPING_URL}/${codice}`)
  }
}

export default prestazioneWorkMappingService
