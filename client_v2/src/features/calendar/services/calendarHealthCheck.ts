import apiClient from '@/services/api/client'
import type { ApiResponse } from '@/types'

export interface CalendarHealthStatus {
  google_calendar_connected: boolean
  google_error: string | null
  sync_state_entries: number
  token_exists: boolean
  credentials_exists: boolean
}

export interface CalendarHealthResponse extends ApiResponse {
  data: CalendarHealthStatus
}

export interface ResetSyncStateResponse extends ApiResponse {
  data: {
    message: string
    backup: string
  }
}

class CalendarHealthService {
  /**
   * Controlla lo stato di salute del calendario
   */
  async checkHealth(): Promise<CalendarHealthStatus> {
    const response = await apiClient.get<CalendarHealthResponse>('/calendar/health')
    if (!response.data || !response.data.data) {
      throw new Error('Risposta del server non valida (dati salute mancanti)')
    }
    return response.data.data
  }

  /**
   * Resetta lo stato di sincronizzazione
   */
  async resetSyncState(): Promise<{ message: string; backup: string }> {
    const response = await apiClient.post<ResetSyncStateResponse>('/calendar/sync/reset')
    return response.data.data
  }
}

export const calendarHealthService = new CalendarHealthService()