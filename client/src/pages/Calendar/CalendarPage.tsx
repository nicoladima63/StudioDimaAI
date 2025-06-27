import React, { useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
  CFormInput,
  CButton,
  CRow,
  CCol,
  CSpinner
} from '@coreui/react';
import { format } from 'date-fns';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  getCalendars,
  syncAppointmentsToCalendar,
  clearCalendarEvents
} from '@/api/apiClient';
import type { Calendar } from '../../types';
import { useAuthStore } from '@/store/authStore';

const CalendarPage: React.FC = () => {
  // Stati del componente
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Stati di caricamento
  const [isLoadingSync, setIsLoadingSync] = useState<boolean>(false);
  const [isLoadingClear, setIsLoadingClear] = useState<boolean>(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);

  // Recupero dati dallo store di autenticazione
  const { username, token } = useAuthStore();

  // Funzione per caricare i calendari manualmente
  const handleFetchCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const data: Calendar[] = await getCalendars();
      setCalendars(data);
      toast.success('Calendari caricati con successo!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore caricamento calendari', err);
      toast.error(`Errore caricamento calendari: ${errorMessage}`);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  // Funzioni per sincronizzazione e pulizia (invariate)
  const handleSync = async () => {
    if (!selectedCalendar || !startDate || !endDate) return;
    setIsLoadingSync(true);
    try {
      await syncAppointmentsToCalendar(selectedCalendar, startDate, endDate);
      toast.success('✅ Sincronizzazione completata!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore durante la sincronizzazione', err);
      toast.error(`❌ Errore durante la sincronizzazione: ${errorMessage}`);
    } finally {
      setIsLoadingSync(false);
    }
  };

  const handleClear = async () => {
    if (!selectedCalendar) return;
    setIsLoadingClear(true);
    try {
      await clearCalendarEvents(selectedCalendar);
      toast.success('✅ Eventi cancellati dal calendario selezionato!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore durante la cancellazione', err);
      toast.error(`❌ Errore durante la cancellazione: ${errorMessage}`);
    } finally {
      setIsLoadingClear(false);
    }
  };

  return (
    <>
      <CRow className="mt-4">
        <CCol md={8} className="mx-auto">
          {/* Card di Debug */}
          <CCard className="mb-4">
            <CCardHeader className="fw-bold">Debug Info</CCardHeader>
            <CCardBody>
              <p><strong>Username:</strong> {username || 'Non autenticato'}</p>
              <p style={{ wordBreak: 'break-all' }}><strong>Token:</strong> {token || 'Nessun token'}</p>
            </CCardBody>
          </CCard>

          {/* Card di Gestione Calendario */}
          <CCard>
            <CCardHeader className="fw-bold">Gestione Google Calendar</CCardHeader>
            <CCardBody className="space-y-4">
              {/* Pulsante per caricamento manuale */}
              <CButton
                color="info"
                onClick={handleFetchCalendars}
                disabled={isLoadingCalendars}
                className="mb-3"
              >
                {isLoadingCalendars ? <CSpinner size="sm" className="me-1" /> : null}
                Carica Calendari
              </CButton>

              {/* Indicatore di caricamento */}
              {isLoadingCalendars && (
                 <div className="text-center py-4">
                  <CSpinner color="primary" />
                  <p className="mt-2">Caricamento calendari...</p>
                </div>
              )}

              {/* Contenuto principale (mostrato solo se i calendari sono stati caricati) */}
              {calendars.length > 0 && !isLoadingCalendars && (
                <>
                  <div>
                    <label className="form-label">Seleziona Calendario</label>
                    <CFormSelect
                      value={selectedCalendar}
                      onChange={(e) => setSelectedCalendar(e.target.value)}
                    >
                      <option value="">-- Seleziona --</option>
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
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
                        value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setEndDate(new Date(e.target.value))}
                      />
                      {endDate && <p className="text-muted small">{format(endDate, 'PPP')}</p>}
                    </CCol>
                  </CRow>

                  <div className="d-flex gap-3 mt-4">
                    <CButton
                      color="primary"
                      onClick={handleSync}
                      disabled={!selectedCalendar || !startDate || !endDate || isLoadingSync}
                    >
                      {isLoadingSync && <CSpinner size="sm" className="me-1" />}
                      Sincronizza appuntamenti
                    </CButton>
                    <CButton
                      color="danger"
                      variant="outline"
                      onClick={handleClear}
                      disabled={!selectedCalendar || isLoadingClear}
                    >
                      {isLoadingClear && <CSpinner size="sm" className="me-1" />}
                      Azzera calendario selezionato
                    </CButton>
                  </div>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </>
  );
};

export default CalendarPage;
