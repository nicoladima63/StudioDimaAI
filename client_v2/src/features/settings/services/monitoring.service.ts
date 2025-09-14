import apiClient from '@/services/api/client';

// Tipi per il sistema di monitoraggio
export interface MonitorConfig {
  monitor_id: string;
  table_name: string;
  monitor_type: 'periodic_check' | 'real_time' | 'file_watcher';
  interval_seconds: number;
  enabled: boolean;
  auto_start: boolean;
  callback_functions: string[];
  metadata: Record<string, any>;
}

export interface MonitorInstance {
  config: MonitorConfig;
  status: 'stopped' | 'running' | 'paused' | 'error';
  last_check?: string;
  last_change?: string;
  change_count: number;
  error_count: number;
  created_at: string;
}

export interface MonitorStatus {
  total_monitors: number;
  active_monitors: number;
  monitors: Record<string, {
    status: string;
    table_name: string;
    monitor_type: string;
    last_check?: string;
    change_count: number;
  }>;
}

export interface CreateMonitorRequest {
  table_name: string;
  monitor_type: 'periodic_check' | 'real_time' | 'file_watcher';
  interval_seconds: number;
  auto_start: boolean;
  callback_functions?: string[];
  metadata?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class MonitoringService {
  private baseUrl = '/monitoring';

  /**
   * Recupera tutti i monitor configurati
   */
  async getAllMonitors(): Promise<ApiResponse<MonitorInstance[]>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/monitors`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dei monitor',
        error: error.message
      };
    }
  }

  /**
   * Recupera lo status di tutti i monitor
   */
  async getStatus(): Promise<ApiResponse<MonitorStatus>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/status`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dello status',
        error: error.message
      };
    }
  }

  /**
   * Recupera lo status di un monitor specifico
   */
  async getMonitorStatus(monitorId: string): Promise<ApiResponse<MonitorInstance>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/monitors/${monitorId}/status`);
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dello status del monitor',
        error: error.message
      };
    }
  }

  /**
   * Crea un nuovo monitor
   */
  async createMonitor(config: CreateMonitorRequest): Promise<ApiResponse<{ monitor_id: string }>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/monitors`, config);
      return {
        success: true,
        data: response.data,
        message: 'Monitor creato con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella creazione del monitor',
        error: error.message
      };
    }
  }

  /**
   * Avvia un monitor
   */
  async startMonitor(monitorId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/monitors/${monitorId}/start`);
      return {
        success: true,
        message: response.data.message || 'Monitor avviato con successo',
        data: {
          started_at: response.data.started_at
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nell\'avvio del monitor',
        error: error.message
      };
    }
  }

  /**
   * Ferma un monitor
   */
  async stopMonitor(monitorId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/monitors/${monitorId}/stop`);
      return {
        success: true,
        message: 'Monitor fermato con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella fermata del monitor',
        error: error.message
      };
    }
  }

  /**
   * Mette in pausa un monitor
   */
  async pauseMonitor(monitorId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/monitors/${monitorId}/pause`);
      return {
        success: true,
        message: 'Monitor messo in pausa con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella pausa del monitor',
        error: error.message
      };
    }
  }

  /**
   * Riprende un monitor in pausa
   */
  async resumeMonitor(monitorId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/monitors/${monitorId}/resume`);
      return {
        success: true,
        message: 'Monitor ripreso con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella ripresa del monitor',
        error: error.message
      };
    }
  }

  /**
   * Elimina un monitor
   */
  async deleteMonitor(monitorId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/monitors/${monitorId}`);
      return {
        success: true,
        message: 'Monitor eliminato con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nell\'eliminazione del monitor',
        error: error.message
      };
    }
  }

  /**
   * Aggiorna la configurazione di un monitor
   */
  async updateMonitor(monitorId: string, config: Partial<CreateMonitorRequest>): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/monitors/${monitorId}`, config);
      return {
        success: true,
        data: response.data,
        message: 'Monitor aggiornato con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nell\'aggiornamento del monitor',
        error: error.message
      };
    }
  }

  /**
   * Registra una funzione callback
   */
  async registerCallback(name: string, callback: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/callbacks`, {
        name,
        callback
      });
      return {
        success: true,
        message: 'Callback registrato con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella registrazione del callback',
        error: error.message
      };
    }
  }

  /**
   * Recupera i log di un monitor
   */
  async getMonitorLogs(monitorId: string, limit: number = 100): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/monitors/${monitorId}/logs`, {
        params: { limit }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dei log',
        error: error.message
      };
    }
  }

  /**
   * Recupera le metriche di un monitor
   */
  async getMonitorMetrics(monitorId: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/monitors/${monitorId}/metrics`);
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero delle metriche',
        error: error.message
      };
    }
  }
}

export const monitoringService = new MonitoringService();
