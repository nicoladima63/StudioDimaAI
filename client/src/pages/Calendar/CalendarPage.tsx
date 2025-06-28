import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
  CButton,
  CRow,
  CCol,
  CSpinner,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CAlert
} from '@coreui/react';
import { format } from 'date-fns';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  getCalendars,
  clearCalendarEvents
} from '@/api/apiClient';
import apiClient from '@/api/apiClient';
import type { Calendar } from '../../types';

const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

// Definizione tipo per gli appuntamenti
interface Appointment {
  DATA: string;
  ORA_INIZIO: number;
  ORA_FINE: number;
  TIPO: string;
  STUDIO: number;
  NOTE: string;
  DESCRIZIONE: string;
  PAZIENTE: string;
}

const CalendarPage: React.FC = () => {
  // Stati del componente
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-based
  const [isLoadingClear, setIsLoadingClear] = useState<boolean>(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);
  const [showModal, setShowModal] = useState(false);
  const [showCalendarWarning, setShowCalendarWarning] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [clearJobId, setClearJobId] = useState<string | null>(null);
  const [clearProgress, setClearProgress] = useState(0);
  const [clearDeleted, setClearDeleted] = useState(0);
  const [clearTotal, setClearTotal] = useState(0);
  const [clearStatus, setClearStatus] = useState<'idle' | 'in_progress' | 'completed' | 'error'>('idle');
  const [clearError, setClearError] = useState<string | null>(null);
  const clearPollingRef = React.useRef<number | null>(null);
  const currentYear = new Date().getFullYear();

  // Stati per la preview degli appuntamenti
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewStats, setPreviewStats] = useState<{
    total: number;
    studioBlu: number;
    studioGiallo: number;
    nonSincronizzabili: number;
  } | null>(null);

  // Stati per la modal di sincronizzazione in corso
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncModalMessage, setSyncModalMessage] = useState('');

  // Stati per la sincronizzazione asincrona
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSynced, setSyncSynced] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'in_progress' | 'completed' | 'error'>('idle');
  const syncPollingRef = React.useRef<number | null>(null);

  // Funzione per caricare i calendari
  const fetchCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const data: Calendar[] = await getCalendars();
      setCalendars(data);
      if (data.length === 0) {
        toast.info('Nessun calendario trovato.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore caricamento calendari', err);
      toast.error(`Errore caricamento calendari: ${errorMessage}`);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  // Funzione per caricare preview degli appuntamenti
  const handleLoadAppointments = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await apiClient.get('/api/calendar/appointments', {
        params: { month: selectedMonth + 1, year: currentYear }
      });
      const appointments: Appointment[] = response.data.appointments || [];
      
      // Calcola statistiche
      const stats = {
        total: appointments.length,
        studioBlu: appointments.filter((app: Appointment) => app.STUDIO === 1).length,
        studioGiallo: appointments.filter((app: Appointment) => app.STUDIO === 2).length,
        nonSincronizzabili: appointments.filter((app: Appointment) => !app.STUDIO || ![1, 2].includes(app.STUDIO)).length
      };
      
      setPreviewStats(stats);
      toast.success(`✅ Caricati ${stats.total} appuntamenti per ${MONTHS[selectedMonth]} ${currentYear}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore caricamento appuntamenti', err);
      toast.error(`❌ Errore caricamento appuntamenti: ${errorMessage}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Funzione per sincronizzazione e pulizia
  const handleSync = async () => {
    if (!previewStats) return;
    
    // Apri subito la modal di sincronizzazione
    setSyncModalMessage(`Sincronizzazione in corso per il calendario '${selectedCalendar}'...`);
    setShowSyncModal(true);
    setSyncStatus('in_progress');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);

    try {
      // Avvia la sincronizzazione asincrona
      const response = await apiClient.post('/api/calendar/sync', {
        month: selectedMonth + 1,
        year: currentYear
      });

      const { job_id } = response.data;
      
      // Inizia il polling per monitorare il progresso
      const pollSyncStatus = async () => {
        try {
          const statusResponse = await apiClient.get('/api/calendar/sync_status', {
            params: { job_id }
          });
          
          const { status, progress, synced, total, message, error } = statusResponse.data;
          
          setSyncProgress(progress || 0);
          setSyncSynced(synced || 0);
          setSyncTotal(total || 0);
          
          if (message) {
            setSyncModalMessage(message);
          }
          
          if (status === 'completed') {
            setSyncStatus('completed');
            // Chiudi automaticamente la modal dopo 2 secondi
            setTimeout(() => {
              setShowSyncModal(false);
              setSyncStatus('idle');
            }, 2000);
            return;
          } else if (status === 'error') {
            setSyncStatus('error');
            setSyncModalMessage(`Errore: ${error || 'Errore sconosciuto'}`);
            return;
          }
          
          // Continua il polling
          syncPollingRef.current = window.setTimeout(pollSyncStatus, 1000);
        } catch (err) {
          setSyncStatus('error');
          setSyncModalMessage('Errore durante il monitoraggio della sincronizzazione');
        }
      };
      
      // Avvia il polling
      pollSyncStatus();
      
    } catch (err) {
      setSyncStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setSyncModalMessage(`Errore durante la sincronizzazione: ${errorMessage}`);
    }
  };

  // Funzione per cancellazione asincrona
  const handleClear = async () => {
    if (!selectedCalendar) {
      setShowCalendarWarning(true);
      return;
    }

    setShowClearConfirmation(true);
  };

  const confirmClear = async () => {
    setShowClearConfirmation(false);
    setClearStatus('in_progress');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);
    setClearError(null);

    try {
      const response = await apiClient.post('/api/calendar/clear', {
        calendarId: selectedCalendar
      });

      const { job_id } = response.data;
      setClearJobId(job_id);

      // Inizia il polling per monitorare il progresso
      const pollClearStatus = async () => {
        try {
          const statusResponse = await apiClient.get('/api/calendar/clear_status', {
            params: { job_id }
          });
          
          const { status, progress, deleted, total, error } = statusResponse.data;
          
          setClearProgress(progress || 0);
          setClearDeleted(deleted || 0);
          setClearTotal(total || 0);
          
          if (status === 'completed') {
            setClearStatus('completed');
            toast.success(`✅ Cancellazione completata! ${deleted} eventi eliminati.`);
            return;
          } else if (status === 'error') {
            setClearStatus('error');
            setClearError(error || 'Errore sconosciuto');
            return;
          }
          
          // Continua il polling
          clearPollingRef.current = window.setTimeout(pollClearStatus, 1000);
        } catch (err) {
          setClearStatus('error');
          setClearError('Errore durante il monitoraggio della cancellazione');
        }
      };
      
      // Avvia il polling
      pollClearStatus();
      
    } catch (err) {
      setClearStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setClearError(errorMessage);
      toast.error(`❌ Errore durante la cancellazione: ${errorMessage}`);
    }
  };

  // Cleanup dei polling quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (syncPollingRef.current) {
        clearTimeout(syncPollingRef.current);
      }
      if (clearPollingRef.current) {
        clearTimeout(clearPollingRef.current);
      }
    };
  }, []);

  const selectedCalendarName = calendars.find(cal => cal.id === selectedCalendar)?.name || selectedCalendar;

  return (
    <div className="calendar-page">
      <ToastContainer />
      
      <CCard>
        <CCardHeader>
          <h4>Gestione Calendario</h4>
        </CCardHeader>
        <CCardBody>
          <CRow>
            <CCol md={6}>
              <div className="mb-3">
                <label className="form-label">Seleziona Calendario</label>
                <CFormSelect
                  value={selectedCalendar}
                  onChange={(e) => setSelectedCalendar(e.target.value)}
                  disabled={isLoadingCalendars}
                >
                  <option value="">Seleziona un calendario...</option>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </CFormSelect>
                <CButton
                  color="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={fetchCalendars}
                  disabled={isLoadingCalendars}
                >
                  {isLoadingCalendars ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Caricamento...
                    </>
                  ) : (
                    'Aggiorna Calendari'
                  )}
                </CButton>
              </div>

              <div className="mb-3">
                <label className="form-label">Seleziona Mese</label>
                <CFormSelect
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {MONTHS.map((month, index) => (
                    <option key={index} value={index}>
                      {month} {currentYear}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CButton
                  color="primary"
                  onClick={handleLoadAppointments}
                  disabled={isLoadingPreview}
                  className="me-2"
                >
                  {isLoadingPreview ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Caricamento...
                    </>
                  ) : (
                    'Carica Appuntamenti'
                  )}
                </CButton>
              </div>

              {previewStats && (
                <div className="mb-3">
                  <CAlert color="info">
                    <strong>Preview Appuntamenti:</strong><br />
                    Totale: {previewStats.total}<br />
                    Studio Blu: {previewStats.studioBlu}<br />
                    Studio Giallo: {previewStats.studioGiallo}<br />
                    {previewStats.nonSincronizzabili > 0 && (
                      <span className="text-warning">
                        Non sincronizzabili: {previewStats.nonSincronizzabili}
                      </span>
                    )}
                  </CAlert>

                  {previewStats.total > 0 && (
                    <CButton
                      color="success"
                      onClick={handleSync}
                      disabled={syncStatus === 'in_progress'}
                      className="me-2"
                    >
                      {syncStatus === 'in_progress' ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Sincronizzazione...
                        </>
                      ) : (
                        'Sincronizza'
                      )}
                    </CButton>
                  )}
                </div>
              )}
            </CCol>

            <CCol md={6}>
              <div className="mb-3">
                <h5>Operazioni Avanzate</h5>
                <CButton
                  color="danger"
                  onClick={handleClear}
                  disabled={clearStatus === 'in_progress' || !selectedCalendar}
                  className="me-2"
                >
                  {clearStatus === 'in_progress' ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Cancellazione...
                    </>
                  ) : (
                    'Cancella Tutti gli Eventi'
                  )}
                </CButton>
              </div>

              {clearStatus === 'in_progress' && (
                <div className="mb-3">
                  <CAlert color="warning">
                    <strong>Cancellazione in corso...</strong><br />
                    Progresso: {clearProgress}%<br />
                    Eliminati: {clearDeleted} / {clearTotal}
                  </CAlert>
                </div>
              )}

              {clearStatus === 'completed' && (
                <div className="mb-3">
                  <CAlert color="success">
                    <strong>Cancellazione completata!</strong><br />
                    {clearDeleted} eventi eliminati con successo.
                  </CAlert>
                </div>
              )}

              {clearStatus === 'error' && (
                <div className="mb-3">
                  <CAlert color="danger">
                    <strong>Errore durante la cancellazione:</strong><br />
                    {clearError}
                  </CAlert>
                </div>
              )}
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Modal di conferma cancellazione */}
      <CModal
        visible={showClearConfirmation}
        onClose={() => setShowClearConfirmation(false)}
      >
        <CModalHeader>
          <h5>Conferma Cancellazione</h5>
        </CModalHeader>
        <CModalBody>
          <p>
            Sei sicuro di voler cancellare <strong>TUTTI</strong> gli eventi dal calendario{' '}
            <strong>"{selectedCalendarName}"</strong>?
          </p>
          <p className="text-danger">
            <strong>ATTENZIONE:</strong> Questa operazione non può essere annullata!
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowClearConfirmation(false)}
          >
            Annulla
          </CButton>
          <CButton
            color="danger"
            onClick={confirmClear}
          >
            Conferma Cancellazione
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal di avviso calendario non selezionato */}
      <CModal
        visible={showCalendarWarning}
        onClose={() => setShowCalendarWarning(false)}
      >
        <CModalHeader>
          <h5>Calendario Non Selezionato</h5>
        </CModalHeader>
        <CModalBody>
          <p>Devi selezionare un calendario prima di procedere con la cancellazione.</p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="primary"
            onClick={() => setShowCalendarWarning(false)}
          >
            OK
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal di sincronizzazione in corso */}
      <CModal
        visible={showSyncModal}
        onClose={() => syncStatus === 'error' ? setShowSyncModal(false) : null}
        backdrop={syncStatus === 'error' ? "static" : "static"}
      >
        <CModalHeader>
          <h5>{syncStatus === 'error' ? 'Risultato Sincronizzazione' : 'Sincronizzazione in corso'}</h5>
        </CModalHeader>
        <CModalBody>
          <CAlert color={syncStatus === 'error' ? 'warning' : 'info'}>
            {syncStatus !== 'error' && (
              <div className="d-flex align-items-center">
                <CSpinner size="sm" className="me-2" />
                <span>{syncModalMessage}</span>
              </div>
            )}
            {syncStatus === 'error' && (
              <div>
                <span>{syncModalMessage}</span>
              </div>
            )}
            {syncStatus === 'in_progress' && syncTotal > 0 && (
              <div className="mt-2">
                <div className="progress">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${syncProgress}%` }}
                  ></div>
                </div>
                <small className="text-muted">
                  Progresso: {syncProgress}% ({syncSynced}/{syncTotal})
                </small>
              </div>
            )}
          </CAlert>
        </CModalBody>
        {syncStatus === 'error' && (
          <CModalFooter>
            <CButton
              color="primary"
              onClick={() => setShowSyncModal(false)}
            >
              Chiudi
            </CButton>
          </CModalFooter>
        )}
      </CModal>
    </div>
  );
};

export default CalendarPage;
