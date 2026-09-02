import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CCard, CCardBody, CCardHeader,
  CButton, CSpinner, CBadge, CAlert,
  CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell,
  CRow, CCol,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilReload, cilCheckCircle, cilWarning,
  cilPhone, cilBell, cilSettings, cilLink,
  cilMediaPlay, cilMediaStop, cilChatBubble,
} from '@coreui/icons'
import PageLayout from '@/components/layout/PageLayout'
import evolutionService, { type EvolutionStatus, type RecentComm, type EvoMessage } from '../services/evolution.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TrafficLight = 'success' | 'danger' | 'warning' | 'secondary'

function statusColor(ok: boolean | undefined): TrafficLight {
  return ok ? 'success' : 'danger'
}


function channelBadge(channel: string) {
  return (
    <CBadge color={channel === 'whatsapp' ? 'success' : 'info'} className="text-uppercase">
      {channel === 'whatsapp' ? 'WA' : 'SMS'}
    </CBadge>
  )
}

function statoBadge(stato: string) {
  const map: Record<string, string> = {
    sent: 'primary', confirmed: 'success', cancelled: 'warning', failed: 'danger',
  }
  return <CBadge color={map[stato] ?? 'secondary'}>{stato}</CBadge>
}

function messageTypeBadge(type: RecentComm['type']) {
  const labels: Record<RecentComm['type'], string> = {
    '24h': '24 ore',
    '2h': '2 ore',
    followup: 'Follow-up',
  }
  const colors: Record<RecentComm['type'], string> = {
    '24h': 'info',
    '2h': 'warning',
    followup: 'secondary',
  }
  return <CBadge color={colors[type]}>{labels[type]}</CBadge>
}

type SortColumn = 'patient' | 'appointment' | 'sent'
type SortDirection = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// StatusCard
// ---------------------------------------------------------------------------

interface StatusCardProps {
  label: string
  color?: TrafficLight
  detail?: string
  icon: string[]
  action?: React.ReactNode
}

function StatusCard({ label, color = 'secondary', detail, icon, action }: StatusCardProps) {
  return (
    <CCard className="text-center">
      <CCardBody className="py-2 d-flex flex-column gap-2">
        <div className="d-flex align-items-center gap-2">
          <CIcon icon={icon} size="lg" className={`text-${color} flex-shrink-0`} />
          <div className="fw-semibold small text-truncate">{label}</div>
          {detail && <CBadge color={color} className="px-2 py-1 ms-auto">{detail}</CBadge>}
        </div>
        {action && <div className="text-nowrap">{action}</div>}
      </CCardBody>
    </CCard>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const EvolutionSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<EvolutionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [terminating, setTerminating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [launchingDesktop, setLaunchingDesktop] = useState(false)
  const [syncingHistory, setSyncingHistory] = useState(false)
  const [cmdOutput, setCmdOutput] = useState<{ text: string; ok: boolean } | null>(null)
  const [alert, setAlert] = useState<{ color: string; msg: string } | null>(null)
  const [selectedComm, setSelectedComm] = useState<RecentComm | null>(null)
  const [convMessages, setConvMessages] = useState<EvoMessage[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('sent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortColumn(column)
    setSortDirection(column === 'patient' ? 'asc' : 'desc')
  }

  const sortedCommunications = useMemo(() => {
    if (!status) return []

    return [...status.recent_communications].sort((a, b) => {
      const values: Record<SortColumn, [string, string]> = {
        patient: [a.patient_name, b.patient_name],
        appointment: [`${a.appointment_date} ${a.appointment_time}`, `${b.appointment_date} ${b.appointment_time}`],
        sent: [a.created_at, b.created_at],
      }
      const [aValue, bValue] = values[sortColumn]
      const comparison = aValue.localeCompare(bValue, 'it', { numeric: true })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [status, sortColumn, sortDirection])

  const sortIndicator = (column: SortColumn) => (
    <span className="ms-1" aria-hidden="true">
      {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const sortableHeader = (label: string, column: SortColumn) => (
    <CTableHeaderCell
      role="button"
      tabIndex={0}
      className="user-select-none text-nowrap"
      style={{ cursor: 'pointer' }}
      onClick={() => handleSort(column)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleSort(column)
        }
      }}
      aria-sort={sortColumn === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}{sortIndicator(column)}
    </CTableHeaderCell>
  )

  const handleOpenConversation = async (c: RecentComm) => {
    setSelectedComm(c)
    setConvMessages([])
    setConvError(null)
    setConvLoading(true)
    try {
      const { messages } = await evolutionService.apiGetConversation(c.phone)
      setConvMessages(messages)
    } catch (err: unknown) {
      setConvError(err instanceof Error ? err.message : 'Errore recupero conversazione')
    } finally {
      setConvLoading(false)
    }
  }

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const s = await evolutionService.apiGetStatus()
      setStatus(s)
    } catch {
      setAlert({ color: 'danger', msg: 'Impossibile recuperare lo stato del sistema' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Avvio smart: se Docker Desktop non risponde lo lancia, altrimenti compose up
  const handleSmartStart = async () => {
    if (!status?.docker_daemon_running) {
      setLaunchingDesktop(true)
      setAlert(null)
      try {
        await evolutionService.apiStartDockerDesktop()
        setAlert({ color: 'info', msg: 'Docker Desktop in avvio — attendi 30-40 secondi, poi clicca Aggiorna.' })
        setTimeout(loadStatus, 35000)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Avvio fallito'
        setAlert({ color: 'danger', msg })
      } finally {
        setLaunchingDesktop(false)
      }
    } else {
      setStarting(true)
      setCmdOutput(null)
      setAlert(null)
      try {
        const { output } = await evolutionService.apiStart()
        setCmdOutput({ text: output || 'Avviato', ok: true })
        setAlert({ color: 'success', msg: 'Evolution avviato — aggiorno stato tra 3 secondi.' })
        setTimeout(loadStatus, 3000)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Avvio fallito'
        setCmdOutput({ text: msg, ok: false })
        setAlert({ color: 'danger', msg })
      } finally {
        setStarting(false)
      }
    }
  }

  const handleStop = async () => {
    setStopping(true)
    setCmdOutput(null)
    setAlert(null)
    try {
      const { output } = await evolutionService.apiStop()
      setCmdOutput({ text: output || 'Fermato', ok: true })
      setAlert({ color: 'warning', msg: 'Evolution fermato.' })
      setTimeout(loadStatus, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Stop fallito'
      setCmdOutput({ text: msg, ok: false })
      setAlert({ color: 'danger', msg })
    } finally {
      setStopping(false)
    }
  }

  const handleSyncHistory = async () => {
    setSyncingHistory(true)
    setAlert(null)
    try {
      const result = await evolutionService.apiSyncHistory()
      setAlert({ color: 'info', msg: result.message })
      setTimeout(loadStatus, 5000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sincronizzazione storico fallita'
      setAlert({ color: 'danger', msg })
    } finally {
      setSyncingHistory(false)
    }
  }

  const handleCreateInstance = async () => {
    setCreating(true)
    setAlert(null)
    try {
      const result = await evolutionService.apiCreateInstance()
      setStatus(prev => prev ? { ...prev, instance_exists: true, wa_state: 'close' } : prev)
      // Se Evolution ha restituito il QR direttamente nella risposta di creazione, mostralo subito
      if (result.qr) {
        setQr(result.qr.startsWith('data:') ? result.qr : `data:image/png;base64,${result.qr}`)
      }
      setAlert({
        color: result.already_exists ? 'warning' : 'success',
        msg: result.already_exists
          ? 'Istanza gia esistente — usa "Genera QR" per connetterti.'
          : result.qr
            ? 'Istanza creata — scansiona il QR con WhatsApp.'
            : 'Istanza creata — clicca "Genera QR" per connettere WhatsApp.',
      })
    } catch {
      setAlert({ color: 'danger', msg: 'Errore creazione istanza — verifica che Evolution sia in esecuzione.' })
    } finally {
      setCreating(false)
    }
  }

  const handleTerminateInstance = async () => {
    setTerminating(true)
    setAlert(null)
    try {
      await evolutionService.apiDeleteInstance()
      setStatus(prev => prev ? { ...prev, instance_exists: false, wa_state: 'unknown' } : prev)
      setQr(null)
      setAlert({ color: 'warning', msg: 'Istanza eliminata — puoi ricrearne una nuova.' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Errore eliminazione istanza'
      setAlert({ color: 'danger', msg })
    } finally {
      setTerminating(false)
    }
  }

  const handleShowQr = useCallback(async (attempt = 0) => {
    const MAX_ATTEMPTS = 5
    if (attempt === 0) { setQrLoading(true); setQr(null) }
    try {
      const result = await evolutionService.apiGetQr()
      if (result.not_ready) {
        if (attempt < MAX_ATTEMPTS - 1) {
          setAlert({ color: 'warning', msg: `Evolution sta inizializzando... (${attempt + 1}/${MAX_ATTEMPTS})` })
          setTimeout(() => handleShowQr(attempt + 1), 3000)
        } else {
          setQrLoading(false)
          setAlert({ color: 'danger', msg: 'QR non disponibile — verifica che Evolution sia in esecuzione.' })
        }
        return
      }
      if (result.qr) setQr(result.qr)
      setAlert(null)
      setQrLoading(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Errore recupero QR'
      setAlert({ color: 'danger', msg })
      setQrLoading(false)
    }
  }, [])

  // Docker: 2 stati — Avvia / Ferma
  const dockerAction = status ? (
    status.docker_running ? (
      <CButton size="sm" color="danger" className="w-50" onClick={handleStop} disabled={stopping}>
        {stopping ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaStop} className="me-1" />}
        Ferma
      </CButton>
    ) : (
      <CButton size="sm" color="success" className="w-50" onClick={handleSmartStart}
        disabled={starting || launchingDesktop}>
        {(starting || launchingDesktop) ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaPlay} className="me-1" />}
        Avvia
      </CButton>
    )
  ) : undefined

  // Evolution: 2 stati — Avvia Evolution / Ferma Evolution
  const evolutionAction = status ? (
    status.evolution_reachable ? (
      <CButton size="sm" color="danger" className="w-50" onClick={handleStop} disabled={stopping}>
        {stopping ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaStop} className="me-1" />}
        Ferma
      </CButton>
    ) : (
      <CButton size="sm" color="success" className="w-50" onClick={handleSmartStart}
        disabled={starting || launchingDesktop}>
        {(starting || launchingDesktop) ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaPlay} className="me-1" />}
        Avvia
      </CButton>
    )
  ) : undefined

  // WhatsApp: 2 stati — Crea istanza / Termina istanza
  const waAction = status ? (
    !status.instance_exists ? (
      <CButton size="sm" color="success" className="w-50" onClick={handleCreateInstance}
        disabled={creating || !status.evolution_reachable}>
        {creating ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaPlay} className="me-1" />}
        Avvia
      </CButton>
    ) : (
      <CButton size="sm" color="success" className="w-50" onClick={handleTerminateInstance}
        disabled={terminating}>
        {terminating ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilMediaStop} className="me-1" />}
        Ferma
      </CButton>
    )
  ) : undefined

  return (
    <PageLayout>
      <PageLayout.Header
        title="WhatsApp Reminder — Stato Sistema"
        headerAction={
          <div className="d-flex gap-2">
            <CButton
              color="primary"
              variant="outline"
              onClick={handleSyncHistory}
              disabled={syncingHistory || status?.wa_state !== 'open'}
              title="Abilita e importa la cronologia WhatsApp completa"
            >
              {syncingHistory ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilChatBubble} className="me-1" />}
              Sincronizza chat
            </CButton>
            <CButton color="info" variant="outline" onClick={loadStatus} disabled={loading}>
              {loading ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilReload} className="me-1" />}
              Aggiorna
            </CButton>
          </div>
        }
      />
      <PageLayout.ContentBody>
        {alert && (
          <CAlert color={alert.color} dismissible onClose={() => setAlert(null)} className="mb-3">
            {alert.msg}
          </CAlert>
        )}

        {loading && !status ? (
          <div className="text-center py-5"><CSpinner color="primary" /></div>
        ) : status ? (
          <>
            {/* 6 status card sulla stessa riga */}
            <div className="d-flex gap-2 mb-3 pb-1" style={{ overflowX: 'auto' }}>
              {(
                [
                  {
                    label: 'Docker',
                    color: (status.docker_running ? 'success' : 'warning') as TrafficLight,
                    icon: cilSettings, action: dockerAction,
                  },
                  {
                    label: 'Evolution API',
                    color: statusColor(status.evolution_reachable),
                    icon: cilLink, action: evolutionAction,
                  },
                  {
                    label: 'WhatsApp',
                    color: (status.wa_state === 'open' ? 'success' : status.wa_state === 'connecting' ? 'warning' : status.wa_state === 'close' ? 'danger' : 'secondary') as TrafficLight,
                    icon: cilPhone, action: waAction,
                  },
                  {
                    label: 'Webhook',
                    color: statusColor(status.webhook_configured),
                    detail: status.webhook_configured ? 'Configurato' : 'Non configurato',
                    icon: cilCheckCircle,
                  },
                  {
                    label: 'Reminder 24h',
                    color: statusColor(status.reminder_24h_enabled),
                    detail: status.reminder_24h_enabled ? 'Attivo' : 'Spento',
                    icon: cilBell,
                  },
                  {
                    label: 'Reminder 2h',
                    color: statusColor(status.reminder_2h_enabled),
                    detail: status.reminder_2h_enabled ? 'Attivo' : 'Spento',
                    icon: cilBell,
                  },
                ] as StatusCardProps[]
              ).map(c => (
                <div key={c.label} style={{ minWidth: 130, flex: '1 1 0' }}>
                  <StatusCard {...c} />
                </div>
              ))}
            </div>

            {/* Output comando docker */}
            {cmdOutput && (
              <CAlert color={cmdOutput.ok ? 'primary' : 'danger'} className="mb-3 py-2">
                <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}>
                  {cmdOutput.text}
                </pre>
              </CAlert>
            )}

            {/* Tabella reminder a larghezza piena con scorrimento interno */}
            <CRow className="g-3 align-items-start">
              <CCol xs={12}>
                <CCard className="d-flex flex-column" style={{ height: 'calc(100vh - 330px)', minHeight: 360 }}>
                  <CCardHeader><strong>Reminder inviati</strong></CCardHeader>
                  <CCardBody className="p-0 flex-grow-1 overflow-hidden">
                    {status.recent_communications.length === 0 ? (
                      <div className="text-muted text-center py-4">Nessuna comunicazione registrata</div>
                    ) : (
                      <div className="h-100" style={{ overflowY: 'auto' }}>
                      <CTable hover responsive small className="mb-0">
                        <CTableHead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <CTableRow>
                            {sortableHeader('Paziente', 'patient')}
                            {sortableHeader('Appuntamento', 'appointment')}
                            <CTableHeaderCell>Tipo</CTableHeaderCell>
                            <CTableHeaderCell>Canale</CTableHeaderCell>
                            <CTableHeaderCell>Stato</CTableHeaderCell>
                            {sortableHeader('Inviato', 'sent')}
                            <CTableHeaderCell></CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {sortedCommunications.map(c => (
                            <CTableRow key={c.id}>
                              <CTableDataCell className="fw-semibold">{c.patient_name}</CTableDataCell>
                              <CTableDataCell className="text-nowrap">{c.appointment_date} {c.appointment_time}</CTableDataCell>
                              <CTableDataCell>{messageTypeBadge(c.type)}</CTableDataCell>
                              <CTableDataCell>{channelBadge(c.channel)}</CTableDataCell>
                              <CTableDataCell>{statoBadge(c.stato)}</CTableDataCell>
                              <CTableDataCell className="text-muted small text-nowrap">
                                {c.created_at?.slice(0, 16).replace('T', ' ')}
                              </CTableDataCell>
                              <CTableDataCell>
                                {c.channel === 'whatsapp' && (
                                  <CButton color="success" variant="outline" size="sm"
                                    onClick={() => handleOpenConversation(c)} title="Vedi conversazione">
                                    <CIcon icon={cilChatBubble} />
                                  </CButton>
                                )}
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>

              {/* QR card: visibile solo se istanza esiste e non ancora connessa */}
              {status.instance_exists && status.wa_state !== 'open' && (
              <CCol xs={12}>
                <CCard>
                  <CCardHeader><strong>QR WhatsApp</strong></CCardHeader>
                  <CCardBody className="d-flex flex-column align-items-center gap-3">
                    {qr ? (
                      <>
                        <img
                          src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                          alt="WhatsApp QR Code"
                          style={{ width: 200, height: 200, border: '1px solid #dee2e6', borderRadius: 8 }}
                        />
                        <div className="text-muted small text-center">
                          <CIcon icon={cilWarning} className="text-warning me-1" />
                          Scansiona con il telefono dello studio.<br />
                          Il QR scade in ~60 secondi.
                        </div>
                      </>
                    ) : (
                      <div className="text-muted small text-center py-3 flex-grow-1 d-flex align-items-center">
                        Nessun QR disponibile.<br />
                        Clicca il bottone per generarlo.
                      </div>
                    )}

                    <CButton size="sm" color="warning" className="w-100"
                      onClick={() => handleShowQr(0)} disabled={qrLoading}>
                      {qrLoading ? <CSpinner size="sm" className="me-1" /> : null}
                      {qr ? 'Aggiorna QR' : 'Genera QR'}
                    </CButton>

                    {status.webhook_configured && (
                      <div className="text-muted small w-100" style={{ wordBreak: 'break-all' }}>
                        <CIcon icon={cilCheckCircle} className="text-success me-1" />
                        <code className="small">{status.webhook_url}</code>
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>
              )}
            </CRow>
          </>
        ) : null}

        <CModal visible={!!selectedComm} onClose={() => setSelectedComm(null)} size="lg">
          <CModalHeader>
            <CModalTitle>{selectedComm?.patient_name} — chat WhatsApp</CModalTitle>
          </CModalHeader>
          <CModalBody style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {convLoading && <div className="text-center"><CSpinner color="primary" /></div>}
            {!convLoading && convError && (
              <CAlert color="warning" className="mb-0">{convError}</CAlert>
            )}
            {!convLoading && !convError && convMessages.map(m => (
              <div
                key={m.id}
                className={`d-flex mb-3 ${m.fromMe ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: m.fromMe ? '#0d6efd' : '#e9ecef',
                    color: m.fromMe ? '#fff' : '#212529',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.text}
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                    {m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))}
            {!convLoading && !convError && convMessages.length === 0 && (
              <p className="text-muted text-center">Nessun messaggio</p>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setSelectedComm(null)}>Chiudi</CButton>
          </CModalFooter>
        </CModal>
      </PageLayout.ContentBody>
    </PageLayout>
  )
}

export default EvolutionSettingsPage
