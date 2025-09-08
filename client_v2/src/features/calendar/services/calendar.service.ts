import apiClient from '@/services/api/client';

export interface Calendar {
  id: string;
  name: string;
  primary?: boolean;
}

export interface Appointment {
  DATA: string;
  ORA_INIZIO: number | string;
  ORA_FINE: number | string;
  TIPO: string;
  STUDIO: number;
  NOTE: string;
  DESCRIZIONE: string;
  PAZIENTE: string;
}

export interface AppointmentStats {
  month: number;
  count: number;
  success?: boolean;
}

export interface SyncJob {
  job_id: string;
  status: 'in_progress' | 'completed' | 'error' | 'cancelled';
  progress: number;
  synced: number;
  total: number;
  message: string;
  error?: string;
}

export interface ClearJob {
  job_id: string;
  status: 'in_progress' | 'completed' | 'error' | 'cancelled';
  progress: number;
  deleted: number;
  total: number;
  message: string;
  error?: string;
  calendar_id: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  state?: 'success' | 'warning' | 'error';
}

const calendar = {
  // Get all calendars
  apiGetCalendars: async (): Promise<ApiResponse<{ calendars: Calendar[]; auth_url?: string }>> => {
    try {
      const response = await apiClient.get('/calendar/list');
      return response.data;
    } catch (error: any) {
      // Handle OAuth authentication errors
      const errorResponse = error.response?.data;
      if (errorResponse?.error === 'GLOBAL_GOOGLE_AUTH_REQUIRED' || errorResponse?.error === 'GOOGLE_AUTH_REQUIRED') {
        return {
          success: false,
          error: errorResponse.error,
          message: errorResponse.message || 'Autenticazione Google richiesta',
          data: errorResponse.data || {}, // Contains auth_url
          state: 'error'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || 'Errore caricamento calendari',
        message: error.response?.data?.message,
        state: 'error'
      };
    }
  },

  // Get appointments for specific month/year
  apiGetAppointments: async (month: number, year: number): Promise<{ appointments: Appointment[] }> => {
    try {
      const response = await apiClient.get('/calendar/appointments', {
        params: { month, year }
      });
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore caricamento appuntamenti',
        error: error.response?.data?.error || 'APPOINTMENTS_ERROR'
      };
    }
  },

  // Start sync process
  apiStartSync: async (
    calendarId: string,
    month: number,
    year: number,
    studioId: number,
    endMonth?: number,
    endYear?: number
  ): Promise<{ job_id: string }> => {
    try {
      const payload: any = {
        calendar_id: calendarId,
        month,
        year,
        studio_id: studioId
      };
      
      // Add end date if provided (for range sync)
      if (endMonth && endYear) {
        payload.end_month = endMonth;
        payload.end_year = endYear;
      }
      
      const response = await apiClient.post('/calendar/sync', payload);
      return response.data.data || response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore avvio sincronizzazione',
        error: error.response?.data?.error || 'SYNC_START_ERROR'
      };
    }
  },

  // Get sync status
  apiGetSyncStatus: async (jobId: string): Promise<SyncJob> => {
    try {
      const response = await apiClient.get('/calendar/sync-status', {
        params: { jobId }
      });
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore stato sincronizzazione',
        error: error.response?.data?.error || 'SYNC_STATUS_ERROR'
      };
    }
  },

  // Cancel sync job
  apiCancelSync: async (jobId: string): Promise<ApiResponse<void>> => {
    try {
      const response = await apiClient.post('/calendar/sync/cancel', { job_id: jobId });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore cancellazione sincronizzazione',
        message: error.response?.data?.message,
        state: 'error'
      };
    }
  },

  // Clear calendar
  apiClearCalendar: async (calendarId: string): Promise<ApiResponse<{ job_id: string }>> => {
    try {
      const encodedCalendarId = encodeURIComponent(calendarId);
      const response = await apiClient.delete(`/calendar/clear/${encodedCalendarId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw {
          message: error.response.data.message,
          error: true
        };
      }
      throw {
        message: "Impossibile contattare il server. Verifica la tua connessione e riprova.",
        error: true
      };
    }
  },

  apiGetClearStatus: async (jobId: string): Promise<ClearJob> => {
    try {
      const response = await apiClient.get(`/calendar/clear-status?jobId=${jobId}`);
      return response.data;
    } catch (error: any) {
      throw {
        message: 'Errore durante il recupero dello stato di cancellazione',
        error: true
      };
    }
  },

  apiCancelClear: async (jobId: string): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await apiClient.post('/calendar/clear/cancel', { job_id: jobId });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw {
          message: error.response.data.message,
          error: true
        };
      }
      throw {
        message: 'Errore durante la cancellazione del job',
        error: true
      };
    }
  },

  // Get OAuth URL for Google auth
  apiGetReauthUrl: async (): Promise<ApiResponse<{ auth_url: string }>> => {
    try {
      const response = await apiClient.get('/calendar/reauth-url');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore generazione URL autorizzazione',
        message: error.response?.data?.message,
        state: 'error'
      };
    }
  },

  // Statistics methods (matching V1 interface)
  apiGetAppuntamentiStats: async () => {
    try {
      const response = await apiClient.get('/calendar/stats/summary');
      const data = response.data.data;
      if (!data) return { meseCorrente: 0, mesePrecedente: 0, meseProssimo: 0, crescita: 0 };
      
      // Calculate growth percentage
      const crescita = data.mese_precedente > 0 
        ? ((data.mese_corrente - data.mese_precedente) / data.mese_precedente) * 100
        : 0;

      return {
        meseCorrente: data.mese_corrente,
        mesePrecedente: data.mese_precedente,
        meseProssimo: data.mese_prossimo,
        crescita: Math.round(crescita)
      };
    } catch (error: any) {
      return { meseCorrente: 0, mesePrecedente: 0, meseProssimo: 0, crescita: 0 };
    }
  },

  apiGetPrimeVisiteStats: async () => {
    try {
      const response = await apiClient.get('/calendar/stats/first-visits');
      return response.data.data?.nuove_visite || 0;
    } catch (error: any) {
      return 0;
    }
  },

  apiGetAppuntamentiPerAnno: async () => {
    try {
      const response = await apiClient.get('/calendar/stats/year');
      return response.data.data;
    } catch (error: any) {
      return {};
    }
  },

  apiGetAppuntamentiTotali: async () => {
    try {
      const response = await apiClient.get('/calendar/stats/year');
      const data = response.data.data;
      const anni = Object.keys(data).sort();
      
      return anni.map(anno => {
        const totaleAnno = data[anno].reduce((acc: number, mese: AppointmentStats) => acc + mese.count, 0);
        const progressivo = data[anno]
          .slice(0, new Date().getMonth() + 1)
          .reduce((acc: number, mese: AppointmentStats) => acc + mese.count, 0);
        
        return {
          anno,
          totale: totaleAnno,
          progressivo,
          colore: anno === '2025' ? '#3399ff' : anno === '2024' ? '#8884d8' : '#b0b0b0'
        };
      });
    } catch (error: any) {
      return [];
    }
  },

  // Test connection
  apiTestConnection: async (): Promise<ApiResponse<void>> => {
    try {
      const response = await apiClient.get('/calendar/test-connection');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore test connessione',
        message: error.response?.data?.message,
        state: 'error'
      };
    }
  }
};

export default calendar;

// Export all methods individually for convenience (matching V1 interface)
export const {
  apiGetCalendars,
  apiGetAppointments,
  apiStartSync,
  apiGetSyncStatus,
  apiCancelSync,
  apiClearCalendar,
  apiGetClearStatus,
  apiCancelClear,
  apiGetReauthUrl,
  apiGetAppuntamentiStats,
  apiGetPrimeVisiteStats,
  apiGetAppuntamentiPerAnno,
  apiGetAppuntamentiTotali,
  apiTestConnection
} = calendar;