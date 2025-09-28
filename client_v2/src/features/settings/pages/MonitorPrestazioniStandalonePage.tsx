import React, { useState, useEffect, useCallback } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormTextarea ,
  CRow,
  CCol,
  CFormSelect,
  CFormLabel,
  CFormInput,
  CCard,
  CCardHeader,
  CCardBody,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilTrash,
  cilReload,
  cilSettings,
  cilList,
  cilPlus,
  cilMediaPlay,
  cilMediaStop,
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';

import apiClient from '@/services/api/client';
import { Prestazione } from '@/store/prestazioni.store'
import automationApi, { type Action, type AutomationRule } from '@/features/settings/services/automation.service';
import ListaRegole from '@/features/settings/components/monitor/ListaRegole';
import StatoMonitorCard from '@/features/settings/components/monitor/StatoMonitorCard';
import LogMonitorCard from '@/features/settings/components/monitor/LogMonitorCard';
import GestioneRegoleCard from '@/features/settings/components/monitor/GestioneRegoleCard';
import CallbackCard from '@/features/settings/components/monitor/CallbackCard';
import AssociaRegolaCard from '@/features/settings/components/monitor/AssociaRegolaCard';

import MonitorPrestazioniService, { MonitorLog as BackendMonitorLog, MonitorSummary } from '@/services/api/monitorPrestazioni';

interface MonitorLog extends BackendMonitorLog {}

interface MonitorableTable {
  name: string;
  description: string;
}

const MonitorPrestazioniStandalonePage: React.FC = () => {
  // Stati principali
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Conferma eliminazione
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteMonitorId, setPendingDeleteMonitorId] = useState<string | null>(null);
  
  // Stati per selezione prestazioni e automazioni
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [selectedActionParams, setSelectedActionParams] = useState<any | null>(null);

  // Stati per creazione monitor
  const [monitorTableName, setMonitorTableName] = useState('preventivi');
  const [monitorType, setMonitorType] = useState('file_watcher');
  const [monitorableTables, setMonitorableTables] = useState<{name: string, description: string}[]>([]);

  // Modal per configurazione parametri azione (se l'azione selezionata li richiede)
  const [showActionParamsModal, setShowActionParamsModal] = useState(false);
  const [currentActionConfig, setCurrentActionConfig] = useState<any>({});

  // Carica stato iniziale
  useEffect(() => {
    loadStatus();
    loadLogs();
    loadActions();
    loadRules();
    loadMonitorableTables();
  }, []);

  const loadMonitorableTables = async () => {
    try {
      const response = await MonitorPrestazioniService.getMonitorableTables();
      if (response.success && Array.isArray(response.data)) {
        setMonitorableTables(response.data);
        if (!monitorTableName && response.data.length > 0) {
          setMonitorTableName(response.data[0].name);
        }
      } else {
        console.error('Failed to load monitorable tables:', response.message);
        setError(response.message || 'Impossibile caricare la lista delle tabelle monitorabili.');
      }
    } catch (error: any) {
      console.error('Error fetching monitorable tables:', error);
      setError(error.message || 'Impossibile caricare la lista delle tabelle monitorabili.');
    }
  };

  const loadStatus = async () => {
    try {
      console.log("loadStatus: Fetching monitor status...");
      const response = await MonitorPrestazioniService.getStatus();
      console.log("loadStatus: API Response:", response);

      if (response.success && response.data) {
        console.log("loadStatus: Setting monitor summary to:", response.data);
        setMonitorSummary(response.data);
        
        // Se non c'è un monitor selezionato, seleziona il primo disponibile
        if (!selectedMonitorId && response.data.monitors) {
          const monitorIds = Object.keys(response.data.monitors);
          if (monitorIds.length > 0) {
            setSelectedMonitorId(monitorIds[0]);
          }
        }
      } else {
        console.log("loadStatus: API response not successful or no monitor data.", response);
        setMonitorSummary(null);
      }
    } catch (error) {
      console.error('loadStatus: Errore nel caricamento dello stato:', error);
      setMonitorSummary(null);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await MonitorPrestazioniService.getLogs();
      if (response.success && response.data) {
        setLogs(response.data.logs || []);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei log:', error);
    }
  };

  const handleStartMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("handleStartMonitor: Current selectedMonitorId:", selectedMonitorId);

      if (!selectedMonitorId) {
        setError("Monitor ID non disponibile. Seleziona un monitor dalla lista.");
        setLoading(false);
        return;
      }

      const response = await MonitorPrestazioniService.startMonitor(selectedMonitorId);
      console.log("handleStartMonitor: Response from startMonitor API:", response);

      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus(); // Reload status to pick up the new monitor state
        await loadLogs();
        console.log("handleStartMonitor: Status after loadStatus (successful start):");
      } else {
        setError(response.message || "Errore nell'avvio del monitor");
        console.log("handleStartMonitor: Error response from startMonitor API:", response);
      }
    } catch (error) {
      setError("Errore nell'avvio del monitor");
      console.error('handleStartMonitor: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitor = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("handleStopMonitor: Current selectedMonitorId:", selectedMonitorId);

      if (!selectedMonitorId) {
        setError("Monitor ID non disponibile. Seleziona un monitor dalla lista.");
        setLoading(false);
        return;
      }
      
      const response = await MonitorPrestazioniService.stopMonitor(selectedMonitorId);
      console.log("handleStopMonitor: Response from stopMonitor API:", response);

      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus();
        await loadLogs();
        console.log("handleStopMonitor: Status after loadStatus (successful stop):");
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
        console.log("handleStopMonitor: Error response from stopMonitor API:", response);
      }
    } catch (error) {
      setError('Errore nella fermata del monitor');
      console.error('handleStopMonitor: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.testMonitor();
      if (response.success) {
        setSuccess('Test monitor completato');
        await loadLogs();
      } else {
        setError(response.message || 'Errore nel test del monitor');
      }
    } catch (error) {
      setError('Errore nel test del monitor');
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      setError(null);
      
      const response = await MonitorPrestazioniService.clearLogs();
      if (response.success) {
        setSuccess('Log puliti con successo');
        await loadLogs();
      } else {
        setError(response.message || 'Errore nella pulizia dei log');
      }
    } catch (error) {
      setError('Errore nella pulizia dei log');
      console.error('Errore:', error);
    }
  };

  const handleStartMonitorById = async (monitorId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.startMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || "Errore nell'avvio del monitor");
      }
    } catch (error) {
      setError("Errore nell'avvio del monitor");
      console.error('handleStartMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitorById = async (monitorId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.stopMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
      }
    } catch (error) {
      setError('Errore nella fermata del monitor');
      console.error('handleStopMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteMonitor = (monitorId: string) => {
    setPendingDeleteMonitorId(monitorId);
    setShowDeleteModal(true);
  };

  const confirmDeleteMonitor = async () => {
    if (!pendingDeleteMonitorId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await MonitorPrestazioniService.deleteMonitor(pendingDeleteMonitorId);
      if (response.success) {
        setSuccess('Monitor eliminato con successo');
        await loadStatus();
        if (selectedMonitorId === pendingDeleteMonitorId) {
          setSelectedMonitorId(null);
        }
      } else {
        setError(response.message || "Errore nell'eliminazione del monitor");
      }
    } catch (err) {
      setError("Errore nell'eliminazione del monitor");
      console.error('confirmDeleteMonitor: Caught exception:', err);
    } finally {
      setShowDeleteModal(false);
      setPendingDeleteMonitorId(null);
      setLoading(false);
    }
  };

  const cancelDeleteMonitor = () => {
    setShowDeleteModal(false);
    setPendingDeleteMonitorId(null);
  };

  const refreshLogs = () => {
    loadLogs();
  };

  const loadActions = async () => {
    try {
      const data = await automationApi.getActions();
      setActions(data);
    } catch (e) {
      console.error('Errore caricamento azioni', e);
    }
  };

  const loadRules = async () => {
    try {
      const data = await automationApi.getRules();
      setRules(data);
    } catch (e) {
      console.error('Errore caricamento regole di automazione', e);
    }
  };

  const handleCreateMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("handleCreateMonitor: Attempting to create monitor with table_name:", monitorTableName, "and monitor_type:", monitorType);
      const payload = {
        table_name: monitorTableName,
        monitor_type: monitorType,
        auto_start: false, // Always create as not auto-starting, user can start manually
      };
      const response = await MonitorPrestazioniService.createMonitor(payload);
      console.log("handleCreateMonitor: Response from createMonitor API:", response);

      if (response.success && response.data) {
        setSuccess(`Monitor per ${monitorTableName} creato con successo! ID: ${response.data.monitor_id}`);
        await loadStatus(); // Reload status to pick up the new monitor
        console.log("handleCreateMonitor: loadStatus called after successful creation.");
      } else {
        setError(response.message || 'Errore nella creazione del monitor');
        console.log("handleCreateMonitor: Error response from createMonitor API:", response);
      }
    } catch (e: any) {
      setError(e?.message || 'Errore nella creazione del monitor');
      console.error('handleCreateMonitor: Caught exception:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssocia = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedPrestazione || !selectedActionId) return;

    const selectedAction = actions.find(a => a.id === selectedActionId);
    if (!selectedAction) return;

    // Se l'azione richiede parametri, apri il modal per configurarli
    if (selectedAction.parameters && selectedAction.parameters.length > 0 && !selectedActionParams) {
      setCurrentActionConfig({ action: selectedAction, prestazione: selectedPrestazione });
      setShowActionParamsModal(true);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: `Regola per ${selectedPrestazione.nome} - ${selectedAction.name}`,
        description: `Associazione automatica per prestazione ${selectedPrestazione.nome}`,
        trigger_type: "prestazione",
        trigger_id: String(selectedPrestazione.id), // Assicurati che sia una stringa
        action_id: selectedActionId,
        action_params: selectedActionParams || {}, // Usa i parametri configurati o un oggetto vuoto
        attiva: true,
        priorita: 10,
      };
      await automationApi.createRule(payload);
      setSuccess('Regola di automazione creata con successo');
      setSelectedActionId(null);
      setSelectedActionParams(null);
      await loadRules();
    } catch (e: any) {
      setError(e?.message || 'Errore creazione regola di automazione');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRegola = async (id: number) => {
    try {
      await automationApi.toggleRule(id);
      await loadRules();
    } catch (e) {
      console.error('Errore toggle regola', e);
    }
  };

  const handleDeleteRegola = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa regola di automazione?')) return;
    try {
      await automationApi.deleteRule(id);
      await loadRules();
    } catch (e) {
      console.error('Errore eliminazione regola', e);
    }
  };

  const handleActionParamsSave = useCallback((params: any) => {
    setSelectedActionParams(params);
    setShowActionParamsModal(false);
  }, []);

  return (
    <PageLayout>
      <PageLayout.Header 
        title='Monitor Prestazioni DBF'
        headerAction={
          <div className='d-flex gap-2'>
            <CButton color='info' onClick={refreshLogs} disabled={loading} size='sm'>
              <CIcon icon={cilReload} className='me-1' />
              Aggiorna Log
            </CButton>
            <CButton color='warning' onClick={handleTestMonitor} disabled={loading} size='sm'>
              <CIcon icon={cilSettings} className='me-1' />
              Test
            </CButton>
            <CButton color='danger' onClick={clearLogs} disabled={loading} size='sm'>
              <CIcon icon={cilTrash} className='me-1' />
              Pulisci Log
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <CRow>
          <CCol md={3}>
            <GestioneRegoleCard 
              selectedPrestazione={selectedPrestazione}
              onPrestazioneChange={setSelectedPrestazione}
            />
          </CCol>
          <CCol md={3}>
            <CallbackCard 
              actions={actions}
              selectedActionId={selectedActionId}
              onActionChange={setSelectedActionId}
              onConfigureActionParams={() => {
                const selectedAction = actions.find(a => a.id === selectedActionId);
                if (selectedAction && selectedAction.parameters && selectedAction.parameters.length > 0) {
                  setCurrentActionConfig({ action: selectedAction, prestazione: selectedPrestazione, initialParams: selectedActionParams });
                  setShowActionParamsModal(true);
                }
              }}
            />
          </CCol>
          <CCol md={1}>
            <AssociaRegolaCard 
              onAssocia={handleAssocia}
              disabled={!selectedPrestazione || !selectedActionId || loading}
            />
          </CCol>
          <CCol md={5}>
            <CCard className='mb-4'>
              <CCardHeader>
                <h5 className='mb-0'>
                  <CIcon icon={cilList} className='me-2' />
                  Regole di Automazione
                </h5>
              </CCardHeader>
              <CCardBody>
                <ListaRegole 
                  rules={rules} // Pass the new 'rules' data
                  onToggle={handleToggleRegola}
                  onDelete={handleDeleteRegola}
                  loading={loading}
                />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </PageLayout.ContentHeader>

      {/* Sezione per la creazione del monitor */}
      <PageLayout.ContentHeader>
        <CRow>
          <CCol md={12}>
            <CCard className='mb-4'>
              <CCardHeader>
                <h5 className='mb-0'>
                  <CIcon icon={cilPlus} className='me-2' />
                  Gestione Monitor DBF
                </h5>
              </CCardHeader>
              <CCardBody>
                <CRow className='g-3 align-items-end'>
                  <CCol md={4}>
                    <CFormLabel htmlFor='monitorTableName'>Tabella DBF da Monitorare</CFormLabel>
                    <CFormSelect
                      id='monitorTableName'
                      value={monitorTableName}
                      onChange={(e) => setMonitorTableName(e.target.value)}
                      disabled={loading || monitorableTables.length === 0}
                    >
                      {monitorableTables.length === 0 ? (
                        <option>Caricamento tabelle...</option>
                      ) : (
                        monitorableTables.map(table => (
                          <option key={table.name} value={table.name}>
                            {table.name} ({table.description})
                          </option>
                        ))
                      )}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel htmlFor='monitorType'>Tipo di Monitoraggio</CFormLabel>
                    <CFormSelect
                      id='monitorType'
                      value={monitorType}
                      onChange={(e) => setMonitorType(e.target.value)}
                      disabled={loading}
                    >
                      <option value='file_watcher'>File Watcher (in tempo reale)</option>
                      {/* Aggiungere altri tipi se necessario */}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CButton 
                      color='primary' 
                      onClick={handleCreateMonitor} 
                      disabled={loading || !monitorTableName || !monitorType}
                    >
                      <CIcon icon={cilPlus} className='me-1' />
                      Crea Monitor
                    </CButton>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </PageLayout.ContentHeader>

      {/* Modal per configurazione parametri azione */}
      <CModal visible={showActionParamsModal} onClose={() => setShowActionParamsModal(false)} backdrop='static'>
        <CModalHeader>Configura Parametri Azione: {currentActionConfig.action?.name}</CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel>Slug della Pagina di Destinazione (es. promozione)</CFormLabel>
            <CFormInput 
              value={currentActionConfig.initialParams?.page_slug || ''}
              onChange={(e) => {
                setCurrentActionConfig((prev: any) => ({
                  ...prev,
                  initialParams: { ...prev.initialParams, page_slug: e.target.value }
                }));
              }}
              placeholder='es. promozione'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Chiave del Modello SMS (es. promozione_speciale)</CFormLabel>
            <CFormInput 
              value={currentActionConfig.initialParams?.template_key || ''}
              onChange={(e) => {
                setCurrentActionConfig((prev: any) => ({
                  ...prev,
                  initialParams: { ...prev.initialParams, template_key: e.target.value }
                }));
              }}
              placeholder='es. promozione_speciale'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Mittente SMS (opzionale, default: StudioDima)</CFormLabel>
            <CFormInput 
              value={currentActionConfig.initialParams?.sender || 'StudioDima'}
              onChange={(e) => {
                setCurrentActionConfig((prev: any) => ({
                  ...prev,
                  initialParams: { ...prev.initialParams, sender: e.target.value }
                }));
              }}
              placeholder='es. StudioDima'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Parametri URL Aggiuntivi (JSON, opzionale)</CFormLabel>
            <CFormTextarea 
              rows={3} 
              value={currentActionConfig.initialParams?.url_params ? JSON.stringify(currentActionConfig.initialParams.url_params, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  setCurrentActionConfig((prev: any) => ({
                    ...prev,
                    initialParams: { ...prev.initialParams, url_params: parsed }
                  }));
                } catch (jsonError) {
                  // Handle invalid JSON input, maybe show an error message
                  console.error("Invalid JSON for url_params", jsonError);
                }
              }}
              placeholder='{ "codice_paziente": "{DB_APCODP}" }'
            />
            <small className='text-muted'>
              JSON di coppie chiave-valore. I valori possono essere placeholder come {'{{DB_APCODP}}'} che verranno sostituiti dai dati del contesto.
              Questo campo è opzionale.
            </small>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowActionParamsModal(false)}>Annulla</CButton>
          <CButton color='primary' onClick={() => handleActionParamsSave(currentActionConfig.initialParams)}>Salva Parametri</CButton>
        </CModalFooter>
      </CModal>

      <PageLayout.ContentBody>
        {/* Lista Monitor */}
        {monitorSummary && (
          <CCard className='mb-4'>
            <CCardHeader>
              <h5 className='mb-0'>
                <CIcon icon={cilList} className='me-2' />
                Monitor Configurati ({monitorSummary.total_monitors})
              </h5>
            </CCardHeader>
            <CCardBody>
              {Object.keys(monitorSummary.monitors).length > 0 ? (
                <CRow>
                  {Object.entries(monitorSummary.monitors).map(([monitorId, monitor]) => (
                    <CCol md={6} lg={4} key={monitorId} className='mb-3'>
                      <CCard 
                        className={`h-100 ${selectedMonitorId === monitorId ? 'border-primary' : ''}`}
                      >
                        <CCardBody>
                          <div className='d-flex justify-content-between align-items-start mb-2'>
                            <h6 className='mb-0'>{monitor.table_name}</h6>
                            <CBadge color={monitor.status === 'running' ? 'success' : 'secondary'}>
                              {monitor.status}
                            </CBadge>
                          </div>
                          <p className='small text-muted mb-1'>
                            Tipo: {monitor.config.monitor_type}
                          </p>
                          <p className='small text-muted mb-1'>
                            File: {monitor.config.file_path.split('\\').pop()}
                          </p>
                          <p className='small text-muted mb-1'>
                            Intervallo: {monitor.config.interval_seconds}s
                          </p>
                          {/* Sezione riepilogo regole/azioni attive */}
                          {(monitor as any).rules_summary && (
                            <div className='small text-muted mb-2'>
                              <div>
                                Regole attive: <strong>{(monitor as any).rules_summary.active_rules}</strong>
                              </div>
                              {(monitor as any).rules_summary.example_actions && (monitor as any).rules_summary.example_actions.length > 0 && (
                                <div>
                                  Azioni: {(monitor as any).rules_summary.example_actions.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                          <div className='d-flex justify-content-between mb-3'>
                            <small className='text-muted'>
                              Cambiamenti: {monitor.change_count}
                            </small>
                            <small className='text-muted'>
                              Errori: {monitor.error_count}
                            </small>
                          </div>
                          
                          {/* Pulsanti di controllo */}
                          <div className='d-flex gap-2 justify-content-between'>
                            <div className='d-flex gap-1'>
                              {monitor.status === 'running' ? (
                                <CButton 
                                  color='warning'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStopMonitorById(monitorId);
                                  }}
                                  disabled={loading}
                                >
                                  <CIcon icon={cilMediaStop} className='me-1' />
                                  Stop
                                </CButton>
                              ) : (
                                <CButton 
                                  color='success'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartMonitorById(monitorId);
                                  }}
                                  disabled={loading}
                                >
                                  <CIcon icon={cilMediaPlay} className='me-1' />
                                  Avvia
                                </CButton>
                              )}
                            </div>
                            
                            <div className='d-flex gap-1'>
                              <CButton 
                                color='danger'
                                size='sm'
                                variant='outline'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteMonitor(monitorId);
                                }}
                                disabled={loading}
                              >
                                <CIcon icon={cilTrash} className='me-1' />
                                Elimina
                              </CButton>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  ))}
                </CRow>
              ) : (
                <p className='text-muted'>Nessun monitor configurato.</p>
              )}
            </CCardBody>
          </CCard>
        )}

        {/* Controlli Monitor Selezionato */}
        {selectedMonitorId && monitorSummary?.monitors[selectedMonitorId] && (
          <StatoMonitorCard 
            status={monitorSummary.monitors[selectedMonitorId]}
            loading={loading}
            error={error}
            success={success}
            onStart={handleStartMonitor}
            onStop={handleStopMonitor}
            onTest={handleTestMonitor}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
          />
        )}

        <LogMonitorCard logs={logs} />
        
        {/* Modal conferma eliminazione monitor */}
        <CModal visible={showDeleteModal} onClose={cancelDeleteMonitor} backdrop='static'>
          <CModalHeader>Conferma eliminazione</CModalHeader>
          <CModalBody>
            Sei sicuro di voler eliminare questo monitor?
            {pendingDeleteMonitorId && (
              <>
                <br />
                <small className='text-muted'>ID: {pendingDeleteMonitorId}</small>
              </>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={cancelDeleteMonitor} disabled={loading}>Annulla</CButton>
            <CButton color='danger' onClick={confirmDeleteMonitor} disabled={loading}>
              <CIcon icon={cilTrash} className='me-1' /> Elimina
            </CButton>
          </CModalFooter>
        </CModal>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default MonitorPrestazioniStandalonePage;
