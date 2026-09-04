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
import evolutionService, { type EvolutionStatus, type RecentComm, type EvoMessage, type UpcomingReminder, type MissedReminderRecoveryResult } from '../services/evolution.service'

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

function upcomingContactBadge(status: UpcomingReminder['contact_status']) {
  const config = {
    automatico: { color: 'success', label: 'Automatico' },
    solo_fisso: { color: 'warning', label: 'Solo fisso' },
    mancante: { color: 'danger', label: 'Recapito mancante' },
  }[status]
  return <CBadge color={config.color}>{config.label}</CBadge>
}

type SortColumn = 'patient' | 'appointment' | 'sent'
type SortDirection = 'asc' | 'desc'
type CommunicationsView = 'today' | 'history'

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
  const [communicationsView, setCommunicationsView] = useState<CommunicationsView>('today')
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [testingReminders, setTestingReminders] = useState(false)
  const [sendingReminderIndex, setSendingReminderIndex] = useState<number | null>(null)
  const [sentReminderIndexes, setSentReminderIndexes] = useState<Set<number>>(() => new Set())
  const [recoveryPreview, setRecoveryPreview] = useState<MissedReminderRecoveryResult | null>(null)

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

  const todayReminders = useMemo(() => {
    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(item => item.type === type)?.value
    const today = `${part('year')}-${part('month')}-${part('day')}`
    return sortedCommunications.filter(c => c.appointment_date === today)
  }, [sortedCommunications])

  const sortedUpcomingReminders = useMemo(() => (
    [...upcomingReminders].sort((a, b) => {
      const appointmentComparison = `${a.appointment_date} ${a.appointment_time}`
        .localeCompare(`${b.appointment_date} ${b.appointment_time}`, 'it', { numeric: true })
      return appointmentComparison || a.patient_name.localeCompare(b.patient_name, 'it')
    })
  ), [upcomingReminders])

  const displayedCommunications = communicationsView === 'today'
    ? todayReminders
    : sortedCommunications

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

  const loadUpcomingReminders = useCallback(async () => {
    setUpcomingLoading(true)
    try {
      const result = await evolutionService.apiGetUpcoming24hReminders()
      setUpcomingReminders(result.items)
    } catch (err: unknown) {
      setAlert({ color: 'danger', msg: err instanceof Error ? err.message : 'Impossibile riscansionare gli appuntamenti di domani' })
    } finally {
      setUpcomingLoading(false)
    }
  }, [])

  const handleSendMissedReminder = async (actionIndex: number) => {
    if (!recoveryPreview?.snapshot_id) return
    setSendingReminderIndex(actionIndex)
    setAlert(null)
    try {
      const result = await evolutionService.apiSendMissedWhatsAppReminder(recoveryPreview.snapshot_id, actionIndex)
      if (result.sent_wa || result.already_sent || result.confirmed) {
        setSentReminderIndexes(current => new Set(current).add(actionIndex))
      }
      setAlert({
        color: result.errors.length ? 'warning' : 'success',
        msg: result.sent_wa
          ? 'Reminder WhatsApp inviato.'
          : result.already_sent
            ? 'Reminder gia inviato: nessun duplicato creato.'
            : result.confirmed
              ? 'Appuntamento gia confermato: nessun reminder inviato.'
              : 'Reminder non inviato: il contatto non risulta raggiungibile su WhatsApp.',
      })
      await Promise.all([loadStatus(), loadUpcomingReminders()])
    } catch (err: unknown) {
      setAlert({ color: 'danger', msg: err instanceof Error ? err.message : 'Invio reminder WhatsApp fallito' })
    } finally {
      setSendingReminderIndex(null)
    }
  }

  const handleTestMissedReminders = async () => {
    setTestingReminders(true)
    setAlert(null)
    try {
      const result = await evolutionService.apiTestMissedWhatsAppReminders()
      setRecoveryPreview(result)
      setSentReminderIndexes(new Set())
      setAlert({
        color: 'info',
        msg: `Test completato: ${result.simulated_actions.length} reminder pronti all'invio, ${result.already_sent} gia registrati. L'invio usera questa stessa lista per ${result.snapshot_expires_in_minutes} minuti.`,
      })
    } catch (err: unknown) {
      setAlert({ color: 'danger', msg: err instanceof Error ? err.message : 'Test confronto agenda fallito' })
    } finally {
      setTestingReminders(false)
    }
  }

  useEffect(() => {
    loadStatus()
    loadUpcomingReminders()
  }, [loadStatus, loadUpcomingReminders])

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
      <CButton size="sm" color="success" className="w-50" onClick={handleStop} disabled={stopping}>
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
      <CButton size="sm" color="success" className="w-50" onClick={handleStop} disabled={stopping}>
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
              color="info"
              variant="outline"
              onClick={handleTestMissedReminders}
              disabled={testingReminders || sendingReminderIndex !== null}
              title="Confronta agenda e registro reminder senza inviare messaggi"
            >
              {testingReminders ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilCheckCircle} className="me-1" />}
              Test e confronta agenda
            </CButton>
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

        {recoveryPreview && (
          <CCard className="mb-3 border-info">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>Anteprima reminder da inviare</strong>
              <CBadge color="info">Valida {recoveryPreview.snapshot_expires_in_minutes} min</CBadge>
            </CCardHeader>
            <CCardBody className="p-0">
              {recoveryPreview.simulated_actions.length === 0 ? (
                <div className="text-muted p-3">Nessun reminder da inviare: agenda e registro sono gia allineati.</div>
              ) : (
                <CTable responsive hover small className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell className="text-end">#</CTableHeaderCell>
                      <CTableHeaderCell>Paziente</CTableHeaderCell>
                      <CTableHeaderCell>Appuntamento</CTableHeaderCell>
                      <CTableHeaderCell>Reminder</CTableHeaderCell>
                      <CTableHeaderCell>Messaggio</CTableHeaderCell>
                      <CTableHeaderCell></CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {recoveryPreview.simulated_actions.map((action, index) => (
                      <CTableRow key={`${action.patient_id}-${action.appointment_date}-${action.appointment_time}-${action.type}`}>
                        <CTableDataCell className="text-end text-muted">{index + 1}</CTableDataCell>
                        <CTableDataCell className="fw-semibold">{action.patient_name}</CTableDataCell>
                        <CTableDataCell className="text-nowrap">{action.appointment_date} {action.appointment_time}</CTableDataCell>
                        <CTableDataCell>{messageTypeBadge(action.type)}</CTableDataCell>
                        <CTableDataCell className="small">{action.message}</CTableDataCell>
                        <CTableDataCell className="text-nowrap">
                          {sentReminderIndexes.has(index) ? (
                            <CBadge color="success">Gestito</CBadge>
                          ) : (
                            <CButton
                              size="sm"
                              color="warning"
                              onClick={() => handleSendMissedReminder(index)}
                              disabled={sendingReminderIndex !== null || status?.wa_state !== 'open'}
                              title="Invia soltanto questo reminder WhatsApp"
                            >
                              {sendingReminderIndex === index ? <CSpinner size="sm" /> : 'Invia'}
                            </CButton>
                          )}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        )}

        {loading && !status ? (
          <div className="text-center py-5"><CSpinner color="primary" /></div>
        ) : status ? (
          <>
            <CRow className="g-3 align-items-start">
              <CCol xs={12} lg={10}>
                {cmdOutput && (
                  <CAlert color={cmdOutput.ok ? 'primary' : 'danger'} className="mb-3 py-2">
                    <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}>{cmdOutput.text}</pre>
                  </CAlert>
                )}
                <CRow className="g-3">
                  <CCol xs={12} xl={6}>
                    <CCard className="d-flex flex-column" style={{ height: 'calc(100vh - 210px)', minHeight: 400 }}>
                      <CCardHeader className="d-flex align-items-center justify-content-between gap-2">
                        <strong>{communicationsView === 'today' ? 'Reminder per oggi' : 'Storico messaggi'}</strong>
                        <div className="btn-group" role="group" aria-label="Visualizzazione messaggi">
                          <CButton
                            size="sm"
                            color="info"
                            variant={communicationsView === 'today' ? undefined : 'outline'}
                            onClick={() => setCommunicationsView('today')}
                            aria-pressed={communicationsView === 'today'}
                          >
                            Oggi
                          </CButton>
                          <CButton
                            size="sm"
                            color="info"
                            variant={communicationsView === 'history' ? undefined : 'outline'}
                            onClick={() => setCommunicationsView('history')}
                            aria-pressed={communicationsView === 'history'}
                          >
                            Storico
                          </CButton>
                        </div>
                      </CCardHeader>
                      <CCardBody className="p-0 flex-grow-1 overflow-hidden">
                        {displayedCommunications.length === 0 ? (
                          <div className="text-muted text-center py-4">
                            {communicationsView === 'today' ? 'Nessun reminder per oggi' : 'Nessun messaggio nello storico'}
                          </div>
                        ) : (
                          <div className="h-100" style={{ overflowY: 'auto' }}>
                            <CTable hover responsive small className="mb-0">
                              <CTableHead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <CTableRow>
                                  <CTableHeaderCell className="text-end">#</CTableHeaderCell>
                                  {sortableHeader('Paziente', 'patient')}
                                  {sortableHeader('Appuntamento', 'appointment')}
                                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                                  <CTableHeaderCell>Canale</CTableHeaderCell>
                                  <CTableHeaderCell>Stato</CTableHeaderCell>
                                  <CTableHeaderCell></CTableHeaderCell>
                                </CTableRow>
                              </CTableHead>
                              <CTableBody>
                                {displayedCommunications.map((c, index) => (
                                  <CTableRow key={c.id}>
                                    <CTableDataCell className="text-end text-muted">{index + 1}</CTableDataCell>
                                    <CTableDataCell className="fw-semibold">{c.patient_name}</CTableDataCell>
                                    <CTableDataCell className="text-nowrap">{c.appointment_date} {c.appointment_time}</CTableDataCell>
                                    <CTableDataCell>{messageTypeBadge(c.type)}</CTableDataCell>
                                    <CTableDataCell>{channelBadge(c.channel)}</CTableDataCell>
                                    <CTableDataCell>{statoBadge(c.stato)}</CTableDataCell>
                                    <CTableDataCell>
                                      {c.channel === 'whatsapp' && (
                                        <CButton color="success" variant="outline" size="sm" onClick={() => handleOpenConversation(c)} title="Vedi conversazione">
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

                  <CCol xs={12} xl={6}>
                    <CCard className="d-flex flex-column" style={{ height: 'calc(100vh - 210px)', minHeight: 400 }}>
                      <CCardHeader className="d-flex align-items-center justify-content-between gap-2">
                        <strong>Reminder per domani</strong>
                        <CButton size="sm" color="info" variant="outline" onClick={loadUpcomingReminders} disabled={upcomingLoading} title="Rileggi APPUNTA.DBF e PAZIENTI.DBF">
                          {upcomingLoading ? <CSpinner size="sm" /> : <><CIcon icon={cilReload} className="me-1" />Riscansiona DB</>}
                        </CButton>
                      </CCardHeader>
                      <CCardBody className="p-0 flex-grow-1 overflow-hidden">
                        {upcomingLoading && upcomingReminders.length === 0 ? (
                          <div className="text-center py-4"><CSpinner color="primary" /></div>
                        ) : upcomingReminders.length === 0 ? (
                          <div className="text-muted text-center py-4">Nessun reminder pianificato per domani</div>
                        ) : (
                          <div className="h-100" style={{ overflowY: 'auto' }}>
                            <CTable hover responsive small className="mb-0">
                              <CTableHead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <CTableRow>
                                  <CTableHeaderCell className="text-end">#</CTableHeaderCell>
                                  <CTableHeaderCell>Paziente</CTableHeaderCell>
                                  <CTableHeaderCell>Appuntamento</CTableHeaderCell>
                                  <CTableHeaderCell>Recapito</CTableHeaderCell>
                                </CTableRow>
                              </CTableHead>
                              <CTableBody>
                                {sortedUpcomingReminders.map((reminder, index) => (
                                  <CTableRow key={`${reminder.patient_id}-${reminder.appointment_date}-${reminder.appointment_time}`}>
                                    <CTableDataCell className="text-end text-muted">{index + 1}</CTableDataCell>
                                    <CTableDataCell className="fw-semibold">{reminder.patient_name}</CTableDataCell>
                                    <CTableDataCell className="text-nowrap">{reminder.appointment_date} {reminder.appointment_time}</CTableDataCell>
                                    <CTableDataCell>
                                      {upcomingContactBadge(reminder.contact_status)}
                                      {reminder.phone && <div className="small text-muted mt-1">{reminder.phone}</div>}
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
                </CRow>
              </CCol>

              <CCol xs={12} lg={2}>
                <div className="d-flex flex-column gap-2">
                  {(
                    [
                      { label: 'Docker', color: (status.docker_running ? 'success' : 'warning') as TrafficLight, icon: cilSettings, action: dockerAction },
                      { label: 'Evolution API', color: statusColor(status.evolution_reachable), icon: cilLink, action: evolutionAction },
                      { label: 'WhatsApp', color: (status.wa_state === 'open' ? 'success' : status.wa_state === 'connecting' ? 'warning' : status.wa_state === 'close' ? 'danger' : 'secondary') as TrafficLight, icon: cilPhone, action: waAction },
                      { label: 'Webhook', color: statusColor(status.webhook_configured), detail: status.webhook_configured ? 'Configurato' : 'Non configurato', icon: cilCheckCircle },
                      { label: 'Reminder 24h', color: statusColor(status.reminder_24h_enabled), detail: status.reminder_24h_enabled ? 'Attivo' : 'Spento', icon: cilBell },
                      { label: 'Reminder 2h', color: statusColor(status.reminder_2h_enabled), detail: status.reminder_2h_enabled ? 'Attivo' : 'Spento', icon: cilBell },
                    ] as StatusCardProps[]
                  ).map(c => <StatusCard key={c.label} {...c} />)}
                </div>

                {status.instance_exists && status.wa_state !== 'open' && (
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
                )}
              </CCol>
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
