import apiClient from './client'
import type { ApiResponse } from '@/types'

export interface MonitorStatus {
  is_running: boolean
  prevent_path: string | null
  cached_records: number
  last_update: string
}

export interface MonitorLog {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface StartMonitorRequest {
  prevent_path?: string
}

export class MonitorPrestazioniService {
  /**
   * Avvia il monitoraggio delle prestazioni
   */
  static async startMonitor(data: StartMonitorRequest = {}): Promise<ApiResponse<{ prevent_path: string }>> {
    const response = await apiClient.post('/monitor/start', data)
    return response.data
  }

  /**
   * Ferma il monitoraggio delle prestazioni
   */
  static async stopMonitor(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/monitor/stop')
    return response.data
  }

  /**
   * Recupera lo stato del monitoraggio
   */
  static async getStatus(): Promise<ApiResponse<MonitorStatus>> {
    const response = await apiClient.get('/monitor/status')
    return response.data
  }

  /**
   * Recupera i log del monitoraggio
   */
  static async getLogs(): Promise<ApiResponse<{ logs: MonitorLog[] }>> {
    const response = await apiClient.get('/monitor/logs')
    return response.data
  }

  /**
   * Testa il monitoraggio forzando un'analisi
   */
  static async testMonitor(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/monitor/test')
    return response.data
  }

  /**
   * Pulisce i log del monitoraggio
   */
  static async clearLogs(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/monitor/clear-logs')
    return response.data
  }
}

export default MonitorPrestazioniService
