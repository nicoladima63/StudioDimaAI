import React, { useState, useEffect, useRef } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CAlert,
  CSpinner,
  CFormInput,
  CFormLabel,
  CForm,
  CBadge,
  CListGroup,
  CListGroupItem
} from '@coreui/react'
import { toast } from 'react-hot-toast'
import MonitorPrestazioniService, { type MonitorStatus, type MonitorLog } from '@/services/api/monitorPrestazioni'
import PrestazioniSelect from '@/components/selects/PrestazioniSelect'
import type { Prestazione } from '@/store/prestazioni.store'

const MonitorPrestazioniPage: React.FC = () => {
  const [status, setStatus] = useState<MonitorStatus | null>(null)
  const [logs, setLogs] = useState<MonitorLog[]>([])
  const [loading, setLoading] = useState(false)
  const [preventPath, setPreventPath] = useState('C:/Pixel/WINDENT/DATI/PREVENT.DBF')
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll rimosso per evitare re-render continui

  // Carica stato iniziale
  useEffect(() => {
    loadStatus()
    loadLogs()  // Carica anche i log esistenti
  }, [])

  // Auto-refresh log rimosso - implementeremo WebSocket

  const loadStatus = async () => {
    try {
      const response = await MonitorPrestazioniService.getStatus()
      if (response.success && response.data) {
        setStatus(response.data)
      }
    } catch (error) {
      console.error('Errore caricamento stato:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await MonitorPrestazioniService.getLogs()
      if (response.success && response.data) {
        setLogs(response.data.logs)
      }
    } catch (error) {
      console.error('Errore caricamento log:', error)
    }
  }


  const handleStartMonitor = async () => {
    setLoading(true)
    try {
      const response = await MonitorPrestazioniService.startMonitor({
        prevent_path: preventPath
      })

      if (response.success) {
        toast.success('Monitor avviato con successo')
        await loadStatus()
        await loadLogs()  // Carica log esistenti
      } else {
        toast.error(response.error || 'Errore avvio monitor')
      }
    } catch (error) {
      console.error('Errore avvio monitor:', error)
      toast.error('Errore avvio monitor')
    } finally {
      setLoading(false)
    }
  }

  const handleStopMonitor = async () => {
    setLoading(true)
    try {
      const response = await MonitorPrestazioniService.stopMonitor()

      if (response.success) {
        toast.success('Monitor fermato con successo')
        await loadStatus()
        // I log vengono gestiti dal server, non aggiungiamo log locali
      } else {
        toast.error(response.error || 'Errore stop monitor')
      }
    } catch (error) {
      console.error('Errore stop monitor:', error)
      toast.error('Errore stop monitor')
    } finally {
      setLoading(false)
    }
  }

  const handleTestMonitor = async () => {
    setLoading(true)
    try {
      const response = await MonitorPrestazioniService.testMonitor()

      if (response.success) {
        toast.success('Test completato')
        // I log vengono gestiti dal server, non aggiungiamo log locali
      } else {
        toast.error(response.error || 'Errore test monitor')
      }
    } catch (error) {
      console.error('Errore test monitor:', error)
      toast.error('Errore test monitor')
    } finally {
      setLoading(false)
    }
  }

  const addLog = (log: MonitorLog) => {
    setLogs(prev => [...prev, log])
  }

  const clearLogs = async () => {
    try {
      const response = await MonitorPrestazioniService.clearLogs()
      if (response.success) {
        setLogs([]) // Pulisce anche il frontend
        toast.success('Log puliti con successo')
      } else {
        toast.error(response.error || 'Errore pulizia log')
      }
    } catch (error) {
      console.error('Errore pulizia log:', error)
      toast.error('Errore pulizia log')
    }
  }

  const refreshLogs = () => {
    loadLogs()
  }

  const getLogBadgeColor = (type: string) => {
    switch (type) {
      case 'success': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'danger'
      default: return 'info'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('it-IT')
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <h4 className="mb-0">Monitor Prestazioni</h4>
            <small className="text-muted">
              Monitoraggio real-time delle prestazioni eseguite nel gestionale
            </small>
          </CCardHeader>
          <CCardBody>
            {/* Configurazione */}
            <CRow className="mb-4">
              <CCol md={8}>
                <CForm>
                  <CFormLabel htmlFor="preventPath">Percorso PREVENT.DBF</CFormLabel>
                  <CFormInput
                    id="preventPath"
                    type="text"
                    value={preventPath}
                    onChange={(e) => setPreventPath(e.target.value)}
                    placeholder="C:/Pixel/WINDENT/DATI/PREVENT.DBF"
                    disabled={status?.is_running || false}
                  />
                </CForm>
              </CCol>
              <CCol md={4} className="d-flex align-items-end">
                <div className="d-flex gap-2">
                  {!status?.is_running ? (
                    <CButton
                      color="success"
                      onClick={handleStartMonitor}
                      disabled={loading}
                    >
                      {loading ? <CSpinner size="sm" /> : 'Avvia Monitor'}
                    </CButton>
                  ) : (
                    <>
                      <CButton
                        color="danger"
                        onClick={handleStopMonitor}
                        disabled={loading}
                      >
                        {loading ? <CSpinner size="sm" /> : 'Ferma Monitor'}
                      </CButton>
                      <CButton
                        color="info"
                        onClick={handleTestMonitor}
                        disabled={loading}
                        className="ms-2"
                      >
                        {loading ? <CSpinner size="sm" /> : 'Test Monitor'}
                      </CButton>
                    </>
                  )}
                </div>
              </CCol>
            </CRow>

            {/* Selezione Prestazioni da Monitorare */}
            <CRow className="mb-4">
              <CCol xs={12}>
                <CCard>
                  <CCardHeader>
                    <h5 className="mb-0">Prestazioni da Monitorare</h5>
                    <small className="text-muted">
                      Seleziona le prestazioni per cui attivare il monitoraggio
                    </small>
                  </CCardHeader>
                  <CCardBody>
                    <CRow>
                      <CCol md={6}>
                        <CFormLabel>Prestazione</CFormLabel>
                        <PrestazioniSelect
                          value={selectedPrestazione?.id || null}
                          onChange={setSelectedPrestazione}
                          placeholder="-- Seleziona prestazione --"
                          disabled={status?.is_running || false}
                          clearable={true}
                          showCategory={true}
                        />
                      </CCol>
                      <CCol md={6} className="d-flex align-items-end">
                        {selectedPrestazione && (
                          <div className="alert alert-info mb-0 w-100">
                            <strong>Selezionata:</strong> {selectedPrestazione.nome}
                            <br />
                            <small>
                              <strong>Categoria:</strong> {selectedPrestazione.categoria_nome}
                              <br />
                              <strong>Codice:</strong> {selectedPrestazione.codice_breve}
                              <br />
                              <strong>Costo:</strong> €{selectedPrestazione.costo.toFixed(2)}
                            </small>
                          </div>
                        )}
                      </CCol>
                    </CRow>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>

            {/* Stato Monitor */}
            {status && (
              <CAlert color={status.is_running ? 'success' : 'secondary'} className="mb-4">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Stato:</strong> {status.is_running ? 'Attivo' : 'Fermo'}
                    {status.is_running && (
                      <>
                        <br />
                        <small>
                          <strong>Percorso:</strong> {status.prevent_path}
                          <br />
                          <strong>Record in cache:</strong> {status.cached_records}
                        </small>
                      </>
                    )}
                  </div>
                  <CBadge color={status.is_running ? 'success' : 'secondary'}>
                    {status.is_running ? '●' : '○'}
                  </CBadge>
                </div>
              </CAlert>
            )}

            {/* Log Console */}
            <CCard>
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Log Monitoraggio</h5>
                <div className="d-flex gap-2">
                  <CButton
                    color="outline-primary"
                    size="sm"
                    onClick={refreshLogs}
                  >
                    Aggiorna
                  </CButton>
                  <CButton
                    color="outline-secondary"
                    size="sm"
                    onClick={clearLogs}
                    disabled={logs.length === 0}
                  >
                    Pulisci Log
                  </CButton>
                </div>
              </CCardHeader>
              <CCardBody>
                <div
                  style={{
                    height: '400px',
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '0.375rem',
                    padding: '1rem'
                  }}
                >
                  {logs.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <i className="cil-console me-2"></i>
                      Nessun log disponibile
                    </div>
                  ) : (
                    <CListGroup flush>
                      {logs.map((log, index) => (
                        <CListGroupItem key={index} className="border-0 px-0 py-0">
                          <div className="d-flex align-items-start">
                            {formatTimestamp(log.timestamp)} {log.message}
                          </div>
                        </CListGroupItem>
                      ))}
                    </CListGroup>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CCardBody>
            </CCard>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default MonitorPrestazioniPage
