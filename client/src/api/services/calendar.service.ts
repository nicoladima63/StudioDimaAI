// src/api/services/calendar.service.ts
import { apiClient } from '../client';
import { triggerModeWarning } from '@/lib//utils';

// Calendars API
export async function getCalendars() {
  const response = await apiClient.get('/api/calendar/list');
  return response.data;
}

export async function getAppointments(month: number, year: number, signal?: AbortSignal) {
  const response = await apiClient.get('/api/calendar/appointments', {
    params: { month, year },
    signal,
  });
  return response.data;
}

export async function getCalendarEvents(calendarId: string, start: string, end: string) {
  const response = await apiClient.get('/api/calendar/events', {
    params: { calendarId, start, end },
  });
  return response.data;
}

export async function syncAppointments(calendarId: string, start: string, end: string) {
  const response = await apiClient.post('/api/calendar/sync', {
    calendarId,
    start,
    end,
  });
  return response.data;
}

export async function clearCalendar(calendarId: string) {
  const response = await apiClient.post('/api/calendar/clear', { calendarId });
  return response.data;
}

export async function getClearStatus(jobId: string) {
  const response = await apiClient.get('/api/calendar/clear_status', {
    params: { job_id: jobId },
  });
  return response.data;
}

export async function startSync(calendarId: string, month: number, year: number) {
  const response = await apiClient.post('/api/calendar/sync', {
    calendarId,
    month,
    year,
  });
  return response.data;
}

export async function getSyncStatus(jobId: string) {
  const response = await apiClient.get('/api/calendar/sync_status', {
    params: { job_id: jobId },
  });
  return response.data;
}

export async function getReauthUrl() {
  const response = await apiClient.get('/api/calendar/reauth-url');
  return response.data;
}

// Funzioni aggiuntive dal vecchio apiClient
export async function syncAppointmentsToCalendar(calendarId: string, start: Date, end: Date) {
  const response = await apiClient.post('/api/calendar/sync', {
    calendarId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });
  return response.data;
}

export async function clearCalendarEvents(calendarId: string) {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const response = await apiClient.delete(`/api/calendar/clear/${encodedCalendarId}`, {
    timeout: 300000, // 5 minuti di timeout per gestire calendari molto grandi
  });
  return response.data;
}

export async function getAppointmentsWithModeWarning(month: number, year: number) {
  const response = await apiClient.get('/api/calendar/appointments', { 
    params: { month, year } 
  });
  
  // Se il backend ha cambiato modalità, mostra il warning globale
  if (response.data.mode_changed && response.data.mode_warning) {
    triggerModeWarning(response.data.mode_warning);
  }
  
  return {
    appointments: response.data.appointments,
    modeChanged: response.data.mode_changed || false,
    modeWarning: response.data.mode_warning || null
  };
}

export async function getAppuntamentiStats() {
  const response = await apiClient.get('/api/appuntamenti/statistiche');
  return response.data;
}

export async function getPrimeVisiteStats() {
  const response = await apiClient.get('/api/appuntamenti/prime-visite');
  return response.data;
}

export async function getAppuntamentiPerAnno() {
  const response = await apiClient.get('/api/calendar/appointments/year');
  console.log("📊 Risposta ricevuta:", response.data);
  return response.data;
}

export async function getAppointmentsByRange(start: string, end: string): Promise<number> {
  const response = await apiClient.get('/api/calendar/appointments_by_range', {
    params: { start, end }
  });
  
  if (response.data && response.data.success) {
    return response.data.count;
  }
  
  throw new Error('Errore nel recupero appuntamenti per intervallo');
}