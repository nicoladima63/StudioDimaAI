// src/api/services/calendar.service.ts
import apiClient from '@/api/client';
import { triggerModeWarning } from '@/lib/utils';

interface AppointmentStats {
  month: number;
  count: number;
  success?: boolean;
}

export const CalendarService = {
  async getCalendars() {
    const response = await apiClient.get('/api/calendar/list');
    return response.data;
  },

  async getAppointments(month: number, year: number) {
    const response = await apiClient.get('/api/calendar/appointments', {
      params: { month, year }
    });
    return response.data;
  },

  async startSync(calendarId: string, month: number, year: number, studioId: number) {
    const response = await apiClient.post('/api/calendar/sync', {
      calendar_id: calendarId,
      month,
      year,
      studio_id: studioId
    });
    return response.data;
  },

  async getSyncStatus(jobId: string) {
    const response = await apiClient.get('/api/calendar/sync-status', {
      params: { jobId }
    });
    return response.data;
  },

  async clearCalendar(calendarId: string) {
    try {
      const encodedCalendarId = encodeURIComponent(calendarId);
      const response = await apiClient.delete(`/api/calendar/clear/${encodedCalendarId}`);
      return response.data;
    } catch (error: unknown) {
      // Gestione migliorata degli errori
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          // Propaga l'errore con il messaggio dal server
          const errorObj = {
            message: axiosError.response.data.message,
            error: true,
            deleted_count: 0
          };
          throw errorObj;
        }
      }
      // Per errori di rete o altri errori non previsti
      throw {
        message: "Impossibile contattare il server. Verifica la tua connessione e riprova.",
        error: true,
        deleted_count: 0
      };
    }
  },
  
  async getClearStatus(jobId: string) {
    const response = await apiClient.get('/api/calendar/clear-status', {
      params: { jobId }
    });
    return response.data;
  },

  async getReauthUrl() {
    const response = await apiClient.get('/api/calendar/reauth-url');
    return response.data;
  },

  async cancelSyncJob(jobId: string) {
    const response = await apiClient.post('/api/calendar/sync/cancel', { job_id: jobId });
    return response.data;
  },

  // Metodi statistiche
  async getAppuntamentiStats() {
    const response = await apiClient.get('/api/calendar/stats/summary');
    const data = response.data.data;
    if (!data) return { meseCorrente: 0, mesePrecedente: 0, meseProssimo: 0, crescita: 0 };
    
    // Calcola la crescita percentuale
    const crescita = data.mese_precedente > 0 
      ? ((data.mese_corrente - data.mese_precedente) / data.mese_precedente) * 100
      : 0;

    return {
      meseCorrente: data.mese_corrente,
      mesePrecedente: data.mese_precedente,
      meseProssimo: data.mese_prossimo,
      crescita: Math.round(crescita)
    };
  },

  async getPrimeVisiteStats() {
    const response = await apiClient.get('/api/calendar/stats/first-visits');
    return response.data.data?.nuove_visite || 0;
  },

  async getAppuntamentiPerAnno() {
    const response = await apiClient.get('/api/calendar/stats/year');
    // Restituisce direttamente l'oggetto data che contiene già gli anni come chiavi
    return response.data.data;
  },

  async getAppuntamentiTotali() {
    const response = await apiClient.get('/api/calendar/stats/year');
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
  },

  async getAppointmentsByRange(start: string, end: string) {
    const response = await apiClient.get('/api/calendar/stats/range', {
      params: { start, end }
    });
    return response.data;
  },

  async getAppointmentsWithModeWarning(month: number, year: number) {
    const response = await apiClient.get('/api/calendar/appointments', {
      params: { month, year }
    });
    if (response.data && response.data.warning) {
      triggerModeWarning(response.data.warning);
    }
    return response.data;
  },

  async startClearAll() {
    const response = await apiClient.post('/api/calendar/clear-all/start');
    return response.data;
  },

  async getClearAllStatus(jobId: string) {
    const response = await apiClient.get(`/api/calendar/clear-all/status/${jobId}`);
    return response.data;
  },

  async cancelClearAll(jobId: string) {
    const response = await apiClient.post('/api/calendar/clear-all/cancel', { job_id: jobId });
    return response.data;
  }
};

// Esporta tutti i metodi individualmente
export const {
  getCalendars,
  getAppointments,
  startSync,
  getSyncStatus,
  clearCalendar,
  getClearStatus,
  getReauthUrl,
  cancelSyncJob,
  getAppuntamentiStats,
  getPrimeVisiteStats,
  getAppuntamentiPerAnno,
  getAppuntamentiTotali,
  getAppointmentsByRange,
  getAppointmentsWithModeWarning,
  startClearAll,
  getClearAllStatus,
  cancelClearAll
} = CalendarService;