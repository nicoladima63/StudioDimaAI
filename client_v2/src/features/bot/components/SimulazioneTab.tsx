import React, { useState } from 'react'
import {
  CButton, CSpinner, CAlert, CBadge, CTable, CTableHead, CTableBody,
  CTableRow, CTableHeaderCell, CTableDataCell, CCard, CCardBody, CCardHeader,
  CAccordion, CAccordionItem, CAccordionHeader, CAccordionBody,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMediaPlay, cilChatBubble, cilPhone } from '@coreui/icons'
import apiClient from '@/services/api/client'

interface SimAction {
  patient_name: string
  phone: string
  channel: 'whatsapp' | 'sms'
  type: string
  appointment_date: string
  appointment_time: string
  message: string
}

interface SimResults {
  reminders: SimAction[]
  recalls: SimAction[]
  emails: unknown[]
  timestamp?: string
}

const TIPO_BADGE: Record<string, { color: string; label: string }> = {
  '24h':      { color: 'info',    label: 'Reminder 24h' },
  '2h':       { color: 'primary', label: 'Reminder 2h' },
  'followup': { color: 'warning', label: 'Follow-up' },
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }) }
  catch { return d }
}

const ChannelIcon: React.FC<{ channel: string }> = ({ channel }) => (
  <CIcon icon={channel === 'whatsapp' ? cilChatBubble : cilPhone}
    className={channel === 'whatsapp' ? 'text-success me-1' : 'text-primary me-1'} />
)

const ReminderTable: React.FC<{ actions: SimAction[] }> = ({ actions }) => {
  if (actions.length === 0) return <CAlert color="info">Nessun reminder previsto.</CAlert>

  return (
    <CTable small hover responsive>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Paziente</CTableHeaderCell>
          <CTableHeaderCell>Appuntamento</CTableHeaderCell>
          <CTableHeaderCell>Tipo</CTableHeaderCell>
          <CTableHeaderCell>Canale</CTableHeaderCell>
          <CTableHeaderCell>Messaggio</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {actions.map((a, i) => {
          const tipo = TIPO_BADGE[a.type] ?? { color: 'secondary', label: a.type }
          return (
            <CTableRow key={i}>
              <CTableDataCell>
                <div>{a.patient_name || '—'}</div>
                <small className="text-muted">{a.phone}</small>
              </CTableDataCell>
              <CTableDataCell>
                <div>{fmtDate(a.appointment_date)}</div>
                <small className="text-muted">{a.appointment_time}</small>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={tipo.color}>{tipo.label}</CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <ChannelIcon channel={a.channel} />
                {a.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </CTableDataCell>
              <CTableDataCell>
                <small className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{a.message}</small>
              </CTableDataCell>
            </CTableRow>
          )
        })}
      </CTableBody>
    </CTable>
  )
}

const SimulazioneTab: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SimResults | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const runSimulation = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await apiClient.post('/simulation/run')
      const data = res.data?.data ?? res.data
      setResults({ ...data, timestamp: new Date().toLocaleTimeString('it-IT') })
    } catch (e: any) {
      setError(e?.message ?? 'Errore simulazione')
    } finally {
      setLoading(false)
    }
  }

  const totReminders = results?.reminders?.length ?? 0
  const totRecalls   = results?.recalls?.length ?? 0

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton color="primary" onClick={runSimulation} disabled={loading}>
          {loading
            ? <><CSpinner size="sm" className="me-2" />Simulazione in corso...</>
            : <><CIcon icon={cilMediaPlay} className="me-2" />Esegui simulazione</>
          }
        </CButton>
        <span className="text-muted small">
          Mostra chi verrebbe contattato adesso senza inviare nulla.
        </span>
        {results?.timestamp && (
          <CBadge color="secondary" className="ms-auto">Aggiornato: {results.timestamp}</CBadge>
        )}
      </div>

      {error && <CAlert color="danger">{error}</CAlert>}

      {results && (
        <CAccordion activeItemKey="reminders">
          <CAccordionItem itemKey="reminders">
            <CAccordionHeader>
              Reminder appuntamenti
              <CBadge color={totReminders > 0 ? 'primary' : 'secondary'} className="ms-2">{totReminders}</CBadge>
            </CAccordionHeader>
            <CAccordionBody>
              <ReminderTable actions={results.reminders ?? []} />
            </CAccordionBody>
          </CAccordionItem>

          <CAccordionItem itemKey="recalls">
            <CAccordionHeader>
              Richiami pazienti
              <CBadge color={totRecalls > 0 ? 'warning' : 'secondary'} className="ms-2">{totRecalls}</CBadge>
            </CAccordionHeader>
            <CAccordionBody>
              {totRecalls === 0
                ? <CAlert color="info">Nessun richiamo da inviare adesso.</CAlert>
                : (
                  <CTable small hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Paziente</CTableHeaderCell>
                        <CTableHeaderCell>Canale</CTableHeaderCell>
                        <CTableHeaderCell>Messaggio</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {results.recalls.map((a, i) => (
                        <CTableRow key={i}>
                          <CTableDataCell>
                            <div>{a.patient_name || '—'}</div>
                            <small className="text-muted">{a.phone}</small>
                          </CTableDataCell>
                          <CTableDataCell>
                            <ChannelIcon channel={a.channel} />
                            {a.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                          </CTableDataCell>
                          <CTableDataCell>
                            <small className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{a.message}</small>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                )
              }
            </CAccordionBody>
          </CAccordionItem>
        </CAccordion>
      )}

      {!results && !loading && (
        <CCard className="text-center py-5 border-dashed">
          <CCardBody className="text-muted">
            Premi "Esegui simulazione" per vedere chi verrebbe contattato in questo momento.
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default SimulazioneTab
