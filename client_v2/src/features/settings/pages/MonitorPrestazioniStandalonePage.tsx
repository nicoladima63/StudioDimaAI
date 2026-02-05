import React, { useState, useEffect } from 'react';
import {
  CAlert,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilTrash,
  cilSettings,
  cilList,
  cilPlus,
  cilMediaPlay,
  cilMediaStop,
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';

import LogMonitorCard from '@/features/settings/components/monitor/LogMonitorCard';
import MappingPrestazioniCard from '@/features/settings/components/monitor/MappingPrestazioniCard';
import CreateMonitorModal from '@/features/settings/components/monitor/CreateMonitorModal';
import MonitorRulesModal from '@/features/settings/components/monitor/MonitorRulesModal';

import MonitorPrestazioniService, { MonitorLog as BackendMonitorLog, MonitorSummary } from '@/services/api/monitorPrestazioni';

interface MonitorLog extends BackendMonitorLog { }

const getBadgeColor = (status: string) => {
  switch (status) {
    case 'running': return 'success';
    case 'error': return 'danger';
    case 'stopped':
    default: return 'secondary';
  }
};

const MonitorPrestazioniStandalonePage: React.FC = () => {
  // Main State
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Selected Monitor for Rules Modal
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);

  // Delete Confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteMonitorId, setPendingDeleteMonitorId] = useState<string | null>(null);

  // Static Data
  const [monitorableTables, setMonitorableTables] = useState<{ name: string, description: string }[]>([]);


  // Initialization
  useEffect(() => {
    loadStatus();
    loadLogs();
    loadMonitorableTables();
  }, []);

  const loadMonitorableTables = async () => {
    try {
      const response = await MonitorPrestazioniService.getMonitorableTables();
      if (response.success && Array.isArray(response.data)) {
        setMonitorableTables(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching monitorable tables:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await MonitorPrestazioniService.getStatus();
      if (response.success && response.data) {
        setMonitorSummary(response.data);
      } else {
        setMonitorSummary(null);
      }
    } catch (error) {
      console.error('loadStatus error:', error);
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
      console.error('loadLogs error:', error);
    }
  };

  // --- Monitor Actions ---

  const handleStartMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;
    // Optimistic UI
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'running' };
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);
      const response = await MonitorPrestazioniService.startMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus();
      } else {
        setError(response.message || "Errore avvio monitor");
        if (originalSummary) setMonitorSummary(originalSummary);
      }
    } catch (error: any) {
      setError(error?.message || "Errore avvio monitor");
      if (originalSummary) setMonitorSummary(originalSummary);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;
    // Optimistic UI
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'stopped' };
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);
      const response = await MonitorPrestazioniService.stopMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus();
      } else {
        setError(response.message || 'Errore stop monitor');
        if (originalSummary) setMonitorSummary(originalSummary);
      }
    } catch (error: any) {
      setError(error?.message || "Errore stop monitor");
      if (originalSummary) setMonitorSummary(originalSummary);
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
      const response = await MonitorPrestazioniService.deleteMonitor(pendingDeleteMonitorId);
      if (response.success) {
        setSuccess('Monitor eliminato con successo');
        await loadStatus();
      } else {
        setError(response.message || "Errore eliminazione monitor");
      }
    } catch (err) {
      setError("Errore eliminazione monitor");
    } finally {
      setShowDeleteModal(false);
      setPendingDeleteMonitorId(null);
      setLoading(false);
    }
  };

  const openRulesForMonitor = (monitorId: string) => {
    setSelectedMonitorId(monitorId);
    setIsRulesModalOpen(true);
  };


  return (
    <PageLayout>
      <PageLayout.Header
        title='Monitoraggio e Automazioni DBF'
        headerAction={
          <CButton color="primary" onClick={() => setIsCreateModalOpen(true)}>
            <CIcon icon={cilPlus} className="me-2" />
            Nuovo Monitor
          </CButton>
        }
      />

      <div className="mt-2">
        {error && <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert>}
        {success && <CAlert color="success" dismissible onClose={() => setSuccess(null)}>{success}</CAlert>}
      </div>

      <PageLayout.ContentHeader>
        {monitorSummary ? (
          Object.keys(monitorSummary.monitors).length > 0 ? (
            <CRow className="g-4">
              {Object.entries(monitorSummary.monitors).map(([monitorId, monitor]) => (
                <CCol md={6} lg={4} xl={3} key={monitorId}>
                  <CCard className="h-100 shadow-sm border-top-primary border-top-3">
                    <CCardBody className="d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mb-0 text-truncate" title={monitor.table_name}>
                          {monitor.table_name}
                        </h5>
                        <CBadge color={getBadgeColor(monitor.status)} shape="rounded-pill">
                          {monitor.status.toUpperCase()}
                        </CBadge>
                      </div>

                      <p className="small text-muted mb-4 flex-grow-1">
                        ID: <span className="font-monospace">{monitorId}</span><br />
                        Type: {monitor.monitor_type}
                      </p>

                      <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                        <div className="d-flex gap-2">
                          {monitor.status === 'running' ? (
                            <CButton
                              color="warning"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStopMonitorById(monitorId)}
                              disabled={loading}
                              title="Ferma"
                            >
                              <CIcon icon={cilMediaStop} size="lg" />
                            </CButton>
                          ) : (
                            <CButton
                              color="success"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartMonitorById(monitorId)}
                              disabled={loading}
                              title="Avvia"
                            >
                              <CIcon icon={cilMediaPlay} size="lg" />
                            </CButton>
                          )}
                          <CButton
                            color="secondary"
                            variant="ghost"
                            size="sm"
                            onClick={() => openRulesForMonitor(monitorId)}
                            title="Gestisci Regole"
                          >
                            <CIcon icon={cilSettings} size="lg" />
                          </CButton>
                        </div>

                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => requestDeleteMonitor(monitorId)}
                          disabled={loading}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
              ))}
            </CRow>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted mb-0">Nessun monitor configurato.</p>
              <CButton color="link" onClick={() => setIsCreateModalOpen(true)}>Creane uno ora</CButton>
            </div>
          )
        ) : (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}
      </PageLayout.ContentHeader>

      {/* Mapping Section - Keep separate but cleaner */}
      <PageLayout.ContentBody>
        <h5 className="mb-3 d-flex align-items-center">
          <CIcon icon={cilList} className="me-2" /> Mappatura Prestazioni
        </h5>
        <MappingPrestazioniCard />
      </PageLayout.ContentBody>

      {/* Logs Section */}
      <PageLayout.ContentBody>
        <LogMonitorCard logs={logs} />
      </PageLayout.ContentBody>

      {/* Modals */}
      <CreateMonitorModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadStatus();
          setSuccess("Monitor creato con successo");
        }}
        monitorableTables={monitorableTables}
      />

      <MonitorRulesModal
        visible={isRulesModalOpen}
        onClose={() => {
          setIsRulesModalOpen(false);
          setSelectedMonitorId(null);
        }}
        monitorId={selectedMonitorId}
        monitorName={selectedMonitorId && monitorSummary?.monitors[selectedMonitorId] ? monitorSummary.monitors[selectedMonitorId].table_name : ''}
      />

      <CModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} backdrop="static">
        <CModalHeader>Conferma eliminazione</CModalHeader>
        <CModalBody>
          Sei sicuro di voler eliminare questo monitor?
          Questa azione è irreversibile.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setShowDeleteModal(false)}>Annulla</CButton>
          <CButton color="danger" onClick={confirmDeleteMonitor}>Elimina</CButton>
        </CModalFooter>
      </CModal>

    </PageLayout>
  );
};

export default MonitorPrestazioniStandalonePage;
