import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
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
import Card from '@/components/ui/Card';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CalendarService } from '@/api/services/calendar.service';
import type { Calendar } from '@/lib/types';

const MONTHS = [  'Gennaio',  'Febbraio',  'Marzo',  'Aprile',  'Maggio',  'Giugno',  'Luglio',  'Agosto',  'Settembre',  'Ottobre',  'Novembre',  'Dicembre',];

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
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);
  const [showCalendarWarning, setShowCalendarWarning] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
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
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Stati per la modal di sincronizzazione in corso
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncModalMessage, setSyncModalMessage] = useState('');

  // Stati per la sincronizzazione asincrona
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSynced, setSyncSynced] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'in_progress' | 'completed' | 'error' | 'cancelled'>('idle');
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncCancelling, setSyncCancelling] = useState(false);
  const syncPollingRef = React.useRef<number | null>(null);

  // Stati per il tipo di azione che ha causato il warning
  const [calendarWarningAction, setCalendarWarningAction] = useState<'sync' | 'clear' | null>(null);

  // Stato per la modale di ri-autenticazione Google
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthMessage, setReauthMessage] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);

  //stato per il calendario selezionato
  const selectedCalendarName = (calendars && Array.isArray(calendars)) 
    ? (calendars.find(cal => cal.id === selectedCalendar)?.name || selectedCalendar)
    : selectedCalendar;

  // Funzione per caricare i calendari
  const fetchCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const response = await CalendarService.getCalendars(); // Ricevi la risposta completa
      
      // Estrai l'array calendars dalla risposta
      const calendarsArray = response.calendars || [];
      
      setCalendars(calendarsArray);
      
      if (calendarsArray.length === 0) {
        toast.info('Nessun calendario trovato.');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error_code?: string; message?: string } }; message?: string };
      const errorMessage = error.message || 'Errore sconosciuto';
      if (error?.response?.data?.error_code === 'GLOBAL_GOOGLE_AUTH_REQUIRED') {
        setReauthMessage(error.response.data.message || 'Autenticazione Google richiesta.');
        setShowReauthModal(true);
      } else {
        console.error('Errore caricamento calendari', err);
        toast.error(`Errore caricamento calendari: ${errorMessage}`);
      }
    } finally {
      setIsLoadingCalendars(false);
    }
  };
  
  useEffect(() => {
    fetchCalendars();
  }, []);

  // Effetto per caricare gli appuntamenti quando il trigger cambia
  useEffect(() => {
    if (loadTrigger === 0) return; // Non eseguire al primo render

    const controller = new AbortController();

    const fetchAppointments = async () => {
      setIsLoadingPreview(true);
      setPreviewStats(null);
      try {
        const data = await CalendarService.getAppointments(selectedMonth + 1, currentYear, controller.signal);
        const appointments: Appointment[] = data.appointments || [];

        const stats = {
          total: appointments.length,
          studioBlu: appointments.filter((app: Appointment) => app.STUDIO === 1).length,
          studioGiallo: appointments.filter((app: Appointment) => app.STUDIO === 2).length,
          nonSincronizzabili: appointments.filter((app: Appointment) => !app.STUDIO || ![1, 2].includes(app.STUDIO)).length,
        };

        setPreviewStats(stats);
        if (stats.total > 0) {
            toast.success(`✅ Caricati ${stats.total} appuntamenti per ${MONTHS[selectedMonth]} ${currentYear}`);
        } else {
            toast.info(`Nessun appuntamento trovato per ${MONTHS[selectedMonth]} ${currentYear}`);
        }
      } catch (err) {
        const error = err as { name?: string; message?: string };
        if (error.name !== 'CanceledError') {
          const errorMessage = error.message || 'Errore sconosciuto';
          console.error('Errore caricamento appuntamenti', err);
          toast.error(`❌ Errore caricamento appuntamenti: ${errorMessage}`);
        }
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchAppointments();

    return () => {
      controller.abort();
    };
  }, [loadTrigger, selectedMonth, currentYear]);

  // Funzione per sincronizzazione e pulizia
const handleSync = async () => {
  if (!selectedCalendar) {
    setCalendarWarningAction('sync');
    setShowCalendarWarning(true);
    return;
  }
  if (!previewStats) return;
  
  // Determina lo studio basato sul nome del calendario selezionato
  let studioId = null;
  const calendarName = selectedCalendarName.toLowerCase();
  
  if (calendarName.includes('giallo')) {
    studioId = 2;
  } else if (calendarName.includes('blu')) {
    studioId = 1;
  } else {
    // Chiedi all'utente quale studio sincronizzare se non è chiaro dal nome
    const userStudio = window.confirm(
      "Non è chiaro a quale studio appartenga questo calendario.\n" +
      "Vuoi sincronizzare lo Studio Giallo?\n" +
      "(Seleziona OK per Studio Giallo, Annulla per Studio Blu)"
    );
    studioId = userStudio ? 2 : 1;
  }
  
  // Apri subito la modal di sincronizzazione
  setSyncModalMessage(`Sincronizzazione appuntamenti Studio ${studioId === 1 ? 'Blu' : 'Giallo'} in corso...`);
  setShowSyncModal(true);
  setSyncStatus('in_progress');
  setSyncProgress(0);
  setSyncSynced(0);
  setSyncTotal(0);

  try {
    
    // Avvia la sincronizzazione asincrona con il parametro studio_id
    const response = await CalendarService.startSync(selectedCalendar, selectedMonth + 1, currentYear, studioId);
    
    const { job_id } = response;  // Nota: non response.data ma response direttamente
    
    if (!job_id) {
      throw new Error('Job ID non ricevuto dal server');
    }
    
    setSyncJobId(job_id);
    
    // Inizia il polling per monitorare il progresso
    const pollSyncStatus = async () => {
      try {
        const statusResponse = await CalendarService.getSyncStatus(job_id);
        
        // Controlla se statusResponse ha la struttura corretta
        if (!statusResponse || typeof statusResponse !== 'object') {
          throw new Error('Risposta status non valida');
        }
        
        const { status, progress, synced, total, message, error } = statusResponse;
        
        setSyncProgress(progress || 0);
        setSyncSynced(synced || 0);
        setSyncTotal(total || 0);
        
        if (message) {
          setSyncModalMessage(message);
        }
        
        if (status === 'completed') {
          setSyncStatus('completed');
          setSyncModalMessage('Sincronizzazione completata con successo!');
          // Chiudi automaticamente la modal dopo 2 secondi
          setTimeout(() => {
            setShowSyncModal(false);
            setSyncStatus('idle');
          }, 2000);
          return;
        } else if (status === 'error') {
          console.error('❌ Errore nella sincronizzazione:', error);
          setSyncStatus('error');
          setSyncModalMessage(`Errore: ${error || 'Errore sconosciuto'}`);
          return;
        } else if (status === 'cancelled') {
          setSyncStatus('cancelled');
          setSyncModalMessage('Sincronizzazione interrotta dall\'utente');
          setSyncCancelling(false);
          return;
        }
        
        // Continua il polling solo se lo stato è ancora in_progress
        if (status === 'in_progress') {
          syncPollingRef.current = window.setTimeout(pollSyncStatus, 1000);
        }
        
      } catch (pollError) {
        console.error('❌ Errore nel polling:', pollError);
        setSyncStatus('error');
        setSyncModalMessage('Errore durante il monitoraggio della sincronizzazione');
      }
    };
    
    // Avvia il polling
    pollSyncStatus();
    
  } catch (syncError) {
    console.error('❌ Errore nell\'avvio della sincronizzazione:', syncError);
    setSyncStatus('error');
    setSyncModalMessage('Errore durante l\'avvio della sincronizzazione');
  }
};

  // Funzione per cancellare la sincronizzazione
  const handleCancelSync = async () => {
    if (!syncJobId) return;
    
    setSyncCancelling(true);
    try {
      await CalendarService.cancelSyncJob(syncJobId);
    } catch (error) {
      console.error('❌ Errore durante la cancellazione:', error);
      setSyncCancelling(false);
      setSyncModalMessage('Errore durante la cancellazione del job');
    }
  };
  
  // Funzione per cancellazione asincrona
  const handleClear = async () => {
    if (!selectedCalendar) {
      setCalendarWarningAction('clear');
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
    setClearTotal(2); // 2 calendari totali
    setClearError(null);

    try {
      
      // Avvia la cancellazione asincrona
      const response = await CalendarService.startClearAll();
      const { job_id } = response;
      
      if (!job_id) {
        throw new Error('Job ID non ricevuto dal server');
      }
      
      
      // Inizia il polling per monitorare il progresso
      const pollClearStatus = async () => {
        try {
          const statusResponse = await CalendarService.getClearAllStatus(job_id);
          
          const { status, progress, deleted, message, error } = statusResponse;
          
          setClearProgress(progress || 0);
          setClearDeleted(deleted || 0);
          
          if (status === 'completed') {
            setClearStatus('completed');
            toast.success(`Cancellazione completata! ${deleted} eventi rimossi.`);
            setTimeout(() => {
              setClearStatus('idle');
            }, 2000);
            return;
          } else if (status === 'error') {
            console.error('❌ Errore nella cancellazione:', error);
            setClearStatus('error');
            setClearError(error || 'Errore durante la cancellazione');
            toast.error(error || 'Errore durante la cancellazione');
            return;
          } else if (status === 'cancelled') {
            setClearStatus('idle');
            toast.info('Cancellazione annullata');
            return;
          }
          
          // Continua il polling se ancora in corso
          if (status === 'in_progress') {
            clearPollingRef.current = setTimeout(pollClearStatus, 1000);
          }
          
        } catch (pollError) {
          console.error('Errore polling clear status:', pollError);
          setClearStatus('error');
          setClearError('Errore nel monitoraggio del progresso');
          toast.error('Errore nel monitoraggio del progresso');
        }
      };
      
      // Avvia il polling
      pollClearStatus();
      
    } catch (error) {
      setClearStatus('error');
      console.error('Errore durante avvio cancellazione:', error);
      
      const errorMessage = error.message || "Si è verificato un errore durante la cancellazione.";
      setClearError(errorMessage);
      toast.error(errorMessage);
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

  // Reset stato cancellazione e sincronizzazione al cambio calendario
  useEffect(() => {
    setClearStatus('idle');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);
    setClearError(null);
    
    // Reset anche degli stati di sincronizzazione
    setSyncStatus('idle');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);
    setSyncJobId(null);
    setSyncCancelling(false);
  }, [selectedCalendar]);


  return (
    <Card title="Gestione Agenda su Calendar">
      <ToastContainer />      
      <CCard>
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
                  onClick={() => setLoadTrigger(c => c + 1)}
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
                  <>
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
                    
                    {/* Indicazione studio da sincronizzare */}
                    {selectedCalendar && (
                      <div className="mt-2">
                        <CAlert color="info" className="p-2 small">
                          {selectedCalendarName.toLowerCase().includes('giallo') ? 
                            'Questo calendario sincronizzerà gli appuntamenti dello Studio Giallo' : 
                            selectedCalendarName.toLowerCase().includes('blu') ?
                            'Questo calendario sincronizzerà gli appuntamenti dello Studio Blu' :
                            'Attenzione: Non è chiaro quale studio verrà sincronizzato su questo calendario. Ti verrà chiesto prima della sincronizzazione.'}
                        </CAlert>
                      </div>
                    )}
                  </>
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

              {/* Modal di cancellazione in corso/completata/errore */}
              <CModal
                visible={clearStatus !== 'idle'}
                onClose={() => clearStatus === 'error' || clearStatus === 'completed' ? setClearStatus('idle') : null}
                backdrop={clearStatus === 'error' || clearStatus === 'completed' ? "static" : "static"}
              >
                <CModalHeader>
                  <h5>{
                    clearStatus === 'error' ? 'Risultato Cancellazione' :
                    clearStatus === 'completed' ? 'Cancellazione Completata' :
                    'Cancellazione in corso'
                  }</h5>
                </CModalHeader>
                <CModalBody>
                  <CAlert color={clearStatus === 'error' ? 'danger' : clearStatus === 'completed' ? 'success' : 'warning'}>
                    {clearStatus !== 'error' && clearStatus !== 'completed' && (
                      <div className="d-flex align-items-center">
                        <CSpinner size="sm" className="me-2" />
                        <span>Cancellazione in corso...</span>
                      </div>
                    )}
                    {clearStatus === 'error' && (
                      <div>
                        <span>{clearError}</span>
                      </div>
                    )}
                    {clearStatus === 'completed' && (
                      <div>
                        <span>{clearDeleted} eventi eliminati con successo.</span>
                      </div>
                    )}
                    {clearStatus === 'in_progress' && clearTotal > 0 && (
                      <div className="mt-2">
                        <div className="progress">
                          <div 
                            className="progress-bar" 
                            style={{ width: `${clearProgress}%` }}
                          ></div>
                        </div>
                        <small className="text-muted">
                          Progresso: {clearProgress}% ({clearDeleted}/{clearTotal})
                        </small>
                      </div>
                    )}
                  </CAlert>
                </CModalBody>
                {(clearStatus === 'error' || clearStatus === 'completed') && (
                  <CModalFooter>
                    <CButton
                      color="primary"
                      onClick={() => setClearStatus('idle')}
                    >
                      Chiudi
                    </CButton>
                  </CModalFooter>
                )}
              </CModal>
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
          {calendarWarningAction === 'sync'
            ? 'Devi selezionare un calendario prima della sincronizzazione!'
            : 'Devi selezionare un calendario prima della cancellazione!'}
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
        onClose={() => (syncStatus === 'error' || syncStatus === 'cancelled') ? setShowSyncModal(false) : null}
        backdrop="static"
      >
        <CModalHeader>
          <h5>
            {syncStatus === 'error' ? 'Risultato Sincronizzazione' : 
             syncStatus === 'cancelled' ? 'Sincronizzazione Interrotta' :
             'Sincronizzazione in corso'}
          </h5>
        </CModalHeader>
        <CModalBody>
          <CAlert color={syncStatus === 'error' ? 'warning' : syncStatus === 'cancelled' ? 'secondary' : 'info'}>
            {syncStatus === 'in_progress' && (
              <div className="d-flex align-items-center">
                <CSpinner size="sm" className="me-2" />
                <span>{syncModalMessage}</span>
              </div>
            )}
            {(syncStatus === 'error' || syncStatus === 'cancelled') && (
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
        <CModalFooter>
          {syncStatus === 'in_progress' && (
            <CButton
              color="danger"
              onClick={handleCancelSync}
              disabled={syncCancelling}
            >
              {syncCancelling ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Interruzione...
                </>
              ) : (
                'Interrompi'
              )}
            </CButton>
          )}
          {(syncStatus === 'error' || syncStatus === 'cancelled') && (
            <CButton
              color="primary"
              onClick={() => setShowSyncModal(false)}
            >
              Chiudi
            </CButton>
          )}
        </CModalFooter>
      </CModal>

      {/* Modal di ri-autenticazione Google */}
      <CModal
        visible={showReauthModal}
        onClose={() => setShowReauthModal(false)}
      >
        <CModalHeader>
          <h5>Riautorizza Google Calendar</h5>
        </CModalHeader>
        <CModalBody>
          <p>{reauthMessage || 'Le credenziali di accesso a Google Calendar sono scadute o corrotte.'}</p>
          <p className="text-danger">
            Clicca su <strong>Riautorizza</strong> per eseguire una nuova autorizzazione. Si aprirà la pagina Google per completare l'operazione.<br/>
            Dopo aver autorizzato, torna qui e aggiorna la pagina.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="primary"
            disabled={reauthLoading}
            onClick={async () => {
              setReauthLoading(true);
              try {
                const res = await CalendarService.getReauthUrl();
                window.open(res.auth_url, '_blank');
                toast.success('Procedura di autorizzazione avviata. Completa la procedura nella finestra aperta, poi aggiorna la pagina.');
              } catch (error) {
                console.error("Errore riautorizzazione", error);
                toast.error('Errore durante la richiesta di riautorizzazione.');
              } finally {
                setReauthLoading(false);
              }
            }}
          >
            Riautorizza
          </CButton>
          <CButton color="secondary" onClick={() => setShowReauthModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </Card>
  );
};

export default CalendarPage;
