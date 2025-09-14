import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CBadge,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormSelect,
  CFormInput,
  CFormLabel,
  CFormSwitch,
  CRow,
  CCol,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { 
  cilMonitor, 
  cilMediaPlay, 
  cilMediaStop, 
  cilPlus, 
  cilTrash, 
  cilReload
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { monitoringService } from '../services/monitoring.service';

// Tipi per il sistema di monitoraggio
interface MonitorConfig {
  monitor_id: string;
  table_name: string;
  monitor_type: 'periodic_check' | 'real_time' | 'file_watcher';
  interval_seconds: number;
  enabled: boolean;
  auto_start: boolean;
  callback_functions: string[];
  metadata: Record<string, any>;
}

interface MonitorInstance {
  config: MonitorConfig;
  status: 'stopped' | 'running' | 'paused' | 'error';
  last_check?: string;
  last_change?: string;
  change_count: number;
  error_count: number;
  created_at: string;
}

interface MonitorStatus {
  total_monitors: number;
  active_monitors: number;
  monitors: Record<string, {
    status: string;
    table_name: string;
    monitor_type: string;
    last_check?: string;
    change_count: number;
  }>;
}

const MonitoringSettings: React.FC = () => {
  // Stati principali
  const [monitors, setMonitors] = useState<MonitorInstance[]>([]);
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stati per modal creazione
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMonitor, setNewMonitor] = useState({
    table_name: 'appointments',
    monitor_type: 'periodic_check' as const,
    interval_seconds: 30,
    auto_start: true,
    callback_functions: [] as string[],
  });

  // Stati per azioni
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Carica dati iniziali
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [monitorsResponse, statusResponse] = await Promise.all([
        monitoringService.getAllMonitors(),
        monitoringService.getStatus()
      ]);

      if (monitorsResponse.success && monitorsResponse.data) {
        setMonitors(monitorsResponse.data);
      }

      if (statusResponse.success && statusResponse.data) {
        setStatus(statusResponse.data);
      }

    } catch (err) {
      setError('Errore nel caricamento dei dati');
      console.error('Error loading monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMonitor = async () => {
    try {
      setActionLoading('create');
      setError(null);

      const response = await monitoringService.createMonitor(newMonitor);
      
      if (response.success) {
        setSuccess('Monitor creato con successo');
        setShowCreateModal(false);
        setNewMonitor({
          table_name: 'appointments',
          monitor_type: 'periodic_check',
          interval_seconds: 30,
          auto_start: true,
          callback_functions: [],
        });
        await loadData();
      } else {
        setError(response.message || 'Errore nella creazione del monitor');
      }

    } catch (err) {
      setError('Errore nella creazione del monitor');
      console.error('Error creating monitor:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartMonitor = async (monitorId: string) => {
    try {
      setActionLoading(monitorId);
      setError(null);

      const response = await monitoringService.startMonitor(monitorId);
      
      if (response.success) {
        setSuccess(response.message || 'Monitor avviato con successo');
        await loadData();
      } else {
        setError(response.message || 'Errore nell\'avvio del monitor');
      }

    } catch (err) {
      setError('Errore nell\'avvio del monitor');
      console.error('Error starting monitor:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopMonitor = async (monitorId: string) => {
    try {
      setActionLoading(monitorId);
      setError(null);

      const response = await monitoringService.stopMonitor(monitorId);
      
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadData();
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
      }

    } catch (err) {
      setError('Errore nella fermata del monitor');
      console.error('Error stopping monitor:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo monitor?')) {
      return;
    }

    try {
      setActionLoading(monitorId);
      setError(null);

      const response = await monitoringService.deleteMonitor(monitorId);
      
      if (response.success) {
        setSuccess('Monitor eliminato con successo');
        await loadData();
      } else {
        setError(response.message || 'Errore nell\'eliminazione del monitor');
      }

    } catch (err) {
      setError('Errore nell\'eliminazione del monitor');
      console.error('Error deleting monitor:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      running: { color: 'success', text: 'Attivo' },
      stopped: { color: 'secondary', text: 'Fermato' },
      paused: { color: 'warning', text: 'In Pausa' },
      error: { color: 'danger', text: 'Errore' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { color: 'secondary', text: status };
    
    return <CBadge color={statusInfo.color}>{statusInfo.text}</CBadge>;
  };

  const getMonitorTypeText = (type: string) => {
    const typeMap = {
      periodic_check: 'Controllo Periodico',
      real_time: 'Tempo Reale',
      file_watcher: 'File Watcher',
    };

    return typeMap[type as keyof typeof typeMap] || type;
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('it-IT');
  };

  if (loading) {
    return (
      <PageLayout>
        <PageLayout.Header title="Impostazioni Monitoraggio DBF" />
        <PageLayout.ContentBody>
          <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
            <CSpinner color="primary" />
          </div>
        </PageLayout.ContentBody>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Impostazioni Monitoraggio DBF"
        headerAction={
          <div className="d-flex gap-2">
            <CButton color="primary" onClick={loadData} disabled={loading}>
              <CIcon icon={cilReload} className="me-2" />
              Aggiorna
            </CButton>
            <CButton color="success" onClick={() => setShowCreateModal(true)}>
              <CIcon icon={cilPlus} className="me-2" />
              Nuovo Monitor
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentBody>
        {/* Alert per messaggi */}
        {error && (
          <CAlert color="danger" className="mb-3" onClose={() => setError(null)} dismissible>
            {error}
          </CAlert>
        )}
        
        {success && (
          <CAlert color="success" className="mb-3" onClose={() => setSuccess(null)} dismissible>
            {success}
          </CAlert>
        )}

        {/* Statistiche */}
        {status && (
          <CRow className="mb-4">
            <CCol md={3}>
              <CCard>
                <CCardBody className="text-center">
                  <h4 className="text-primary">{status?.total_monitors || 0}</h4>
                  <p className="mb-0">Monitor Totali</p>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={3}>
              <CCard>
                <CCardBody className="text-center">
                  <h4 className="text-success">{status?.active_monitors || 0}</h4>
                  <p className="mb-0">Monitor Attivi</p>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={3}>
              <CCard>
                <CCardBody className="text-center">
                  <h4 className="text-warning">{(status?.total_monitors || 0) - (status?.active_monitors || 0)}</h4>
                  <p className="mb-0">Monitor Fermati</p>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={3}>
              <CCard>
                <CCardBody className="text-center">
                  <h4 className="text-info">
                    {Object.values(status.monitors || {}).reduce((sum, m) => sum + (m?.change_count || 0), 0)}
                  </h4>
                  <p className="mb-0">Cambiamenti Rilevati</p>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        )}

        {/* Tabella Monitor */}
        <CCard>
          <CCardHeader>
            <h5 className="mb-0">
              <CIcon icon={cilMonitor} className="me-2" />
              Monitor Attivi
            </h5>
          </CCardHeader>
          <CCardBody>
            {!Array.isArray(monitors) || monitors.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted">Nessun monitor configurato</p>
                <CButton color="primary" onClick={() => setShowCreateModal(true)}>
                  <CIcon icon={cilPlus} className="me-2" />
                  Crea il Primo Monitor
                </CButton>
              </div>
            ) : (
              <CTable responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Tabella</CTableHeaderCell>
                    <CTableHeaderCell>Tipo</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>Avviato alle</CTableHeaderCell>
                    <CTableHeaderCell>Cambiamenti</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {(Array.isArray(monitors) ? monitors : []).map((monitor) => (
                    <CTableRow key={monitor.config.monitor_id}>
                      <CTableDataCell>
                        <strong>{monitor.config.table_name}</strong>
                      </CTableDataCell>
                      <CTableDataCell>
                        {getMonitorTypeText(monitor.config.monitor_type)}
                        {monitor.config.monitor_type === 'periodic_check' && (
                          <small className="d-block text-muted">
                            Ogni {monitor.config.interval_seconds}s
                          </small>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {getStatusBadge(monitor.status?.status || 'stopped')}
                      </CTableDataCell>
                      <CTableDataCell>
                        {formatTimestamp(monitor.status?.started_at)}
                      </CTableDataCell>
                      <CTableDataCell>
                        <span className="badge bg-info">{monitor.status?.change_count || 0}</span>
                        {(monitor.status?.error_count || 0) > 0 && (
                          <span className="badge bg-danger ms-1">{monitor.status?.error_count}</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex gap-1">
                          {monitor.status?.status === 'running' ? (
                            <CButton
                              size="sm"
                              color="warning"
                              onClick={() => handleStopMonitor(monitor.config.monitor_id)}
                              disabled={actionLoading === monitor.config.monitor_id}
                            >
                              {actionLoading === monitor.config.monitor_id ? (
                                <CSpinner size="sm" />
                              ) : (
                                <CIcon icon={cilMediaStop} />
                              )}
                            </CButton>
                          ) : (
                            <CButton
                              size="sm"
                              color="success"
                              onClick={() => handleStartMonitor(monitor.config.monitor_id)}
                              disabled={actionLoading === monitor.config.monitor_id}
                            >
                              {actionLoading === monitor.config.monitor_id ? (
                                <CSpinner size="sm" />
                              ) : (
                                <CIcon icon={cilMediaPlay} />
                              )}
                            </CButton>
                          )}
                          <CButton
                            size="sm"
                            color="danger"
                            onClick={() => handleDeleteMonitor(monitor.config.monitor_id)}
                            disabled={actionLoading === monitor.config.monitor_id}
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>

        {/* Modal Creazione Monitor */}
        <CModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
          <CModalHeader>
            <h5 className="mb-0">
              <CIcon icon={cilPlus} className="me-2" />
              Crea Nuovo Monitor
            </h5>
          </CModalHeader>
          <CModalBody>
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel>Tabella da Monitorare</CFormLabel>
                <CFormSelect
                  value={newMonitor.table_name}
                  onChange={(e) => setNewMonitor({ ...newMonitor, table_name: e.target.value })}
                >
                  <option value="appointments">APPUNTA (Appuntamenti)</option>
                  <option value="pazienti">Pazienti</option>
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Tipo di Monitoraggio</CFormLabel>
                <CFormSelect
                  value={newMonitor.monitor_type}
                  onChange={(e) => setNewMonitor({ 
                    ...newMonitor, 
                    monitor_type: e.target.value as any 
                  })}
                >
                  <option value="periodic_check">Controllo Periodico</option>
                  <option value="real_time">Tempo Reale</option>
                  <option value="file_watcher">File Watcher</option>
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Intervallo (secondi)</CFormLabel>
                <CFormInput
                  type="number"
                  value={newMonitor.interval_seconds}
                  onChange={(e) => setNewMonitor({ 
                    ...newMonitor, 
                    interval_seconds: parseInt(e.target.value) || 30 
                  })}
                  min="1"
                  max="3600"
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel className="d-flex align-items-center">
                  <CFormSwitch
                    checked={newMonitor.auto_start}
                    onChange={(e) => setNewMonitor({ 
                      ...newMonitor, 
                      auto_start: e.target.checked 
                    })}
                    className="me-2"
                  />
                  Avvia Automaticamente
                </CFormLabel>
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setShowCreateModal(false)}>
              Annulla
            </CButton>
            <CButton 
              color="primary" 
              onClick={handleCreateMonitor}
              disabled={actionLoading === 'create'}
            >
              {actionLoading === 'create' ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Creazione...
                </>
              ) : (
                <>
                  <CIcon icon={cilPlus} className="me-2" />
                  Crea Monitor
                </>
              )}
            </CButton>
          </CModalFooter>
        </CModal>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default MonitoringSettings;
