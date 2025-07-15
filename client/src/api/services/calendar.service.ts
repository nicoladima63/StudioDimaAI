// src/api/services/calendar.service.ts
import { apiClient } from '../client';
import { triggerModeWarning } from '@/lib/utils';

interface AppointmentStats {
  month: number;
  count: number;
  success?: boolean;
}

export const CalendarService = {
  async getCalendars() {
    const response = await apiClient.get('/api/appointments/calendar/list');
    return response.data;
  },

  async getAppointments(month: number, year: number) {
    const response = await apiClient.get('/api/appointments/calendar/appointments', {
      params: { month, year }
    });
    return response.data;
  },

  async startSync(month: number, year: number) {
    const response = await apiClient.post('/api/appointments/calendar/sync', {
      month,
      year
    });
    return response.data;
  },

  async getSyncStatus(jobId: string) {
    const response = await apiClient.get('/api/appointments/calendar/sync-status', {
      params: { jobId }
    });
    return response.data;
  },

  async clearCalendar(calendarId: string) {
    const encodedCalendarId = encodeURIComponent(calendarId);
    const response = await apiClient.delete(`/api/appointments/calendar/clear/${encodedCalendarId}`);
    return response.data;
  },

  async getClearStatus(jobId: string) {
    const response = await apiClient.get('/api/appointments/calendar/clear-status', {
      params: { jobId }
    });
    return response.data;
  },

  async getReauthUrl() {
    const response = await apiClient.get('/api/appointments/calendar/reauth-url');
    return response.data;
  },

  // Metodi statistiche
  async getAppuntamentiStats() {
    const response = await apiClient.get('/api/appointments/stats/summary');
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
    const response = await apiClient.get('/api/appointments/stats/first-visits');
    return response.data.data?.nuove_visite || 0;
  },

  async getAppuntamentiPerAnno() {
    const response = await apiClient.get('/api/appointments/stats/year');
    // Restituisce direttamente l'oggetto data che contiene già gli anni come chiavi
    return response.data.data;
  },

  async getAppuntamentiTotali() {
    const response = await apiClient.get('/api/appointments/stats/year');
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
    const response = await apiClient.get('/api/appointments/stats/range', {
      params: { start, end }
    });
    return response.data;
  },

  async getAppointmentsWithModeWarning(month: number, year: number) {
    const response = await apiClient.get('/api/appointments/calendar/appointments', {
      params: { month, year }
    });
    if (response.data && response.data.warning) {
      triggerModeWarning(response.data.warning);
    }
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
  getAppuntamentiStats,
  getPrimeVisiteStats,
  getAppuntamentiPerAnno,
  getAppuntamentiTotali,
  getAppointmentsByRange,
  getAppointmentsWithModeWarning
} = CalendarService;