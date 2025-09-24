import React, { useState, useEffect, useRef } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CTextarea,
  CSpinner,
  CAlert,
  CBadge,
  CRow,
  CCol,
  CFormSelect,
  CFormLabel,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { 
  cilMediaPlay, 
  cilMediaStop, 
  cilTrash, 
  cilReload,
  cilSettings
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { MonitorPrestazioniService } from '@/services/api/monitorPrestazioni';
import PrestazioniSelect from '@/components/selects/PrestazioniSelect';
import { Prestazione, usePrestazioniStore } from '@/store/prestazioni.store';

interface MonitorStatus {
  is_running: boolean;
  path: string;
  last_check?: string;
  total_changes: number;
}

interface MonitorLog {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

const MonitorPrestazioniStandalonePage: React.FC = () => {
  // Stati principali
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Stati per selezione prestazioni
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null);

  // Ref per auto-scroll
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll dei log
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Carica stato iniziale
  useEffect(() => {
    loadStatus();
    loadLogs();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await MonitorPrestazioniService.getStatus();
      if (response.success && response.data) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dello stato:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await MonitorPrestazioniService.getLogs();
      if (response.success && response.data) {
        // Il backend restituisce { logs: MonitorLog[] }
        setLogs(response.data.logs || []);
        // Auto-scroll solo quando carichi i log manualmente
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei log:', error);
    }
  };

  const handleStartMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.startMonitor();
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || 'Errore nell\'avvio del monitor');
      }
    } catch (error) {
      setError('Errore nell\'avvio del monitor');
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.stopMonitor();
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
      }
    } catch (error) {
      setError('Errore nella fermata del monitor');
      console.error('Errore:', error);
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

  const refreshLogs = () => {
    loadLogs();
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('it-IT');
  };

  const getLogBadgeColor = (type: string) => {
    switch (type) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Monitor Prestazioni DBF"
        subtitle="Monitoraggio in tempo reale delle prestazioni eseguite"
        headerAction={
          <div className="d-flex gap-2">
            <CButton 
              color="info" 
              onClick={refreshLogs} 
              disabled={loading}
              size="sm"
            >
              <CIcon icon={cilReload} className="me-1" />
              Aggiorna Log
            </CButton>
            <CButton 
              color="warning" 
              onClick={handleTestMonitor} 
              disabled={loading}
              size="sm"
            >
              <CIcon icon={cilSettings} className="me-1" />
              Test
            </CButton>
            <CButton 
              color="danger" 
              onClick={clearLogs} 
              disabled={loading}
              size="sm"
            >
              <CIcon icon={cilTrash} className="me-1" />
              Pulisci Log
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

        <CRow className="g-4">
          {/* Pannello di Controllo */}
          <CCol md={4}>
            <CCard>
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilSettings} className="me-2" />
                  Controllo Monitor
                </h5>
              </CCardHeader>
              <CCardBody>
                {/* Status */}
                <div className="mb-3">
                  <CFormLabel>Stato Monitor:</CFormLabel>
                  <div>
                    {status?.is_running ? (
                      <CBadge color="success" className="fs-6">
                        <CIcon icon={cilMediaPlay} className="me-1" />
                        Attivo
                      </CBadge>
                    ) : (
                      <CBadge color="secondary" className="fs-6">
                        <CIcon icon={cilMediaStop} className="me-1" />
                        Fermato
                      </CBadge>
                    )}
                  </div>
                </div>

                {/* Statistiche */}
                {status && (
                  <div className="mb-3">
                    <CFormLabel>Statistiche:</CFormLabel>
                    <div className="small text-muted">
                      <div>Cambiamenti rilevati: <strong>{status.total_changes}</strong></div>
                      {status.last_check && (
                        <div>Ultimo controllo: <strong>{formatTimestamp(status.last_check)}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selezione Prestazione */}
                <div className="mb-3">
                  <CFormLabel>Prestazione da Monitorare:</CFormLabel>
                  <PrestazioniSelect
                    value={selectedPrestazione?.id || ''}
                    onChange={(prestazioneId) => {
                      if (prestazioneId) {
                        // Trova la prestazione selezionata
                        const prestazione = usePrestazioniStore.getState().getPrestazioneById(prestazioneId);
                        setSelectedPrestazione(prestazione);
                      } else {
                        setSelectedPrestazione(null);
                      }
                    }}
                    placeholder="Seleziona prestazione..."
                  />
                  {selectedPrestazione && (
                    <div className="mt-2 p-2 bg-light rounded">
                      <small>
                        <strong>{selectedPrestazione.nome}</strong><br />
                        <span className="text-muted">
                          {selectedPrestazione.categoria} - {selectedPrestazione.codice_breve}
                        </span>
                      </small>
                    </div>
                  )}
                </div>

                {/* Pulsanti di Controllo */}
                <div className="d-grid gap-2">
                  {status?.is_running ? (
                    <CButton 
                      color="warning" 
                      onClick={handleStopMonitor} 
                      disabled={loading}
                    >
                      {loading ? (
                        <CSpinner size="sm" className="me-2" />
                      ) : (
                        <CIcon icon={cilMediaStop} className="me-2" />
                      )}
                      Ferma Monitor
                    </CButton>
                  ) : (
                    <CButton 
                      color="success" 
                      onClick={handleStartMonitor} 
                      disabled={loading}
                    >
                      {loading ? (
                        <CSpinner size="sm" className="me-2" />
                      ) : (
                        <CIcon icon={cilMediaPlay} className="me-2" />
                      )}
                      Avvia Monitor
                    </CButton>
                  )}
                </div>
              </CCardBody>
            </CCard>
          </CCol>

          {/* Log Monitor */}
          <CCol md={8}>
            <CCard>
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilReload} className="me-2" />
                  Log Monitor
                </h5>
              </CCardHeader>
              <CCardBody>
                <div 
                  style={{ 
                    height: '500px', 
                    overflowY: 'auto', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '0.375rem',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                >
                  {logs.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <p>Nessun log disponibile</p>
                      <small>Avvia il monitor per vedere i log in tempo reale</small>
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="mb-2">
                        <div className="d-flex align-items-start">
                          <CBadge 
                            color={getLogBadgeColor(log.type)} 
                            className="me-2 mt-1"
                            style={{ fontSize: '0.75rem' }}
                          >
                            {log.type.toUpperCase()}
                          </CBadge>
                          <div className="flex-grow-1">
                            <div className="text-muted small">
                              {formatTimestamp(log.timestamp)}
                            </div>
                            <div className="mt-1">
                              {log.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default MonitorPrestazioniStandalonePage;
