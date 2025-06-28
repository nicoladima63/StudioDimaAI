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
    
    // Controlla se è stato selezionato un calendario
    if (!selectedCalendar) {
      setShowCalendarWarning(true);
      return;
    }
    
    // Trova il nome del calendario selezionato
    const selectedCalendarName = calendars.find(cal => cal.id === selectedCalendar)?.name || 'calendario selezionato';
    
    // Apri subito la modal di sincronizzazione
    setSyncModalMessage(`Sincronizzazione in corso per il calendario '${selectedCalendarName}'...`);
    setShowSyncModal(true);
    
    // Reset stati sincronizzazione
    setSyncStatus('in_progress');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);
    
    try {
      // Invia direttamente month e year per evitare problemi di fuso orario
      const response = await apiClient.post('/api/calendar/sync', {
        month: selectedMonth + 1, // Converti da 0-based a 1-based
        year: currentYear
      });
      
      const jobId = response.data.job_id;
      
      // Avvia polling
      syncPollingRef.current = setInterval(() => pollSyncStatus(jobId), 2000);
      
    } catch (error) {
      // Errore durante l'avvio della sincronizzazione - mostra nella modal
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante la sincronizzazione';
      setSyncModalMessage(`Errore durante la sincronizzazione: ${errorMessage}`);
      setSyncStatus('error');
    }
  };

  const handleClear = async () => {
    if (!selectedCalendar) return;
    setShowModal(true);
  };

  const confirmClear = async () => {
    setShowModal(false);
    setIsLoadingClear(true);
    try {
      await clearCalendarEvents(selectedCalendar);
      toast.success('✅ Eventi del mese selezionato cancellati dal calendario!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore durante la cancellazione', err);
      toast.error(`❌ Errore durante la cancellazione: ${errorMessage}`);
    } finally {
      setIsLoadingClear(false);
    }
  };

  // Funzione per mostrare il modal di conferma cancellazione
  const handleClearAllEvents = () => {
    if (!selectedCalendar) {
      setShowClearWarning(true);
      return;
    }
    setShowClearConfirmation(true);
  };

  // Funzione per cancellare tutti gli eventi dal calendario selezionato (con job background)
  const confirmClearAllEvents = async () => {
    setShowClearConfirmation(false);
    setIsLoadingClear(true);
    setClearStatus('in_progress');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);
    setClearError(null);
    setClearJobId(null);
    try {
      const response = await apiClient.post('/api/calendar/clear', { calendarId: selectedCalendar });
      const jobId = response.data.job_id;
      setClearJobId(jobId);
      // Avvia polling
      clearPollingRef.current = setInterval(() => pollClearStatus(jobId), 2000);
    } catch {
      setClearStatus('error');
      setClearError('Errore nell\'avvio della cancellazione!');
      setIsLoadingClear(false);
    }
  };

  // Polling stato cancellazione
  const pollClearStatus = async (jobId: string) => {
    try {
      const res = await apiClient.get(`/api/calendar/clear_status?job_id=${jobId}`);
      const { status, progress, deleted, total, error } = res.data;
      setClearStatus(status);
      setClearProgress(progress || 0);
      setClearDeleted(deleted || 0);
      setClearTotal(total || 0);
      setClearError(error || null);
      if (status === 'completed' || status === 'error') {
        setIsLoadingClear(false);
        if (clearPollingRef.current) clearInterval(clearPollingRef.current);
      }
    } catch {
      setClearStatus('error');
      setClearError('Errore nel polling dello stato!');
      setIsLoadingClear(false);
      if (clearPollingRef.current) clearInterval(clearPollingRef.current);
    }
  };

  // Chiudi modal avanzamento
  const closeClearProgressModal = () => {
    setClearJobId(null);
    setClearStatus('idle');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);
    setClearError(null);
    if (clearPollingRef.current) clearInterval(clearPollingRef.current);
  };

  // Funzione per refresh manuale dei calendari
  const handleRefreshCalendars = () => {
    fetchCalendars();
  };

  // Polling stato sincronizzazione
  const pollSyncStatus = async (jobId: string) => {
    try {
      const res = await apiClient.get(`/api/calendar/sync_status?job_id=${jobId}`);
      const { status, progress, synced, total, message, error } = res.data;
      setSyncStatus(status);
      setSyncProgress(progress || 0);
      setSyncSynced(synced || 0);
      setSyncTotal(total || 0);
      
      if (status === 'completed') {
        setSyncModalMessage(message || 'Sincronizzazione completata con successo!');
        // Chiudi automaticamente la modal dopo 3 secondi
        setTimeout(() => {
          setShowSyncModal(false);
          setSyncStatus('idle');
          setSyncProgress(0);
          setSyncSynced(0);
          setSyncTotal(0);
          if (syncPollingRef.current) clearInterval(syncPollingRef.current);
        }, 3000);
      } else if (status === 'error') {
        setSyncModalMessage(`Errore: ${error || 'Errore sconosciuto'}`);
        if (syncPollingRef.current) clearInterval(syncPollingRef.current);
      } else if (status === 'in_progress') {
        setSyncModalMessage(message || 'Sincronizzazione in corso...');
      }
    } catch {
      setSyncStatus('error');
      setSyncModalMessage('Errore nel controllo dello stato della sincronizzazione');
      if (syncPollingRef.current) clearInterval(syncPollingRef.current);
    }
  };

  // Chiudi modal sincronizzazione
  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSyncStatus('idle');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);
    if (syncPollingRef.current) clearInterval(syncPollingRef.current);
  };

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader className="d-flex flex-column flex-md-row align-items-md-center gap-3">
          <div className="fw-bold">Gestione Calendari</div>
          <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
            <CFormSelect
              value={selectedCalendar}
              onChange={(e) => setSelectedCalendar(e.target.value)}
              disabled={isLoadingCalendars}
              style={{ minWidth: 220 }}
            >
              <option value="">-- Seleziona un calendario --</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </CFormSelect>
            <CButton size="sm" color="secondary" onClick={handleRefreshCalendars} disabled={isLoadingCalendars}>
              {isLoadingCalendars ? <CSpinner size="sm" /> : 'Aggiorna'}
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {isLoadingCalendars ? (
            <div className="text-center py-4">
              <CSpinner color="primary" />
              <p className="mt-2">Caricamento calendari...</p>
            </div>
          ) : calendars.length === 0 ? (
            <div className="text-center py-4">
              <p>Nessun calendario disponibile. Assicurati di aver concesso le autorizzazioni necessarie.</p>
            </div>
          ) : (
            <CRow className="gy-4">
              {/* Card Sincronizza */}
              <CCol xs={12} md={6} lg={4}>
                <CCard>
                  <CCardHeader className="fw-bold">Sincronizza Appuntamenti</CCardHeader>
                  <CCardBody>
                    <div>
                      <label className="form-label">Mese</label>
                      <CFormSelect
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={month} value={idx}>{month}</option>
                        ))}
                      </CFormSelect>
                      <p className="text-muted small mt-2">
                        {MONTHS[selectedMonth]} {currentYear}
                      </p>
                    </div>

                    {/* Preview degli appuntamenti */}
                    {previewStats && (
                      <CAlert color="info" className="mt-3">
                        <strong>{previewStats.total} appuntamenti trovati:</strong><br />
                        • {previewStats.studioBlu} Studio Blu<br />
                        • {previewStats.studioGiallo} Studio Giallo<br />
                        {previewStats.nonSincronizzabili > 0 && (
                          <>• {previewStats.nonSincronizzabili} non sincronizzabili<br /></>
                        )}
                      </CAlert>
                    )}

                    <div className="d-flex gap-3 mt-4">
                      <CButton
                        color="primary"
                        onClick={handleLoadAppointments}
                        disabled={isLoadingPreview}
                      >
                        {isLoadingPreview && <CSpinner size="sm" className="me-1" />}
                        Carica appuntamenti dal DB
                      </CButton>
                      
                      {previewStats && previewStats.total > 0 && (
                        <CButton
                          color="success"
                          onClick={handleSync}
                        >
                          Procedi alla sincronizzazione
                        </CButton>
                      )}
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
              {/* Card Cancella */}
              <CCol xs={12} md={6} lg={4}>
                <CCard>
                  <CCardHeader className="fw-bold">Cancellazione Eventi</CCardHeader>
                  <CCardBody>
                    <div>
                      <label className="form-label">Mese</label>
                      <CFormSelect
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        disabled={!selectedCalendar}
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={month} value={idx}>{month}</option>
                        ))}
                      </CFormSelect>
                      <p className="text-muted small mt-2">
                        {MONTHS[selectedMonth]} {currentYear}
                      </p>
                    </div>
                    <div className="d-flex gap-3 mt-4">
                      <CButton
                        color="danger"
                        variant="outline"
                        onClick={handleClear}
                        disabled={!selectedCalendar || isLoadingClear}
                      >
                        {isLoadingClear && <CSpinner size="sm" className="me-1" />}
                        Cancella tutti gli eventi del mese
                      </CButton>
                      <CButton color="danger" variant="outline" onClick={handleClearAllEvents} style={{ marginLeft: 8 }}>
                        Cancella TUTTI gli eventi dal calendario selezionato
                      </CButton>
                    </div>
                  </CCardBody>
                </CCard>
                {/* Modale di conferma cancellazione */}
                <CModal visible={showModal} onClose={() => setShowModal(false)}>
                  <CModalHeader>Conferma Cancellazione</CModalHeader>
                  <CModalBody>
                    Sei sicuro di voler cancellare <b>TUTTI</b> gli eventi di {MONTHS[selectedMonth]} {currentYear} da questo calendario? L'operazione è <b>irreversibile</b>.
                  </CModalBody>
                  <CModalFooter>
                    <CButton color="secondary" onClick={() => setShowModal(false)}>
                      Annulla
                    </CButton>
                    <CButton color="danger" onClick={confirmClear} disabled={isLoadingClear}>
                      {isLoadingClear && <CSpinner size="sm" className="me-1" />}
                      Conferma
                    </CButton>
                  </CModalFooter>
                </CModal>
              </CCol>
              {/* Card Storico */}
              <CCol xs={12} md={12} lg={4}>
                <CCard>
                  <CCardHeader className="fw-bold">Storico Operazioni</CCardHeader>
                  <CCardBody>
                    <div className="text-center py-4">
                      <p>Storico operazioni in arrivo...</p>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          )}
          
          {/* Modale di avviso calendario non selezionato */}
          <CModal visible={showCalendarWarning} onClose={() => setShowCalendarWarning(false)}>
            <CModalHeader>Attenzione</CModalHeader>
            <CModalBody>
              Devi selezionare un calendario prima di procedere con la sincronizzazione.
            </CModalBody>
            <CModalFooter>
              <CButton color="primary" onClick={() => setShowCalendarWarning(false)}>
                Ho capito
              </CButton>
            </CModalFooter>
          </CModal>
          
          {/* Modal di avviso per calendario non selezionato (cancellazione) */}
          <CModal
            visible={showClearWarning}
            onClose={() => setShowClearWarning(false)}
            backdrop="static"
          >
            <CModalHeader>
              <h5>Calendario Non Selezionato</h5>
            </CModalHeader>
            <CModalBody>
              <CAlert color="warning">
                <strong>Attenzione!</strong> Devi selezionare prima un calendario Google dalla lista sopra.
                <br /><br />
                Solo dopo aver scelto un calendario potrai procedere con la cancellazione degli eventi.
              </CAlert>
            </CModalBody>
            <CModalFooter>
              <CButton color="primary" onClick={() => setShowClearWarning(false)}>
                Ho Capito
              </CButton>
            </CModalFooter>
          </CModal>
          
          {/* Modal di conferma cancellazione */}
          <CModal
            visible={showClearConfirmation}
            onClose={() => setShowClearConfirmation(false)}
            backdrop="static"
          >
            <CModalHeader>
              <h5>Conferma Cancellazione</h5>
            </CModalHeader>
            <CModalBody>
              <CAlert color="danger">
                <strong>Attenzione!</strong> Stai per cancellare <strong>TUTTI</strong> gli eventi dal calendario Google selezionato.
                <br /><br />
                Questa operazione non può essere annullata e rimuoverà definitivamente tutti gli appuntamenti dal calendario.
              </CAlert>
            </CModalBody>
            <CModalFooter>
              <CButton color="secondary" onClick={() => setShowClearConfirmation(false)}>
                Annulla
              </CButton>
              <CButton color="danger" onClick={confirmClearAllEvents}>
                {isLoadingClear ? <CSpinner size="sm" /> : 'Conferma Cancellazione'}
              </CButton>
            </CModalFooter>
          </CModal>
          
          {/* Modal avanzamento cancellazione */}
          <CModal
            visible={!!clearJobId}
            onClose={closeClearProgressModal}
            backdrop="static"
          >
            <CModalHeader>
              <h5>Cancellazione in corso</h5>
            </CModalHeader>
            <CModalBody>
              <div style={{ marginBottom: 16 }}>
                <CAlert color={clearStatus === 'error' ? 'danger' : clearStatus === 'completed' ? 'success' : 'info'}>
                  {clearStatus === 'in_progress' && (
                    <>
                      <strong>Attendere...</strong> Sto cancellando gli eventi dal calendario Google.<br />
                      {clearTotal > 0 && (
                        <>
                          <br />
                          <div>Eventi cancellati: <b>{clearDeleted}</b> / {clearTotal}</div>
                          <div className="progress" style={{ height: 20, marginTop: 8 }}>
                            <div className="progress-bar" role="progressbar" style={{ width: `${clearProgress}%` }} aria-valuenow={clearProgress} aria-valuemin={0} aria-valuemax={100}>
                              {clearProgress}%
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {clearStatus === 'completed' && (
                    <>
                      <strong>Completato!</strong> Cancellati {clearDeleted} eventi dal calendario.<br />
                    </>
                  )}
                  {clearStatus === 'error' && (
                    <>
                      <strong>Errore!</strong> {clearError}
                    </>
                  )}
                </CAlert>
              </div>
            </CModalBody>
            <CModalFooter>
              {clearStatus === 'completed' || clearStatus === 'error' ? (
                <CButton color="primary" onClick={closeClearProgressModal}>
                  Chiudi
                </CButton>
              ) : null}
            </CModalFooter>
          </CModal>
          
          {/* Modal di sincronizzazione in corso */}
          <CModal
            visible={showSyncModal}
            onClose={() => syncStatus === 'in_progress' ? null : closeSyncModal()}
            backdrop="static"
          >
            <CModalHeader>
              <h5>{syncStatus === 'error' ? 'Risultato Sincronizzazione' : 'Sincronizzazione in corso'}</h5>
            </CModalHeader>
            <CModalBody>
              <CAlert color={syncStatus === 'error' ? 'danger' : syncStatus === 'completed' ? 'success' : 'info'}>
                {syncStatus === 'in_progress' && (
                  <>
                    <div className="d-flex align-items-center mb-2">
                      <CSpinner size="sm" className="me-2" />
                      <span>{syncModalMessage}</span>
                    </div>
                    {syncTotal > 0 && (
                      <>
                        <div>Appuntamenti sincronizzati: <b>{syncSynced}</b> / {syncTotal}</div>
                        <div className="progress" style={{ height: 20, marginTop: 8 }}>
                          <div className="progress-bar" role="progressbar" style={{ width: `${syncProgress}%` }} aria-valuenow={syncProgress} aria-valuemin={0} aria-valuemax={100}>
                            {syncProgress}%
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                {syncStatus === 'completed' && (
                  <>
                    <strong>Completato!</strong> {syncModalMessage}
                    {syncSynced > 0 && (
                      <><br />Sincronizzati {syncSynced} appuntamenti.</>
                    )}
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <strong>Errore!</strong> {syncModalMessage}
                  </>
                )}
              </CAlert>
            </CModalBody>
            <CModalFooter>
              {syncStatus === 'completed' || syncStatus === 'error' ? (
                <CButton color="primary" onClick={closeSyncModal}>
                  Chiudi
                </CButton>
              ) : null}
            </CModalFooter>
          </CModal>
          
          <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        </CCardBody>
      </CCard>
    </>
  );
};

export default CalendarPage;
