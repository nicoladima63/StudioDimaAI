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
  CAlert,
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilSync, cilTrash } from '@coreui/icons';
import calendarService, { type Calendar, type Appointment } from '../services/calendar.service';
import PageLayout from '@/components/layout/PageLayout';

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

interface CalendarMainContentProps {
  setDbStatus: React.Dispatch<React.SetStateAction<'healthy' | 'unhealthy' | 'unknown'>>;
}

const CalendarMainContent: React.FC<CalendarMainContentProps> = ({ setDbStatus }) => {
  // States - following V1 structure exactly
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-based
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);
  const [showCalendarWarning, setShowCalendarWarning] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const currentYear = new Date().getFullYear();
  // Database states (dbStatus is passed via prop, not managed here)
  // Preview states
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewStats, setPreviewStats] = useState<{
    total: number;
    studioBlu: number;
    studioGiallo: number;
    nonSincronizzabili: number;
  } | null>(null);
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Sync modal states
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncModalMessage, setSyncModalMessage] = useState('');

  // Async sync states
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSynced, setSyncSynced] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'in_progress' | 'completed' | 'error' | 'cancelled'
  >('idle');
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncCancelling, setSyncCancelling] = useState(false);
  const syncPollingRef = React.useRef<number | null>(null);

  // Action warning state
  const [calendarWarningAction, setCalendarWarningAction] = useState<'sync' | 'clear' | null>(null);

  // Google reauth modal
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthMessage, setReauthMessage] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);

  // Toast notifications
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

  // Clear states (async job management)
  const [clearLoading, setClearLoading] = useState(false);
  const [clearJobId, setClearJobId] = useState<string | null>(null);
  const [clearProgress, setClearProgress] = useState(0);
  const [clearDeleted, setClearDeleted] = useState(0);
  const [clearTotal, setClearTotal] = useState(0);
  const [clearStatus, setClearStatus] = useState<
    'idle' | 'in_progress' | 'completed' | 'error' | 'cancelled'
  >('idle');
  const [clearCancelling, setClearCancelling] = useState(false);
  const clearPollingRef = React.useRef<number | null>(null);

  const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Selected calendar name helper
  const selectedCalendarName =
    calendars && Array.isArray(calendars)
      ? calendars.find(cal => cal.id === selectedCalendar)?.name || selectedCalendar
      : selectedCalendar;

  // Load calendars (V1 logic)
  const fetchCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const response = await calendarService.apiGetCalendars();

      if (response.success && response.data) {
        const calendarsArray = response.data.calendars || [];
        setCalendars(calendarsArray);

        if (calendarsArray.length === 0) {
          showToastMessage('Nessun calendario trovato.', 'warning');
        }
      } else {
        // Handle OAuth authentication errors
        if (
          response.error === 'GLOBAL_GOOGLE_AUTH_REQUIRED' ||
          response.error === 'GOOGLE_AUTH_REQUIRED'
        ) {
          setReauthMessage(response.message || 'Autenticazione Google richiesta.');
          setShowReauthModal(true);

          // If OAuth URL is provided in the error response, use it
          const oauthUrl = response.data?.auth_url;
          if (oauthUrl) {
            console.log('OAuth URL disponibile:', oauthUrl);
            // Store the URL for the reauth modal to use
            sessionStorage.setItem('google_oauth_url', oauthUrl);
          }
        } else {
          showToastMessage(`Errore caricamento calendari: ${response.message}`, 'danger');
        }
      }
    } catch (err: any) {
      console.error('Errore caricamento calendari', err);
      showToastMessage(`Errore caricamento calendari: ${err.message}`, 'danger');
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  // Load appointments effect
  useEffect(() => {
    if (loadTrigger === 0) return; // Don't run on first render

    const controller = new AbortController();

    const fetchAppointments = async () => {
      setIsLoadingPreview(true);
      setPreviewStats(null);
      try {
        const data = await calendarService.apiGetAppointments(selectedMonth + 1, currentYear);
        const appointments: Appointment[] = data.appointments || [];

        const stats = {
          total: appointments.length,
          studioBlu: appointments.filter((app: Appointment) => app.STUDIO === 1).length,
          studioGiallo: appointments.filter((app: Appointment) => app.STUDIO === 2).length,
          nonSincronizzabili: appointments.filter(
            (app: Appointment) => !app.STUDIO || ![1, 2].includes(app.STUDIO)
          ).length,
        };

        setPreviewStats(stats);
        if (stats.total > 0) {
          showToastMessage(
            `Caricati ${stats.total} appuntamenti per ${MONTHS[selectedMonth]} ${currentYear}`,
            'success'
          );
        } else {
          showToastMessage(
            `Nessun appuntamento trovato per ${MONTHS[selectedMonth]} ${currentYear}`,
            'warning'
          );
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          console.error('Errore caricamento appuntamenti', err);
          showToastMessage(`Errore caricamento appuntamenti: ${err.message}`, 'danger');
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

  // Sync handling (V1 logic)
  const handleSync = async () => {
    if (!selectedCalendar) {
      setCalendarWarningAction('sync');
      setShowCalendarWarning(true);
      return;
    }
    if (!previewStats) return;

    // Determine studio based on calendar name
    let studioId = null;
    const calendarName = selectedCalendarName.toLowerCase();

    if (calendarName.includes('giallo')) {
      studioId = 2;
    } else if (calendarName.includes('blu')) {
      studioId = 1;
    } else {
      // Ask user which studio to sync
      const userStudio = window.confirm(
        'Non è chiaro a quale studio appartenga questo calendario.\n' +
          'Vuoi sincronizzare lo Studio Giallo?\n' +
          '(Seleziona OK per Studio Giallo, Annulla per Studio Blu)'
      );
      studioId = userStudio ? 2 : 1;
    }

    // Open sync modal immediately
    setSyncModalMessage(
      `Sincronizzazione appuntamenti Studio ${studioId === 1 ? 'Blu' : 'Giallo'} in corso...`
    );
    setShowSyncModal(true);
    setSyncStatus('in_progress');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);

    try {
      // Start async sync
      const response = await calendarService.apiStartSync(
        selectedCalendar,
        selectedMonth + 1,
        currentYear,
        studioId
      );

      const { job_id } = response;

      if (!job_id) {
        throw new Error('Job ID non ricevuto dal server');
      }

      setSyncJobId(job_id);

      // Start polling for progress
      const pollSyncStatus = async () => {
        try {
          const statusResponse = await calendarService.apiGetSyncStatus(job_id);

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
            setTimeout(() => {
              setShowSyncModal(false);
              setSyncStatus('idle');
            }, 2000);
            return;
          } else if (status === 'error') {
            console.error('Errore nella sincronizzazione:', error);
            setSyncStatus('error');
            setSyncModalMessage(`Errore: ${error || 'Errore sconosciuto'}`);
            return;
          } else if (status === 'cancelled') {
            setSyncStatus('cancelled');
            setSyncModalMessage("Sincronizzazione interrotta dall'utente");
            setSyncCancelling(false);
            return;
          }

          // Continue polling if still in progress
          if (status === 'in_progress') {
            syncPollingRef.current = window.setTimeout(pollSyncStatus, 1000);
          }
        } catch (pollError) {
          console.error('Errore nel polling:', pollError);
          setSyncStatus('error');
          setSyncModalMessage('Errore durante il monitoraggio della sincronizzazione');
        }
      };

      // Start polling
      pollSyncStatus();
    } catch (syncError: any) {
      console.error("Errore nell'avvio della sincronizzazione:", syncError);
      setSyncStatus('error');
      setSyncModalMessage("Errore durante l'avvio della sincronizzazione");
    }
  };

  // Cancel sync
  const handleCancelSync = async () => {
    if (!syncJobId) return;

    setSyncCancelling(true);
    try {
      await calendarService.apiCancelSync(syncJobId);
    } catch (error) {
      console.error('Errore durante la cancellazione:', error);
      setSyncCancelling(false);
      setSyncModalMessage('Errore durante la cancellazione del job');
    }
  };

  // Clear calendar (simplified version)
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
    setClearLoading(true);
    setClearStatus('in_progress');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);

    try {
      const result = await calendarService.apiClearCalendar(selectedCalendar);
      if (result.success && result.data) {
        const { job_id } = result.data;
        setClearJobId(job_id);

        // Start polling for progress
        const pollClearStatus = async () => {
          try {
            const statusResponse = await calendarService.apiGetClearStatus(job_id);

            if (!statusResponse || typeof statusResponse !== 'object') {
              throw new Error('Risposta status non valida');
            }

            const { status, progress, deleted, total, message, error } = statusResponse;

            setClearProgress(progress || 0);
            setClearDeleted(deleted || 0);
            setClearTotal(total || 0);

            if (status === 'completed') {
              setClearStatus('completed');
              showToastMessage(`Cancellazione completata! ${deleted} eventi rimossi.`, 'success');
              setTimeout(() => {
                setClearStatus('idle');
                setClearJobId(null);
              }, 2000);
              return;
            } else if (status === 'error') {
              console.error('Errore nella cancellazione:', error);
              setClearStatus('error');
              showToastMessage(`Errore: ${error || 'Errore sconosciuto'}`, 'danger');
              return;
            } else if (status === 'cancelled') {
              setClearStatus('cancelled');
              showToastMessage("Cancellazione interrotta dall'utente", 'warning');
              setClearCancelling(false);
              return;
            }

            // Continue polling if still in progress
            if (status === 'in_progress') {
              clearPollingRef.current = window.setTimeout(pollClearStatus, 1000);
            }
          } catch (pollError) {
            console.error('Errore nel polling:', pollError);
            setClearStatus('error');
            showToastMessage('Errore durante il monitoraggio della cancellazione', 'danger');
          }
        };

        // Start polling
        pollClearStatus();
      } else {
        showToastMessage(result.message || "Errore durante l'avvio della cancellazione", 'danger');
        setClearStatus('error');
      }
    } catch (error: any) {
      console.error('Clear calendar error:', error);
      showToastMessage(error.message || "Errore durante l'avvio della cancellazione", 'danger');
      setClearStatus('error');
    } finally {
      setClearLoading(false);
    }
  };

  // Cancel clear job
  const handleCancelClear = async () => {
    if (!clearJobId) return;

    setClearCancelling(true);
    try {
      await calendarService.apiCancelClear(clearJobId);
    } catch (error) {
      console.error('Errore durante la cancellazione:', error);
      setClearCancelling(false);
      showToastMessage('Errore durante la cancellazione del job', 'danger');
    }
  };

  // Cleanup polling on unmount
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

  // Reset states when calendar changes
  useEffect(() => {
    setSyncStatus('idle');
    setSyncProgress(0);
    setSyncSynced(0);
    setSyncTotal(0);
    setSyncJobId(null);
    setSyncCancelling(false);
    setClearStatus('idle');
    setClearProgress(0);
    setClearDeleted(0);
    setClearTotal(0);
    setClearJobId(null);
    setClearCancelling(false);
  }, [selectedCalendar]);

  return (
    <PageLayout>
      <PageLayout.Header
        title={
          <div className='d-flex align-items-center'>
            <CIcon icon={cilCalendar} className='me-2' />
            Sincronizzazione Agenda su Calendar
          </div>
        }
      ></PageLayout.Header>

      <PageLayout.ContentBody>
        <CRow>
          <CCol md={8}>
            <div className='mb-3'>
              <label className='form-label'>Mese Selezionato</label>
              <div className='d-flex gap-2'>
                <CFormSelect
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(parseInt(e.target.value))}
                  className='flex-grow-1'
                >
                  {MONTHS.map((month, index) => (
                    <option key={index} value={index}>
                      {month} {currentYear}
                    </option>
                  ))}
                </CFormSelect>
              </div>
            </div>
          </CCol>
          <CCol md={4}>
            <div className='mb-3'>
              <label className='form-label'>Leggi il gestionale</label>
              <div className='d-flex gap-2'>
                <CButton
                  color='primary'
                  onClick={() => setLoadTrigger(c => c + 1)}
                  disabled={isLoadingPreview}
                >
                  {isLoadingPreview ? (
                    <>
                      <CSpinner size='sm' className='me-2' />
                      Caricamento...
                    </>
                  ) : (
                    <>
                      <CIcon icon={cilSync} className='me-2' />
                      Carica appuntamenti dal db
                    </>
                  )}
                </CButton>
              </div>
            </div>
          </CCol>

        </CRow>
        <CRow>
          <CCol md={8}>
            <div className='mb-3'>
              <label className='form-label'>Studio/Calendario Selezionato</label>
              <div className='d-flex gap-2'>
                <CFormSelect
                  value={selectedCalendar}
                  onChange={e => setSelectedCalendar(e.target.value)}
                  disabled={isLoadingCalendars}
                  className='flex-grow-1'
                >
                  <option value=''>Seleziona un calendario...</option>
                  {calendars.map(calendar => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </CFormSelect>
                <CButton
                  color='secondary'
                  size='sm'
                  onClick={fetchCalendars}
                  disabled={isLoadingCalendars}
                  style={{ width: '200px' }} // riserva spazio per "Caricamento..."
                >
                  {isLoadingCalendars ? (
                    <>
                      <CSpinner size='sm' className='me-2' />
                      Caricamento...
                    </>
                  ) : (
                    'Aggiorna'
                  )}
                </CButton>
              </div>
            </div>
          </CCol>
          <CCol md={4}>
            <div className='mb-3'>
              <label className='form-label'>Cancella gli eventi su Calendar</label>
              <div className='d-flex gap-2'>
                <CButton
                  color='danger'
                  onClick={handleClear}
                  disabled={clearLoading || clearStatus === 'in_progress' || !selectedCalendar}
                >
                  {clearLoading || clearStatus === 'in_progress' ? (
                    <>
                      <CSpinner size='sm' className='me-2' />
                      Cancellazione...
                    </>
                  ) : (
                    <>
                      <CIcon icon={cilTrash} className='me-2' />
                      Cancella Eventi
                    </>
                  )}
                </CButton>
              </div>
            </div>
          </CCol>

        </CRow>
        <CRow>
        </CRow>
        {/* Preview Appuntamenti */}
        {previewStats && (
          <CCard className='mb-4'>
            <CCardHeader>
              <h5 className='mb-0'>
                <CIcon icon={cilCalendar} className='me-2' />
                Preview Appuntamenti
              </h5>
            </CCardHeader>
            <CCardBody>
              <CRow>
                <CCol md={6}>
                  <CAlert color='info'>
                    <strong>Statistiche:</strong>
                    <br />
                    Totale: {previewStats.total}
                    <hr />
                    Studio Blu: {previewStats.studioBlu}
                    <hr />
                    Studio Giallo: {previewStats.studioGiallo}
                    {previewStats.nonSincronizzabili > 0 && (
                      <>
                        <br />
                        <span className='text-warning'>
                          Non sincronizzabili: {previewStats.nonSincronizzabili}
                        </span>
                      </>
                    )}
                  </CAlert>

                  {selectedCalendar && (
                    <CAlert color='info' className='p-2 small'>
                      {selectedCalendarName.toLowerCase().includes('giallo')
                        ? 'Questo calendario sincronizzerà gli appuntamenti dello Studio Giallo'
                        : selectedCalendarName.toLowerCase().includes('blu')
                          ? 'Questo calendario sincronizzerà gli appuntamenti dello Studio Blu'
                          : 'Attenzione: Non è chiaro quale studio verrà sincronizzato su questo calendario. Ti verrà chiesto prima della sincronizzazione.'}
                    </CAlert>
                  )}
                </CCol>
                <CCol md={4} className='d-flex align-items-center justify-content-center'>
                  {previewStats.total > 0 && (
                    <CButton
                      color='success'
                      size='lg'
                      onClick={handleSync}
                      disabled={syncStatus === 'in_progress'}
                      className='w-100'
                    >
                      {syncStatus === 'in_progress' ? (
                        <>
                          <CSpinner size='sm' className='me-2' />
                          Sincronizzazione...
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilSync} className='me-2' />
                          Sincronizza
                        </>
                      )}
                    </CButton>
                  )}
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>
        )}

        {/* Clear Confirmation Modal */}
        <CModal
          visible={showClearConfirmation}
          onClose={() => setShowClearConfirmation(false)}
          backdrop={clearStatus === 'in_progress' ? 'static' : true}
        >
          <CModalHeader>
            <h5>
              {clearStatus === 'in_progress'
                ? 'Cancellazione in corso'
                : clearStatus === 'completed'
                  ? 'Cancellazione Completata'
                  : clearStatus === 'error'
                    ? 'Errore Cancellazione'
                    : clearStatus === 'cancelled'
                      ? 'Cancellazione Interrotta'
                      : 'Conferma Cancellazione'}
            </h5>
          </CModalHeader>
          <CModalBody>
            {clearStatus === 'idle' && (
              <>
                <p>
                  Sei sicuro di voler cancellare <strong>TUTTI</strong> gli eventi dal calendario{' '}
                  <strong>"{selectedCalendarName}"</strong>?
                </p>
                <p className='text-danger'>
                  <strong>ATTENZIONE:</strong> Questa operazione non può essere annullata!
                </p>
              </>
            )}

            {clearStatus === 'in_progress' && (
              <CAlert color='info'>
                <div className='d-flex align-items-center'>
                  <CSpinner size='sm' className='me-2' />
                  <span>Cancellazione eventi in corso...</span>
                </div>
                {clearTotal > 0 && (
                  <div className='mt-2'>
                    <div className='progress'>
                      <div className='progress-bar' style={{ width: `${clearProgress}%` }}></div>
                    </div>
                    <small className='text-muted'>
                      Progresso: {clearProgress}% ({clearDeleted}/{clearTotal})
                    </small>
                  </div>
                )}
              </CAlert>
            )}

            {(clearStatus === 'completed' ||
              clearStatus === 'error' ||
              clearStatus === 'cancelled') && (
              <CAlert
                color={
                  clearStatus === 'completed'
                    ? 'success'
                    : clearStatus === 'error'
                      ? 'danger'
                      : 'warning'
                }
              >
                <div>
                  {clearStatus === 'completed' && (
                    <span>Cancellazione completata! {clearDeleted} eventi rimossi.</span>
                  )}
                  {clearStatus === 'error' && <span>Errore durante la cancellazione.</span>}
                  {clearStatus === 'cancelled' && (
                    <span>Cancellazione interrotta dall'utente.</span>
                  )}
                </div>
              </CAlert>
            )}
          </CModalBody>
          <CModalFooter>
            {clearStatus === 'idle' && (
              <>
                <CButton color='secondary' onClick={() => setShowClearConfirmation(false)}>
                  Annulla
                </CButton>
                <CButton color='danger' onClick={confirmClear}>
                  Conferma Cancellazione
                </CButton>
              </>
            )}

            {clearStatus === 'in_progress' && (
              <CButton color='danger' onClick={handleCancelClear} disabled={clearCancelling}>
                {clearCancelling ? (
                  <>
                    <CSpinner size='sm' className='me-2' />
                    Interruzione...
                  </>
                ) : (
                  'Interrompi'
                )}
              </CButton>
            )}

            {(clearStatus === 'completed' ||
              clearStatus === 'error' ||
              clearStatus === 'cancelled') && (
              <CButton
                color='primary'
                onClick={() => {
                  setShowClearConfirmation(false);
                  setClearStatus('idle');
                  setClearJobId(null);
                }}
              >
                Chiudi
              </CButton>
            )}
          </CModalFooter>
        </CModal>

        {/* Calendar Warning Modal */}
        <CModal visible={showCalendarWarning} onClose={() => setShowCalendarWarning(false)}>
          <CModalHeader>
            <h5>Calendario Non Selezionato</h5>
          </CModalHeader>
          <CModalBody>
            {calendarWarningAction === 'sync'
              ? 'Devi selezionare un calendario prima della sincronizzazione!'
              : 'Devi selezionare un calendario prima della cancellazione!'}
          </CModalBody>
          <CModalFooter>
            <CButton color='primary' onClick={() => setShowCalendarWarning(false)}>
              OK
            </CButton>
          </CModalFooter>
        </CModal>

        {/* Sync Progress Modal */}
        <CModal
          visible={showSyncModal}
          onClose={() =>
            syncStatus === 'error' || syncStatus === 'cancelled' ? setShowSyncModal(false) : null
          }
          backdrop='static'
        >
          <CModalHeader>
            <h5>
              {syncStatus === 'error'
                ? 'Risultato Sincronizzazione'
                : syncStatus === 'cancelled'
                  ? 'Sincronizzazione Interrotta'
                  : 'Sincronizzazione in corso'}
            </h5>
          </CModalHeader>
          <CModalBody>
            <CAlert
              color={
                syncStatus === 'error'
                  ? 'warning'
                  : syncStatus === 'cancelled'
                    ? 'secondary'
                    : 'info'
              }
            >
              {syncStatus === 'in_progress' && (
                <div className='d-flex align-items-center'>
                  <CSpinner size='sm' className='me-2' />
                  <span>{syncModalMessage}</span>
                </div>
              )}
              {(syncStatus === 'error' || syncStatus === 'cancelled') && (
                <div>
                  <span>{syncModalMessage}</span>
                </div>
              )}
              {syncStatus === 'in_progress' && syncTotal > 0 && (
                <div className='mt-2'>
                  <div className='progress'>
                    <div className='progress-bar' style={{ width: `${syncProgress}%` }}></div>
                  </div>
                  <small className='text-muted'>
                    Progresso: {syncProgress}% ({syncSynced}/{syncTotal})
                  </small>
                </div>
              )}
            </CAlert>
          </CModalBody>
          <CModalFooter>
            {syncStatus === 'in_progress' && (
              <CButton color='danger' onClick={handleCancelSync} disabled={syncCancelling}>
                {syncCancelling ? (
                  <>
                    <CSpinner size='sm' className='me-2' />
                    Interruzione...
                  </>
                ) : (
                  'Interrompi'
                )}
              </CButton>
            )}
            {(syncStatus === 'error' || syncStatus === 'cancelled') && (
              <CButton color='primary' onClick={() => setShowSyncModal(false)}>
                Chiudi
              </CButton>
            )}
          </CModalFooter>
        </CModal>

        {/* Google Reauth Modal */}
        <CModal visible={showReauthModal} onClose={() => setShowReauthModal(false)}>
          <CModalHeader>
            <h5>Riautorizza Google Calendar</h5>
          </CModalHeader>
          <CModalBody>
            <p>
              {reauthMessage ||
                'Le credenziali di accesso a Google Calendar sono scadute o corrotte.'}
            </p>
            <p className='text-danger'>
              Clicca su <strong>Riautorizza</strong> per eseguire una nuova autorizzazione. Si
              aprirà la pagina Google per completare l\'operazione.
              <br />
              Dopo aver autorizzato, torna qui e aggiorna la pagina.
            </p>
          </CModalBody>
          <CModalFooter>
            <CButton
              color='primary'
              disabled={reauthLoading}
              onClick={async () => {
                setReauthLoading(true);
                try {
                  // First, try to use the stored OAuth URL from the error response
                  let authUrl = sessionStorage.getItem('google_oauth_url');

                  if (!authUrl) {
                    // If no stored URL, get a fresh one
                    const res = await calendarService.apiGetReauthUrl();
                    if (res.success && res.data) {
                      authUrl = res.data.auth_url;
                    } else {
                      throw new Error(res.message || 'Errore generazione URL autorizzazione');
                    }
                  }

                  if (authUrl) {
                    window.open(authUrl, '_blank');
                    showToastMessage(
                      'Procedura di autorizzazione avviata. Completa la procedura nella finestra aperta, poi aggiorna la pagina.',
                      'success'
                    );
                    // Clear the stored URL after use
                    sessionStorage.removeItem('google_oauth_url');
                  } else {
                    throw new Error('URL autorizzazione non disponibile');
                  }
                } catch (error: any) {
                  console.error('Errore riautorizzazione', error);
                  showToastMessage(
                    `Errore durante la richiesta di riautorizzazione: ${error.message}`,
                    'danger'
                  );
                } finally {
                  setReauthLoading(false);
                }
              }}
            >
              Riautorizza
            </CButton>
            <CButton color='secondary' onClick={() => setShowReauthModal(false)}>
              Chiudi
            </CButton>
          </CModalFooter>
        </CModal>

        {/* Toast Notifications */}
        <CToaster placement='top-end'>
          {showToast && (
            <CToast autohide visible color={toastColor}>
              <CToastBody>{toastMessage}</CToastBody>
            </CToast>
          )}
        </CToaster>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default CalendarMainContent;
