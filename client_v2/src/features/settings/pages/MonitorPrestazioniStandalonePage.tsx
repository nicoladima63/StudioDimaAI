import React, { useState, useEffect, useRef } from 'react';
import {
  CAlert,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CRow,
  CCol,
  CFormSelect,
  CFormLabel,
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


import automationApi, { type Action, type AutomationRule } from '@/features/settings/services/automation.service';
import ListaRegole from '@/features/settings/components/monitor/ListaRegole';

import LogMonitorCard from '@/features/settings/components/monitor/LogMonitorCard';
import CallbackCard from '@/features/settings/components/monitor/CallbackCard';
import AssociaRegolaCard from '@/features/settings/components/monitor/AssociaRegolaCard';
import TriggerSourceSelector, { Trigger } from '@/features/settings/components/monitor/TriggerSourceSelector';

import MonitorPrestazioniService, { MonitorLog as BackendMonitorLog, MonitorSummary } from '@/services/api/monitorPrestazioni';

interface MonitorLog extends BackendMonitorLog { }

const getBadgeColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'error':
      return 'danger';
    case 'stopped':
    default:
      return 'secondary';
  }
};

const MonitorPrestazioniStandalonePage: React.FC = () => {
  // Stati principali
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stato per il monitor selezionato (master-detail)
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);

  // Conferma eliminazione
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteMonitorId, setPendingDeleteMonitorId] = useState<string | null>(null);

  // Stati per la creazione/modifica di regole
  const [actions, setActions] = useState<Action[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [selectedActionParams, setSelectedActionParams] = useState<any | null>(null);
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);

  const selectedActionIdRef = useRef(selectedActionId);
  selectedActionIdRef.current = selectedActionId;

  // Stati per creazione monitor
  const [monitorTableName, setMonitorTableName] = useState('preventivi');
  const [monitorType, setMonitorType] = useState('file_watcher');
  const [monitorableTables, setMonitorableTables] = useState<{ name: string, description: string }[]>([]);

  // Carica stato iniziale
  useEffect(() => {
    loadStatus();
    loadLogs();
    // loadActions() rimosso - viene caricato da loadMonitorDetails quando si seleziona un monitor
    loadMonitorableTables();
  }, []);

  // Carica le regole e azioni per il monitor selezionato (API unificata)
  useEffect(() => {
    if (selectedMonitorId) {
      setRules([]); // Pulisci le regole precedenti
      loadMonitorDetails(selectedMonitorId);
    } else {
      setRules([]); // Nessun monitor selezionato
    }
  }, [selectedMonitorId]);

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

  const handleStartMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;

    // Optimistic UI update
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) {
        newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'running' };
      }
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);
      setError(null);

      const response = await MonitorPrestazioniService.startMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus(); // Resync with the server's actual state
      } else {
        setError(response.message || "Errore nell'avvio del monitor");
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error: any) {
      setError(error?.message || "Errore nell'avvio del monitor");
      if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      console.error('handleStartMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;

    // Optimistic UI update
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) {
        newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'stopped' };
      }
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);
      setError(null);

      const response = await MonitorPrestazioniService.stopMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus(); // Resync
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error: any) {
      setError(error?.message || "Errore nella fermata del monitor");
      if (originalSummary) setMonitorSummary(originalSummary); // Rollback
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


  /**
   * Carica dettagli completi del monitor (status + regole + azioni) in una sola chiamata API
   * Ottimizzazione per ridurre le chiamate di rete
   */
  const loadMonitorDetails = async (monitorId: string) => {
    try {
      const response = await MonitorPrestazioniService.getMonitorDetails(monitorId);
      if (response.success && response.data) {
        setRules(response.data.rules);
        setActions(response.data.actions);
        // Il monitor status viene già gestito da loadStatus
      }
    } catch (e) {
      console.error('Errore caricamento dettagli monitor', e);
      setError('Impossibile caricare i dettagli del monitor.');
    }
  };

  const handleCreateMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("handleCreateMonitor: Attempting to create monitor with table_name:", monitorTableName, "and monitor_type:", monitorType);
      const payload: any = {
        table_name: monitorTableName,
        monitor_type: monitorType,
        auto_start: false, // Always create as not auto-starting, user can start manually
      };

      // --- LOGICA DI ARRICCHIMENTO DINAMICA ---
      // Se stiamo creando un monitor per la tabella 'preventivi', aggiungiamo i metadati
      // per l'arricchimento con l'ID del paziente.
      if (monitorTableName === 'preventivi') {
        payload.metadata = {
          enrichment: {
            source_field: "DB_PRELCOD",
            target_table: "ELENCO.DBF",
            target_key_field: "DB_CODE",
            target_value_field: "DB_ELPACOD",
            "new_field_name": "id_paziente"
          }
        };
        console.log("handleCreateMonitor: Aggiunti metadati di arricchimento per 'preventivi'", payload.metadata);
      }
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

  const handleActionChange = (newActionId: number | null) => {
    if (newActionId !== selectedActionIdRef.current) {
      setSelectedActionParams(null);
    }
    setSelectedActionId(newActionId);
  };

  const handleEditRegola = (rule: AutomationRule) => {
    // Pre-compila gli stati per l'edit
    setEditingRule(rule);
    setSelectedActionId(rule.action_id);
    setSelectedActionParams(rule.action_params || {});
    // Imposta il trigger se disponibile nella regola
    if (rule.trigger_type && rule.trigger_id) {
      setTrigger({ type: rule.trigger_type, id: String(rule.trigger_id), name: rule.trigger_id });
    }
    // Apri il modale dei parametri
    setIsParamsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setTrigger(null);
    setSelectedActionId(null);
    setSelectedActionParams(null);
  };

  const handleAssocia = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (editingRule) {
      // --- LOGICA DI AGGIORNAMENTO ---
      if (!selectedActionId) {
        setError("Seleziona un'azione.");
        return;
      }
      try {
        setLoading(true);
        const payload = {
          action_id: selectedActionId,
          action_params: selectedActionParams || {},
        };
        await automationApi.updateRule(editingRule.id, payload);
        setSuccess('Regola aggiornata con successo');
        handleCancelEdit();
        if (selectedMonitorId) await loadMonitorDetails(selectedMonitorId);
      } catch (e: any) {
        setError(e?.message || 'Errore durante l\'aggiornamento della regola.');
      }
      finally {
        setLoading(false);
      }
    } else {
      // --- LOGICA DI CREAZIONE ---
      if (!trigger || !selectedActionId || !selectedMonitorId) {
        setError("Seleziona un trigger, un'azione e un monitor prima di associare.");
        return;
      }

      const selectedAction = actions.find(a => a.id === selectedActionId);
      if (!selectedAction) return;

      try {
        setLoading(true);
        const payload = {
          name: `Regola per ${trigger.name} - ${selectedAction.name}`,
          description: `Associazione automatica per trigger ${trigger.type}: ${trigger.name}`,
          trigger_type: trigger.type,
          trigger_id: trigger.id,
          action_id: selectedActionId,
          action_params: selectedActionParams || {},
          attiva: true,
          priorita: 10,
          monitor_id: selectedMonitorId,
        };
        await automationApi.createRule(payload);
        setSuccess('Regola di automazione creata con successo');
        handleCancelEdit(); // Usa la stessa funzione per resettare il form
        await loadMonitorDetails(selectedMonitorId);
      } catch (e: any) {
        setError(e?.message || 'Errore creazione regola di automazione');
      }
      finally {
        setLoading(false);
      }
    }
  };
  const handleToggleRegola = async (id: number) => {
    try {
      await automationApi.toggleRule(id);
      if (selectedMonitorId) await loadMonitorDetails(selectedMonitorId);
    } catch (e) {
      console.error('Errore toggle regola', e);
    }
  };

  const handleDeleteRegola = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa regola di automazione?')) return;
    try {
      await automationApi.deleteRule(id);
      if (selectedMonitorId) await loadMonitorDetails(selectedMonitorId);
    } catch (e) {
      console.error('Errore eliminazione regola', e);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header
        title='Monitoraggio e Automazioni DBF'
      />

      <div className="mt-2">
        {error && <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert>}
        {success && <CAlert color="success" dismissible onClose={() => setSuccess(null)}>{success}</CAlert>}
      </div>

      {/* Area 1: Gestione Monitor */}
      <PageLayout.ContentHeader>
        <CCard className='mb-4'>
          <CCardHeader>
            <h5 className='mb-0'>
              <CIcon icon={cilPlus} className='me-2' />
              Crea Nuovo Monitor
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
                  disabled={loading || monitorableTables.length === 0}>
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
                  disabled={loading}>
                  <option value='file_watcher'>File Watcher (in tempo reale)</option>
                </CFormSelect>
              </CCol>
              <CCol md={4}>
                <CButton
                  color='primary'
                  onClick={handleCreateMonitor}
                  disabled={loading || !monitorTableName || !monitorType}>
                  <CIcon icon={cilPlus} className='me-1' />
                  Crea Monitor
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

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
                    <CCol md={4} lg={3} key={monitorId} className='mb-3'>
                      <CCard className={`h-100 ${selectedMonitorId === monitorId ? 'border-primary border-2' : ''}`}>
                        <CCardBody className='d-flex flex-column'>
                          <div className='d-flex justify-content-between align-items-start mb-2'>
                            <h6 className='mb-0'>{monitor.table_name}</h6>
                            <CBadge color={getBadgeColor(monitor.status)}>
                              {monitor.status}
                            </CBadge>
                          </div>
                          <p className='small text-muted mb-1'>ID: {monitorId}</p>
                          <div className='mt-auto'>
                            <div className='d-flex justify-content-between align-items-center mt-3'>
                              <CButton
                                color='primary'
                                variant='outline'
                                size='sm'
                                onClick={() => setSelectedMonitorId(monitorId)}>
                                <CIcon icon={cilSettings} className='me-1' />
                                Gestisci
                              </CButton>
                              <div className='d-flex gap-1'>
                                {monitor.status === 'running' ? (
                                  <CButton
                                    color='warning'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => handleStopMonitorById(monitorId)}
                                    disabled={loading}
                                    title="Ferma monitor">
                                    <CIcon icon={cilMediaStop} />
                                  </CButton>
                                ) : (
                                  <CButton
                                    color='success'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => handleStartMonitorById(monitorId)}
                                    disabled={loading}
                                    title="Avvia monitor">
                                    <CIcon icon={cilMediaPlay} />
                                  </CButton>
                                )}
                                <CButton
                                  color='danger'
                                  size='sm'
                                  variant='outline'
                                  onClick={() => requestDeleteMonitor(monitorId)}
                                  disabled={loading}
                                  title="Elimina monitor">
                                  <CIcon icon={cilTrash} />
                                </CButton>
                              </div>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  ))}
                </CRow>
              ) : (
                <p className='text-muted'>Nessun monitor configurato. Creane uno per iniziare.</p>
              )}
            </CCardBody>
          </CCard>
        )}
      </PageLayout.ContentHeader>

      {/* Area 2: Dettaglio Regole del Monitor Selezionato */}
      {selectedMonitorId && (
        <PageLayout.ContentBody>
          <CCard className='mb-4'>
            <CCardHeader>
              <div className='d-flex justify-content-between align-items-center'>
                <h5 className='mb-0'>
                  <CIcon icon={cilList} className='me-2' />
                  Gestione Regole per: <span className='fw-bold'>{monitorSummary?.monitors[selectedMonitorId]?.table_name}</span>
                </h5>
                <CButton variant='ghost' color='secondary' size='sm' onClick={() => setSelectedMonitorId(null)}>Chiudi</CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              <CRow>
                {/* Colonna Sinistra: Creazione/Modifica Regola */}
                <CCol md={4}>
                  <h6 className='mb-3'>Crea Nuova Regola</h6>
                  <TriggerSourceSelector
                    onChange={setTrigger}
                  />
                  <CRow>
                    <CCol md={8}>
                      <CallbackCard
                        actions={actions}
                        selectedActionId={selectedActionId}
                        onActionChange={handleActionChange}
                        initialParams={selectedActionParams}
                        onParamsChange={setSelectedActionParams}
                        isModalOpen={isParamsModalOpen}
                        setIsModalOpen={setIsParamsModalOpen}
                      />
                    </CCol>
                    <CCol md={4}>
                      <div className='d-flex align-items-center'>
                        <AssociaRegolaCard
                          onAssocia={handleAssocia}
                          disabled={(!trigger && !editingRule) || !selectedActionId || loading}
                        />
                        {editingRule && (
                          <CButton color="secondary" variant="outline" onClick={handleCancelEdit} className="ms-3">
                            Annulla
                          </CButton>
                        )}
                      </div>
                    </CCol>
                  </CRow>
                </CCol>

                {/* Colonna Destra: Lista Regole */}
                <CCol md={8}>
                  <h6 className='mb-3 fw-bold'>Regole associate per questo Monitor</h6>
                  <ListaRegole
                    rules={rules}
                    onToggle={handleToggleRegola}
                    onDelete={handleDeleteRegola}
                    onEdit={handleEditRegola}
                    loading={loading}
                  />
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>
        </PageLayout.ContentBody>
      )}

      <PageLayout.ContentBody>
        <LogMonitorCard logs={logs} />
        <CModal visible={showDeleteModal} onClose={cancelDeleteMonitor} backdrop='static'>
          <CModalHeader>Conferma eliminazione</CModalHeader>
          <CModalBody>
            Sei sicuro di voler eliminare questo monitor?
            {pendingDeleteMonitorId && <small className='text-muted d-block'>ID: {pendingDeleteMonitorId}</small>}
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
