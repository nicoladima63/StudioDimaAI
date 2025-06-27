// src/pages/CalendarPage.tsx
import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
  CFormInput,
  CButton,
  CRow,
  CCol
} from '@coreui/react';
import { format } from 'date-fns';
import {
  getCalendars,
  syncAppointmentsToCalendar,
  clearCalendarEvents
} from '@/api/apiClient';

const CalendarPage: React.FC = () => {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    getCalendars()
      .then((data) => setCalendars(data))
      .catch((err) => console.error('Errore caricamento calendari', err));
  }, []);

  const handleSync = async () => {
    if (!selectedCalendar || !startDate || !endDate) return;
    try {
      await syncAppointmentsToCalendar(selectedCalendar, startDate, endDate);
      alert('✅ Sincronizzazione completata');
    } catch (err) {
      alert('❌ Errore durante la sincronizzazione');
    }
  };

  const handleClear = async () => {
    if (!selectedCalendar) return;
    try {
      await clearCalendarEvents(selectedCalendar);
      alert('✅ Eventi cancellati');
    } catch (err) {
      alert('❌ Errore durante la cancellazione');
    }
  };

  return (
    <CRow className="mt-4">
      <CCol md={8} className="mx-auto">
        <CCard>
          <CCardHeader className="fw-bold">Gestione Google Calendar</CCardHeader>
          <CCardBody className="space-y-4">
            <div>
              <label className="form-label">Seleziona Calendario</label>
              <CFormSelect
                value={selectedCalendar}
                onChange={(e) => setSelectedCalendar(e.target.value)}
              >
                <option value="">-- Seleziona --</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}
                  </option>
                ))}
              </CFormSelect>
            </div>

            <CRow className="gap-3">
              <CCol>
                <label className="form-label">Data Inizio</label>
                <CFormInput type="date"
                  value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                />                
                {startDate && <p className="text-muted small">{format(startDate, 'PPP')}</p>}
              </CCol>
              <CCol>
                <label className="form-label">Data Fine</label>
                <CFormInput type="date"
                  value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                />                
                {endDate && <p className="text-muted small">{format(endDate, 'PPP')}</p>}
              </CCol>
            </CRow>

            <div className="d-flex gap-3 mt-4">
              <CButton
                color="primary"
                onClick={handleSync}
                disabled={!selectedCalendar || !startDate || !endDate}
              >
                Sincronizza appuntamenti
              </CButton>
              <CButton
                color="danger"
                variant="outline"
                onClick={handleClear}
                disabled={!selectedCalendar}
              >
                Azzera calendario selezionato
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default CalendarPage;
