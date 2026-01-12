import React, { useEffect, useState, useRef } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormSwitch,
  CFormLabel,
  CRow,
  CCol,
  CButton,
  CFormSelect,
  CAlert,
  CSpinner,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilSettings, cilSync, cilTrash, cilWarning } from '@coreui/icons';
import { environmentApi } from '@/services/api/environment.service';
import { schedulerService, type SchedulerSettings } from '@/features/scheduler/services/schedulerService';
import { apiGetCalendars, apiStartSync, apiClearCalendar, apiGetClearStatus, apiGetSyncStatus } from '@/features/calendar/services/calendar.service';
import { environmentService } from '@/features/settings/services/environment.service';
import PageLayout from '@/components/layout/PageLayout';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CalendarSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [weeksToSync, setWeeksToSync] = useState(3);
  const [databaseMode, setDatabaseMode] = useState<'dev' | 'prod'>('prod');
  const [switchingMode, setSwitchingMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [log, setLog] = useState<
    { message: string; type: 'info' | 'success' | 'error'; timestamp: Date }[]
  >([]);

  // Stati per azioni rapide
  const [clearingAll, setClearingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  
  // Stati per monitoraggio progresso
  const [clearJobs, setClearJobs] = useState<Map<string, any>>(new Map());
  const [syncJobs, setSyncJobs] = useState<Map<string, any>>(new Map());
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Riferimenti diretti per evitare race conditions
  const clearJobsRef = useRef<Map<string, any>>(new Map());
  const syncJobsRef = useRef<Map<string, any>>(new Map());

  // Stati per le modal di conferma
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showForceSyncConfirm, setShowForceSyncConfirm] = useState(false);

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setLog((prev) =>
      [{ message, type, timestamp: new Date() }, ...prev].slice(0, 10)
    );
  };

  // Funzioni per monitoraggio progresso
  const startPolling = () => {
    if (pollingInterval) {
      console.log('Polling already active, skipping...');
      return; // Già in corso
    }
    
    console.log('Starting polling interval...');
    const interval = setInterval(async () => {
      await pollJobStatuses();
    }, 2000); // Poll ogni 2 secondi
    
    setPollingInterval(interval);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      console.log('Stopping polling interval...');
      clearInterval(pollingInterval);
      setPollingInterval(null);
    } else {
      console.log('No polling interval to stop');
    }
  };

  const pollJobStatuses = async () => {
    const activeClearJobs = clearJobsRef.current.size;
    const activeSyncJobs = syncJobsRef.current.size;
    
    console.log('Polling job statuses...', { clearJobs: activeClearJobs, syncJobs: activeSyncJobs });
    
    // Se non ci sono job attivi, ferma il polling
    if (activeClearJobs === 0 && activeSyncJobs === 0) {
      console.log('No active jobs, stopping polling...');
      stopPolling();
      return;
    }
    
    // Poll clear jobs
    for (const [jobId, jobInfo] of clearJobsRef.current.entries()) {
      try {
        console.log(`Polling clear job ${jobId} for ${jobInfo.calendarName}`);
        const status = await apiGetClearStatus(jobId);
        console.log('Clear job status:', status);
        
        if (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled') {
          addLog(`Cancellazione ${jobInfo.calendarName}: ${status.status}`, 
                 status.status === 'completed' ? 'success' : 'error');
          console.log(`Removing completed clear job ${jobId} for ${jobInfo.calendarName}`);
          
          // Rimuovi dal riferimento (immediato)
          clearJobsRef.current.delete(jobId);
          
          // Aggiorna lo stato (per l'UI)
          setClearJobs(prev => {
            const newMap = new Map(prev);
            newMap.delete(jobId);
            return newMap;
          });
        } else if (status.status === 'in_progress') {
          addLog(`Cancellazione ${jobInfo.calendarName}: ${status.deleted || status.synced}/${status.total} eventi`, 'info');
        }
      } catch (error) {
        console.error('Errore polling clear job:', error);
        addLog(`Errore polling cancellazione ${jobInfo.calendarName}: ${error}`, 'error');
      }
    }

    // Poll sync jobs
    for (const [jobId, jobInfo] of syncJobsRef.current.entries()) {
      try {
        console.log(`Polling sync job ${jobId} for ${jobInfo.calendarName}`);
        const status = await apiGetSyncStatus(jobId);
        console.log('Sync job status:', status);
        
        if (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled') {
          addLog(`Sincronizzazione ${jobInfo.calendarName}: ${status.status}`, 
                 status.status === 'completed' ? 'success' : 'error');
          
          // Rimuovi dal riferimento (immediato)
          syncJobsRef.current.delete(jobId);
          
          // Aggiorna lo stato (per l'UI)
          setSyncJobs(prev => {
            const newMap = new Map(prev);
            newMap.delete(jobId);
            return newMap;
          });
        } else if (status.status === 'in_progress') {
          addLog(`Sincronizzazione ${jobInfo.calendarName}: ${status.synced}/${status.total} eventi`, 'info');
        }
      } catch (error) {
        console.error('Errore polling sync job:', error);
        addLog(`Errore polling sincronizzazione ${jobInfo.calendarName}: ${error}`, 'error');
      }
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Avvia/ferma polling quando ci sono job attivi
  useEffect(() => {
    const activeClearJobs = clearJobsRef.current.size;
    const activeSyncJobs = syncJobsRef.current.size;
    console.log('useEffect polling triggered:', { clearJobs: activeClearJobs, syncJobs: activeSyncJobs });
    
    if (activeClearJobs > 0 || activeSyncJobs > 0) {
      console.log('Starting polling...');
      startPolling();
    } else {
      console.log('Stopping polling...');
      stopPolling();
    }
  }, [clearJobs.size, syncJobs.size]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    addLog('Caricamento impostazioni calendario...', 'info');
    try {
      // Carica impostazioni scheduler
      const response = await schedulerService.apiGetStatus();
      const settings = response.settings;
      
      setEnabled(settings.calendar_sync_enabled);
      
      if (settings.calendar_sync_fallback_time) {
        const [h, m] = settings.calendar_sync_fallback_time.split(':');
        setHour(parseInt(h, 10));
        setMinute(parseInt(m, 10));
      }
      
      setWeeksToSync(settings.calendar_weeks_to_sync ?? 3);
      
      // Carica database mode
      const dbResponse = await environmentService.getServiceEnvironment('database');
      if (dbResponse.success && dbResponse.data) {
        setDatabaseMode(dbResponse.data.current_environment as 'dev' | 'prod');
        addLog(`Database mode: ${dbResponse.data.current_environment}`, 'info');
      }
      
      addLog('Impostazioni calendario caricate con successo', 'success');
    } catch (err: any) {
      const errorMsg = 'Errore nel recupero delle impostazioni';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnabledChange = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    addLog(
      `${
        newEnabled ? 'Attivazione' : 'Disattivazione'
      } automazione calendario...`,
      'info'
    );
    try {
      const fallbackTime = `${String(hour).padStart(2, '0')}:${String(
        minute
      ).padStart(2, '0')}`;
      await schedulerService.apiUpdateSettings('calendar', {
        calendar_sync_enabled: newEnabled,
        calendar_sync_fallback_time: fallbackTime,
        calendar_sync_times: [fallbackTime],
        calendar_weeks_to_sync: weeksToSync,
      });
      addLog(
        `Automazione calendario ${
          newEnabled ? 'attivata' : 'disattivata'
        } con successo`,
        'success'
      );
    } catch (err: any) {
      const errorMsg = 'Errore nel salvataggio dello stato';
      setError(errorMsg);
      addLog(errorMsg, 'error');
      // Ripristina lo stato precedente in caso di errore
      setEnabled(!newEnabled);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    addLog('Salvataggio orario sincronizzazione...', 'info');
    try {
      const fallbackTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      await schedulerService.apiUpdateSettings('calendar', {
        calendar_sync_enabled: enabled,
        calendar_sync_fallback_time: fallbackTime,
        calendar_sync_times: [fallbackTime],
        calendar_weeks_to_sync: weeksToSync,
      });
      setSuccess('Orario sincronizzazione salvato con successo!');
      addLog('Orario sincronizzazione salvato con successo', 'success');
    } catch (err: any) {
      const errorMsg = "Errore nel salvataggio dell'orario";
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDatabaseModeChange = async (newMode: 'dev' | 'prod') => {
    setSwitchingMode(true);
    setError(null);
    setSuccess(null);
    addLog(`Cambio database mode da ${databaseMode} a ${newMode}...`, 'info');
    
    try {
      const response = await environmentService.switchServiceEnvironment('database', newMode);
      if (response.success && response.data) {
        setDatabaseMode(newMode);
        setSuccess(`Database mode cambiato a ${newMode} con successo!`);
        addLog(`Database mode cambiato a ${newMode} con successo`, 'success');
      } else {
        throw new Error(response.error || 'Errore nel cambio del database mode');
      }
    } catch (err: any) {
      const errorMsg = `Errore nel cambio del database mode: ${err.message}`;
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    setClearingAll(true);
    addLog('Cancellazione di tutti i calendari...', 'info');
    try {
      // Ottieni la lista dei calendari
      const calendarsResponse = await apiGetCalendars();
      if (!calendarsResponse.success || !calendarsResponse.data) {
        throw new Error('Impossibile recuperare la lista dei calendari');
      }
      
      const calendars = calendarsResponse.data.calendars;
      let totalDeleted = 0;
      
      // Cancella eventi da ogni calendario
      for (const calendar of calendars) {
        try {
          addLog(`Avvio cancellazione eventi da ${calendar.name}...`, 'info');
          //console.log(`Starting clear for ${calendar.name}`);
          const clearResponse = await apiClearCalendar(calendar.id);
          //console.log(`Clear response for ${calendar.name}:`, clearResponse);
          if (clearResponse && clearResponse.job_id) {
            const jobId = clearResponse.job_id;
            //console.log(`Added clear job ${jobId} for ${calendar.name}`);
            
            // Aggiungi al riferimento (immediato)
            clearJobsRef.current.set(jobId, { calendarName: calendar.name });
            
            // Aggiorna lo stato (per l'UI)
            setClearJobs(prev => new Map(prev).set(jobId, { calendarName: calendar.name }));
            totalDeleted += 1; // Contiamo i calendari processati
          } else {
            console.error('Clear response failed:', clearResponse);
            addLog(`Errore risposta cancellazione ${calendar.name}: ${clearResponse?.error || 'Risposta non valida'}`, 'error');
          }
        } catch (calendarError) {
          addLog(`Errore cancellazione ${calendar.name}: ${calendarError}`, 'error');
        }
      }
      
      // Il polling si avvierà automaticamente tramite useEffect quando clearJobs cambia
      //console.log(`Clear operation completed. Total deleted: ${totalDeleted}`);
      
      const successMsg = `Cancellazione avviata per ${totalDeleted} calendari.`;
      addLog(successMsg, 'success');
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = 'Errore nella cancellazione dei calendari';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleSyncAll = async () => {
    setShowSyncConfirm(false);
    setSyncingAll(true);
    addLog('Sincronizzazione di tutti i calendari...', 'info');
    try {
      // Ottieni la lista dei calendari
      const calendarsResponse = await apiGetCalendars();
      if (!calendarsResponse.success || !calendarsResponse.data) {
        throw new Error('Impossibile recuperare la lista dei calendari');
      }
      
      const calendars = calendarsResponse.data.calendars;
      let totalSynced = 0;
      
      // Calcola il range di settimane dinamico
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Lunedì della settimana corrente
      
      const endDate = new Date(startOfWeek);
      endDate.setDate(startOfWeek.getDate() + (weeksToSync * 7) - 1); // Fine dell'ultima settimana
      
      addLog(`Sincronizzazione per ${weeksToSync} settimane: ${startOfWeek.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 'info');
      
      // Sincronizza ogni calendario
      for (const calendar of calendars) {
        try {
          addLog(`Avvio sincronizzazione ${calendar.name}...`, 'info');
          
          // Determina lo studio basandosi sul nome del calendario
          let studioId = 1; // Default Studio Blu
          if (calendar.name.toLowerCase().includes('giallo')) {
            studioId = 2;
          }
          
          console.log(`Starting sync for ${calendar.name} (studio ${studioId})`);
          const syncResponse = await apiStartSync(
            calendar.id,
            // Invia il mese/anno di inizio per la logica di lettura del DBF
            startOfWeek.getMonth() + 1, 
            startOfWeek.getFullYear(), 
            studioId,
            // Invia il mese/anno di fine per la logica di iterazione sui mesi
            endDate.getMonth() + 1, 
            endDate.getFullYear(),
            // Invia le date esatte per il filtro granulare
            startOfWeek.toISOString().split('T')[0], // 'YYYY-MM-DD'
            endDate.toISOString().split('T')[0]      // 'YYYY-MM-DD'
          );
          console.log(`Sync response for ${calendar.name}:`, syncResponse);
          
          if (syncResponse && syncResponse.job_id) {
            const jobId = syncResponse.job_id;
            console.log(`Added sync job ${jobId} for ${calendar.name}`);
            
            // Aggiungi al riferimento (immediato)
            syncJobsRef.current.set(jobId, { calendarName: calendar.name });
            
            // Aggiorna lo stato (per l'UI)
            setSyncJobs(prev => new Map(prev).set(jobId, { calendarName: calendar.name }));
            totalSynced += 1; // Contiamo i calendari processati
          } else {
            console.error('Sync response failed:', syncResponse);
            addLog(`Errore risposta sincronizzazione ${calendar.name}: ${syncResponse?.error || 'Risposta non valida'}`, 'error');
          }
        } catch (calendarError) {
          addLog(`Errore sincronizzazione ${calendar.name}: ${calendarError}`, 'error');
        }
      }
      
      // Il polling si avvierà automaticamente tramite useEffect quando syncJobs cambia
      console.log(`Sync operation completed. Total synced: ${totalSynced}`);
      
      const successMsg = `Sincronizzazione avviata per ${totalSynced} calendari.`;
      addLog(successMsg, 'success');
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = 'Errore nella sincronizzazione dei calendari';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleForceResync = async () => {
    setShowForceSyncConfirm(false);
    setForceSyncing(true);
    addLog('Avvio risincronizzazione forzata...', 'info');
    try {
      // Ottieni la lista dei calendari
      const calendarsResponse = await apiGetCalendars();
      if (!calendarsResponse.success || !calendarsResponse.data) {
        throw new Error('Impossibile recuperare la lista dei calendari');
      }
      
      const calendars = calendarsResponse.data.calendars;
      
      // Calcola il range di settimane
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
      
      const endDate = new Date(startOfWeek);
      endDate.setDate(startOfWeek.getDate() + (weeksToSync * 7) - 1);
      
      addLog(`Periodo di risincronizzazione: ${startOfWeek.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 'info');
      
      // Prepara i dati per il backend
      const studioCalendarIds: { [key: number]: string } = {};
      calendars.forEach(cal => {
        if (cal.name.toLowerCase().includes('giallo')) {
          studioCalendarIds[2] = cal.id;
        } else if (cal.name.toLowerCase().includes('blu')) {
          studioCalendarIds[1] = cal.id;
        }
      });

      // Chiamata al nuovo endpoint del servizio
      // Assumendo che esista un `apiStartForceResync` nel service
      const forceSyncResponse = await calendarService.apiStartForceResync(
        studioCalendarIds,
        startOfWeek.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      if (forceSyncResponse && forceSyncResponse.job_id) {
        const jobId = forceSyncResponse.job_id;
        
        // Usa lo stesso meccanismo di polling della sincronizzazione normale
        syncJobsRef.current.set(jobId, { calendarName: "Risincronizzazione Forzata" });
        setSyncJobs(prev => new Map(prev).set(jobId, { calendarName: "Risincronizzazione Forzata" }));
        
        const successMsg = `Risincronizzazione forzata avviata.`;
        addLog(successMsg, 'success');
        setSuccess(successMsg);
      } else {
        throw new Error(forceSyncResponse?.error || 'Risposta non valida dal server');
      }

    } catch (err: any) {
      const errorMsg = `Errore nella risincronizzazione forzata: ${err.message}`;
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setForceSyncing(false);
    }
  };


  return (
    <PageLayout>
      <PageLayout.Header 
        title={
          <div className="d-flex align-items-center">
            <CIcon icon={cilCalendar} className="me-2" />
            Impostazioni Automazioni per sincronizzazione
          </div>
        }
      >
      </PageLayout.Header>

      <PageLayout.ContentBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}

        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
            <div className="mt-2">Caricamento impostazioni...</div>
          </div>
        ) : (
          <>
            {/* Configurazione principale */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilSettings} className="me-2" />
                  Configurazione Automazione
                </h5>
              </CCardHeader>
              <CCardBody>
                <CRow className="align-items-center mb-3">
                  <CCol md={4} className="mb-2 mb-md-0">
                    <CFormLabel htmlFor="calendar-sync-switch">
                      Automazione attiva
                    </CFormLabel>
                    <CFormSwitch
                      id="calendar-sync-switch"
                      checked={enabled}
                      onChange={(e) => handleEnabledChange(e.target.checked)}
                      label={enabled ? 'Attiva' : 'Disattivata'}
                      className={enabled ? 'toggle-success' : 'toggle-secondary'}
                    />
                  </CCol>
                  <CCol md={4} className="mb-2 mb-md-0">
                    <CFormLabel>Orario sincronizzazione</CFormLabel>
                    <div className="d-flex gap-2 align-items-center">
                      <CFormSelect
                        value={hour}
                        onChange={(e) => setHour(Number(e.target.value))}
                        style={{ width: 80 }}
                        disabled={!enabled}
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </CFormSelect>
                      <span>:</span>
                      <CFormSelect
                        value={minute}
                        onChange={(e) => setMinute(Number(e.target.value))}
                        style={{ width: 80 }}
                        disabled={!enabled}
                      >
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>
                            {m.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </CFormSelect>
                    </div>
                  </CCol>
                  <CCol
                    md={4}
                    className="d-flex align-items-end justify-content-end"
                  >
                    <CButton
                      color="primary"
                      onClick={handleSave}
                      disabled={saving || loading}
                    >
                      {saving ? <CSpinner size="sm" /> : 'Salva Orario'}
                    </CButton>
                  </CCol>
                </CRow>

                <CRow className="mt-3">
                  <CCol md={6}>
                    <CFormLabel>Settimane da sincronizzare:</CFormLabel>
                    <CFormSelect
                      value={weeksToSync}
                      onChange={(e) => setWeeksToSync(Number(e.target.value))}
                      style={{ width: 100 }}
                    >
                      <option value={2}>2 settimane</option>
                      <option value={3}>3 settimane</option>
                      <option value={4}>4 settimane</option>
                      <option value={6}>6 settimane</option>
                      <option value={8}>8 settimane</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Database Mode:</CFormLabel>
                    <div className="d-flex align-items-center">
                      <CFormSwitch
                        id="database-mode-switch"
                        label={databaseMode === 'prod' ? 'PRODUZIONE' : 'SVILUPPO'}
                        checked={databaseMode === 'prod'}
                        onChange={(e) => handleDatabaseModeChange(e.target.checked ? 'prod' : 'dev')}
                        disabled={switchingMode || loading}
                        color="success"
                      />
                      {switchingMode && <CSpinner size="sm" className="ms-2" />}
                    </div>
                    <small className="text-muted">
                      Modalità: <strong>{databaseMode.toUpperCase()}</strong>
                    </small>
                  </CCol>
                </CRow>

                <div className="text-muted small mt-3">
                  L'automazione sincronizza ogni giorno alle{' '}
                  {hour.toString().padStart(2, '0')}:
                  {minute.toString().padStart(2, '0')} gli appuntamenti di entrambi
                  gli studi sui rispettivi calendari Google (esclusi sabato e
                  domenica). Sincronizza le prossime {weeksToSync} settimane a partire dal lunedì della settimana corrente.
                </div>
              </CCardBody>
            </CCard>

            {/* Azioni rapide */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilSync} className="me-2" />
                  Azioni Rapide
                </h5>
              </CCardHeader>
              <CCardBody>
                <CRow>
                  <CCol md={6}>
                    <CButton
                      color="success"
                      size="lg"
                      onClick={() => setShowSyncConfirm(true)} // Manteniamo la sync normale
                      disabled={syncingAll || clearingAll || syncJobs.size > 0 || clearJobs.size > 0}
                      className="w-100 mb-2"
                    >
                      {syncingAll ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Sincronizzando...
                        </>
                      ) : syncJobs.size > 0 ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Sincronizzazione in corso ({syncJobs.size})
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilSync} className="me-2" />
                          Sincronizza Tutti i Calendari
                        </>
                      )}
                    </CButton>
                  </CCol>
                  <CCol md={4}>
                    <CButton
                      color="danger"
                      size="lg"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={syncingAll || clearingAll || forceSyncing || syncJobs.size > 0 || clearJobs.size > 0}
                      className="w-100 mb-2"
                    >
                      {clearingAll ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Cancellando...
                        </>
                      ) : clearJobs.size > 0 ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Cancellazione in corso ({clearJobs.size})
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilTrash} className="me-2" />
                          Cancella Tutti i Calendari
                        </>
                      )}
                    </CButton>
                  </CCol>
                  <CCol md={2}>
                    <CButton
                      color="warning"
                      size="lg"
                      onClick={() => setShowForceSyncConfirm(true)}
                      disabled={syncingAll || clearingAll || forceSyncing || syncJobs.size > 0 || clearJobs.size > 0}
                      className="w-100 mb-2 text-white"
                    >
                      {forceSyncing ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          ...
                        </>
                      ) : syncJobs.size > 0 ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          ...
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilWarning} className="me-2" />
                          Pulisci e Sincronizza
                        </>
                      )}
                    </CButton>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Log delle azioni */}
            <CCard>
              <CCardHeader>
                <h5 className="mb-0">Log Azioni</h5>
              </CCardHeader>
              <CCardBody style={{ maxHeight: 300, overflowY: 'auto' }}>
                <ul className="mb-0" style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {log.length === 0 && (
                    <li className="text-muted">Nessuna azione recente</li>
                  )}
                  {log.map((entry, idx) => (
                    <li
                      key={idx}
                      className={
                        entry.type === 'success'
                          ? 'text-success'
                          : entry.type === 'error'
                          ? 'text-danger'
                          : 'text-secondary'
                      }
                    >
                      <span style={{ fontSize: '0.85em', marginRight: 6 }}>
                        [{entry.timestamp.toLocaleTimeString()}]
                      </span>
                      {entry.message}
                    </li>
                  ))}
                </ul>
              </CCardBody>
            </CCard>
          </>
        )}
      </PageLayout.ContentBody>

      {/* Modal di conferma sincronizzazione */}
      <CModal
        visible={showSyncConfirm}
        onClose={() => setShowSyncConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>
            <CIcon icon={cilSync} className="me-2" />
            Conferma Sincronizzazione
          </h5>
        </CModalHeader>
        <CModalBody>
          <p>
            Sincronizzare <strong>tutti i calendari</strong> con gli
            appuntamenti del mese corrente?
          </p>
          <p>Questa operazione aggiornerà:</p>
          <ul>
            <li>
              <strong>📘 Studio Blu</strong> - Calendario aziendale
            </li>
            <li>
              <strong>📒 Studio Giallo</strong> - Calendario principale
            </li>
          </ul>
          <p className="text-muted">
            Gli appuntamenti verranno sincronizzati automaticamente sui
            rispettivi calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowSyncConfirm(false)}>
            Annulla
          </CButton>
          <CButton
            color="success"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            {syncingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Sincronizzando...
              </>
            ) : (
              'Conferma Sincronizzazione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal di conferma cancellazione */}
      <CModal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>
            <CIcon icon={cilTrash} className="me-2" />
            Conferma Cancellazione
          </h5>
        </CModalHeader>
        <CModalBody>
          <CAlert color="danger">
            <strong>⚠️ ATTENZIONE:</strong> Questa operazione non può essere
            annullata!
          </CAlert>
          <p>
            Sei sicuro di voler cancellare <strong>TUTTI gli eventi</strong> da
            entrambi i calendari?
          </p>
          <p>Verranno eliminati gli eventi da:</p>
          <ul>
            <li>
              <strong>📘 Studio Blu</strong> - Tutti gli eventi presenti
            </li>
            <li>
              <strong>📒 Studio Giallo</strong> - Tutti gli eventi presenti
            </li>
          </ul>
          <p className="text-danger fw-semibold">
            Questa azione eliminerà definitivamente tutti gli appuntamenti dai
            calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowClearConfirm(false)}>
            Annulla
          </CButton>
          <CButton
            color="danger"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Cancellando...
              </>
            ) : (
              'Conferma Cancellazione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </PageLayout>
  );
};

export default CalendarSettings;
