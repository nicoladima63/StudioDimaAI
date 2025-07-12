import apiClient from '../apiClient';

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
