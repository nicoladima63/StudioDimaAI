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

export interface FirstSyncStatus {
  is_first_sync: boolean
  token_exists: boolean
  credentials_exist: boolean
  needs_auth: boolean
  needs_auto_sync: boolean
}

export interface AutoSyncJobStatus {
  status: 'in_progress' | 'completed' | 'error'
  progress: number
  phase: string
  message: string
  cleared: number
  synced: number
  total_weeks: number
  current_week: number
  error: string | null
  start_date: string
  end_date: string
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

  /**
   * Verifica se è il primo avvio (sync_state.json mancante)
   */
  async checkFirstSyncStatus(): Promise<FirstSyncStatus> {
    const response = await apiClient.get<ApiResponse & { data: FirstSyncStatus }>('/calendar/first-sync-status')
    return response.data.data
  }

  /**
   * Avvia auto-reset e sincronizzazione 3 settimane
   */
  async startAutoResetAndSync(studioId: number = 1): Promise<string> {
    const response = await apiClient.post<{ job_id: string }>('/calendar/auto-reset-and-sync', { studio_id: studioId })
    return response.data.job_id
  }

  /**
   * Controlla lo stato del job di auto-sync
   */
  async checkAutoSyncJobStatus(jobId: string): Promise<AutoSyncJobStatus> {
    const response = await apiClient.get<ApiResponse & { data: AutoSyncJobStatus }>(`/calendar/sync/job/${jobId}`)
    return response.data.data
  }
}

export const calendarHealthService = new CalendarHealthService()
