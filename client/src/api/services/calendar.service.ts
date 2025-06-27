// Calendars API
export async function getCalendars() {
  const response = await apiClient.get('/api/calendar/list');
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
  const response = await apiClient.delete('/api/calendar/clear', {
    params: { calendarId },
  });
  return response.data;
}
