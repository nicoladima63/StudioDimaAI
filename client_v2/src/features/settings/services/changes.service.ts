import apiClient from '@/services/api/client';

// Tipi per il sistema di tracciamento cambiamenti
export interface AppointmentChange {
  timestamp: string;
  change_type: 'new' | 'deleted' | 'modified' | 'moved';
  appointment_id: string;
  studio: number;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
  old_data?: any;
  new_data?: any;
  details?: string;
}

export interface ChangesSummary {
  total_changes: number;
  new_appointments: number;
  deleted_appointments: number;
  modified_appointments: number;
  moved_appointments: number;
  by_studio: Record<string, number>;
  by_date: Record<string, number>;
  recent_changes: AppointmentChange[];
}

export interface ChangesForDate {
  date: string;
  changes: AppointmentChange[];
  count: number;
}

export interface ChangesStats {
  total_changes: number;
  total_appointments: number;
  last_30_days: ChangesSummary;
  by_studio: Record<string, {
    total: number;
    new: number;
    deleted: number;
    modified: number;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ChangesService {
  private baseUrl = '/monitoring/changes';

  /**
   * Ottiene riepilogo dei cambiamenti per un periodo
   */
  async getChangesSummary(dateFrom?: string, dateTo?: string, days?: number): Promise<ApiResponse<ChangesSummary>> {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (days) params.append('days', days.toString());

      const queryString = params.toString();
      const url = queryString ? `${this.baseUrl}/summary?${queryString}` : `${this.baseUrl}/summary`;
      
      const response = await apiClient.get(url);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero del riepilogo',
        error: error.message
      };
    }
  }

  /**
   * Ottiene tutti i cambiamenti di oggi
   */
  async getTodayChanges(): Promise<ApiResponse<ChangesForDate>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/today`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dei cambiamenti di oggi',
        error: error.message
      };
    }
  }

  /**
   * Ottiene tutti i cambiamenti per una data specifica
   */
  async getChangesForDate(date: string): Promise<ApiResponse<ChangesForDate>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/date/${date}`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dei cambiamenti per la data',
        error: error.message
      };
    }
  }

  /**
   * Ottiene i cambiamenti più recenti
   */
  async getRecentChanges(limit: number = 20): Promise<ApiResponse<{ changes: AppointmentChange[], count: number, limit: number }>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/recent?limit=${limit}`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero dei cambiamenti recenti',
        error: error.message
      };
    }
  }

  /**
   * Ottiene statistiche sui cambiamenti
   */
  async getChangesStats(): Promise<ApiResponse<ChangesStats>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`);
      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nel recupero delle statistiche',
        error: error.message
      };
    }
  }

  /**
   * Cancella tutti i log dei cambiamenti
   */
  async clearChanges(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/clear`);
      return {
        success: response.data.success,
        message: response.data.message || 'Log cancellati con successo'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Errore nella cancellazione dei log',
        error: error.message
      };
    }
  }
}

export const changesService = new ChangesService();
