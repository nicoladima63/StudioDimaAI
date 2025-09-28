import apiClient from './client'
import type { ApiResponse } from '@/types'

export interface MonitorConfig {
  monitor_id: string;
  table_name: string;
  file_path: string;
  monitor_type: string;
  interval_seconds: number;
  enabled: boolean;
  auto_start: boolean;
  metadata: any;
}

export interface MonitorStatus {
  monitor_id: string;
  status: 'stopped' | 'running' | 'paused' | 'error';
  table_name: string;
  config: MonitorConfig;
  last_check: string | null;
  last_change: string | null;
  change_count: number;
  error_count: number;
  created_at: string;
  started_at: string | null;
  // Riepilogo regole esposto dal backend
  rules_summary?: {
    active_rules: number;
    example_actions: string[];
  };
}

export interface MonitorSummary {
  total_monitors: number;
  active_monitors: number;
  monitors: { [key: string]: MonitorStatus };
}

export interface MonitorLog {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface CreateMonitorPayload {
  table_name: string;
  monitor_type: string;
  auto_start: boolean;
}

export class MonitorPrestazioniService {
  /**
   * Crea un nuovo monitor
   */
  static async createMonitor(payload: CreateMonitorPayload): Promise<ApiResponse<{ monitor_id: string }>> {
    const response = await apiClient.post('/monitor/monitors', payload);
    return response.data;
  }

  /**
   * Avvia il monitoraggio di un monitor specifico
   */
  static async startMonitor(monitorId: string): Promise<ApiResponse<{ start_time: string; started_at: string }>> {
    const response = await apiClient.post(`/monitor/monitors/${monitorId}/start`);
    return response.data;
  }

  /**
   * Ferma il monitoraggio di un monitor specifico
   */
  static async stopMonitor(monitorId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post(`/monitor/monitors/${monitorId}/stop`);
    return response.data;
  }

  /**
   * Recupera lo stato del monitoraggio (summary di tutti i monitor)
   */
  static async getStatus(): Promise<ApiResponse<MonitorSummary>> {
    const response = await apiClient.get('/monitor/status');
    return response.data;
  }

  /**
   * Recupera i log del monitoraggio
   */
  static async getLogs(): Promise<ApiResponse<{ logs: MonitorLog[] }>> {
    const response = await apiClient.get('/monitor/logs');
    return response.data;
  }

  /**
   * Testa il monitoraggio forzando un'analisi
   */
  static async testMonitor(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/monitor/test');
    return response.data;
  }

  /**
   * Pulisce i log del monitoraggio
   */
  static async clearLogs(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/monitor/clear-logs');
    return response.data;
  }

  /**
   * Elimina un monitor
   */
  static async deleteMonitor(monitorId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete(`/monitor/monitors/${monitorId}`);
    return response.data;
  }

  /**
   * Recupera la lista delle tabelle monitorabili
   */
  static async getMonitorableTables(): Promise<ApiResponse<{ name: string; description: string }[]>> {
    const response = await apiClient.get('/monitorable-tables');
    return response.data;
  }
}

export default MonitorPrestazioniService
