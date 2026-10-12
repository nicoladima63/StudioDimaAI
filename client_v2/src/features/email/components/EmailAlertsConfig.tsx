import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardHeader,
  CCardBody,
  CButton,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CAlert,
  CSpinner,
  CBadge,
  CRow,
  CCol,
  CListGroup,
  CListGroupItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilMagnifyingGlass } from '@coreui/icons'
import { emailService } from '../services/emailService'
import { userService } from '@/services/api/user.service'
import type { User } from '@/types'
import type {
  EmailAlertConfigItem,
  EmailAlertConfigPayload,
  EmailAlertLogItem,
  EmailAlertMode,
  EmailAlertPriority,
  EmailAlertRunResult,
} from '../types/email.types'

type FeedbackColor = 'success' | 'warning' | 'danger'

const MODE_LABELS: Record<EmailAlertMode, string> = {
  none: 'Nessun avviso',
  alert: 'Solo alert (notifica)',
  todo: 'Crea un todo',
}

const PRIORITY_LABELS: Record<EmailAlertPriority, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const STATE_TO_COLOR: Record<string, FeedbackColor> = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
}

const toPayload = (item: EmailAlertConfigItem): EmailAlertConfigPayload => ({
  mode: item.mode,
  recipient_id: item.recipient_id,
  priority: item.priority,
  due_days: item.due_days,
})

const isSame = (a: EmailAlertConfigItem, b: EmailAlertConfigItem): boolean =>
  a.mode === b.mode &&
  a.recipient_id === b.recipient_id &&
  a.priority === b.priority &&
  a.due_days === b.due_days

const formatTimestamp = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

const EmailAlertsConfig: React.FC = () => {
  const [saved, setSaved] = useState<EmailAlertConfigItem[]>([])
  const [drafts, setDrafts] = useState<Record<number, EmailAlertConfigItem>>({})
  const [users, setUsers] = useState<User[]>([])
  const [recent, setRecent] = useState<EmailAlertLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<EmailAlertRunResult | null>(null)
  const [feedback, setFeedback] = useState<{ color: FeedbackColor; text: string } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [configResult, usersResult, logResult] = await Promise.all([
        emailService.apiGetAlertConfig(),
        userService.apiGetAllUsers(),
        emailService.apiGetAlertLog(10),
      ])
      if (configResult.success && configResult.data) {
        const items = configResult.data.items
        setSaved(items)
        setDrafts(Object.fromEntries(items.map(item => [item.scope_id, item])))
      } else {
        setFeedback({ color: 'danger', text: configResult.error || 'Errore recupero configurazione avvisi' })
      }
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data)
      }
      if (logResult.success && logResult.data) {
        setRecent(logResult.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const updateDraft = (scopeId: number, changes: Partial<EmailAlertConfigItem>) => {
    setDrafts(prev => {
      const current = prev[scopeId]
      return current ? { ...prev, [scopeId]: { ...current, ...changes } } : prev
    })
  }

  const handleSave = async (scopeId: number) => {
    const draft = drafts[scopeId]
    if (!draft || savingId !== null) return

    setSavingId(scopeId)
    setFeedback(null)
    try {
      const result = await emailService.apiSaveAlertConfig(scopeId, toPayload(draft))
      if (result.success && result.data) {
        const item = result.data
        setSaved(prev => prev.map(s => (s.scope_id === scopeId ? item : s)))
        setDrafts(prev => ({ ...prev, [scopeId]: item }))
        setFeedback({
          color: STATE_TO_COLOR[result.state ?? 'success'] ?? 'success',
          text: `Avviso "${item.scope_label}" salvato.`,
        })
      } else {
        setFeedback({ color: 'danger', text: result.message || result.error || 'Errore salvataggio avviso' })
      }
    } finally {
      setSavingId(null)
    }
  }

  const handlePreview = async () => {
    setPreviewing(true)
    setFeedback(null)
    setPreview(null)
    try {
      const result = await emailService.apiRunAlerts(true)
      if (result.success && result.data) {
        setPreview(result.data)
        if (result.data.state !== 'success') {
          setFeedback({ color: STATE_TO_COLOR[result.data.state] ?? 'warning', text: result.data.message })
        }
      } else {
        setFeedback({ color: 'danger', text: result.error || 'Errore controllo avvisi' })
      }
    } finally {
      setPreviewing(false)
    }
  }

  const activeCount = saved.filter(item => item.mode !== 'none').length

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Avvisi email importanti</strong>
        <CBadge color={activeCount > 0 ? 'success' : 'secondary'}>
          {activeCount > 0 ? `${activeCount} attivi` : 'Nessun avviso attivo'}
        </CBadge>
      </CCardHeader>
      <CCardBody>
        <p className="text-muted small">
          Per ogni scopo scegli se avvisare l'utente con una notifica oppure assegnargli un todo.
          Il controllo gira ogni 10 minuti in orario studio e usa solo le regole dello scopo.
          Vengono considerate le email arrivate dopo l'attivazione.
        </p>

        {feedback && (
          <CAlert color={feedback.color} dismissible onClose={() => setFeedback(null)}>
            {feedback.text}
          </CAlert>
        )}

        {loading ? (
          <div className="text-center py-3">
            <CSpinner size="sm" />
          </div>
        ) : saved.length === 0 ? (
          <p className="text-muted mb-0">Nessuno scopo definito: creali nella tab Scopi e Regole.</p>
        ) : (
          <CListGroup flush>
            {saved.map(item => {
              const draft = drafts[item.scope_id] ?? item
              const dirty = !isSame(draft, item)
              const isTodo = draft.mode === 'todo'
              return (
                <CListGroupItem key={item.scope_id} className="px-0">
                  <div className="d-flex align-items-center mb-2">
                    <span
                      className="me-2"
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: item.scope_color || '#999',
                      }}
                    />
                    <strong>{item.scope_label}</strong>
                    {!item.scope_active && (
                      <CBadge color="secondary" className="ms-2">
                        Scopo disattivo
                      </CBadge>
                    )}
                  </div>
                  <CRow className="g-2 align-items-end">
                    <CCol sm={6}>
                      <CFormLabel className="small mb-1">Modalita</CFormLabel>
                      <CFormSelect
                        size="sm"
                        value={draft.mode}
                        onChange={e => updateDraft(item.scope_id, { mode: e.target.value as EmailAlertMode })}
                      >
                        {(Object.keys(MODE_LABELS) as EmailAlertMode[]).map(mode => (
                          <option key={mode} value={mode}>
                            {MODE_LABELS[mode]}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                    <CCol sm={6}>
                      <CFormLabel className="small mb-1">Destinatario</CFormLabel>
                      <CFormSelect
                        size="sm"
                        value={draft.recipient_id ?? ''}
                        disabled={draft.mode === 'none'}
                        onChange={e =>
                          updateDraft(item.scope_id, {
                            recipient_id: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      >
                        <option value="">Seleziona...</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.username}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                    {isTodo && (
                      <>
                        <CCol sm={6}>
                          <CFormLabel className="small mb-1">Priorita del todo</CFormLabel>
                          <CFormSelect
                            size="sm"
                            value={draft.priority}
                            onChange={e =>
                              updateDraft(item.scope_id, { priority: e.target.value as EmailAlertPriority })
                            }
                          >
                            {(Object.keys(PRIORITY_LABELS) as EmailAlertPriority[]).map(priority => (
                              <option key={priority} value={priority}>
                                {PRIORITY_LABELS[priority]}
                              </option>
                            ))}
                          </CFormSelect>
                        </CCol>
                        <CCol sm={6}>
                          <CFormLabel className="small mb-1">Scadenza (giorni lavorativi)</CFormLabel>
                          <CFormInput
                            size="sm"
                            type="number"
                            min={0}
                            max={30}
                            value={draft.due_days}
                            onChange={e =>
                              updateDraft(item.scope_id, {
                                due_days: Math.min(30, Math.max(0, Number(e.target.value) || 0)),
                              })
                            }
                          />
                        </CCol>
                      </>
                    )}
                    <CCol xs={12} className="text-end">
                      <CButton
                        size="sm"
                        color="primary"
                        variant="outline"
                        disabled={!dirty || savingId !== null}
                        onClick={() => handleSave(item.scope_id)}
                      >
                        {savingId === item.scope_id ? (
                          <CSpinner size="sm" className="me-1" />
                        ) : (
                          <CIcon icon={cilSave} className="me-1" />
                        )}
                        Salva
                      </CButton>
                    </CCol>
                  </CRow>
                </CListGroupItem>
              )
            })}
          </CListGroup>
        )}

        <div className="mt-3">
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            disabled={previewing || activeCount === 0}
            onClick={handlePreview}
          >
            {previewing ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilMagnifyingGlass} className="me-1" />
            )}
            Anteprima: cosa scatterebbe ora
          </CButton>
        </div>

        {preview && preview.state === 'success' && (
          <div className="mt-3">
            {preview.would_send.length === 0 ? (
              <p className="text-muted small mb-0">
                Nessuna email nuova da segnalare (controllate {preview.checked}).
              </p>
            ) : (
              <CListGroup flush>
                {preview.would_send.map(entry => (
                  <CListGroupItem key={entry.message_id} className="px-0 small">
                    <CBadge color={entry.mode === 'todo' ? 'warning' : 'info'} className="me-2">
                      {entry.mode === 'todo' ? 'Todo' : 'Alert'}
                    </CBadge>
                    <strong>{entry.scope_label}</strong>: {entry.subject}
                    <span className="text-muted"> - {entry.sender}</span>
                  </CListGroupItem>
                ))}
              </CListGroup>
            )}
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-4">
            <div className="small text-muted mb-1">Ultimi avvisi inviati</div>
            <CListGroup flush>
              {recent.map(entry => (
                <CListGroupItem key={entry.message_id} className="px-0 small">
                  <CBadge color={entry.action === 'todo' ? 'warning' : 'info'} className="me-2">
                    {entry.action === 'todo' ? 'Todo' : 'Alert'}
                  </CBadge>
                  {entry.subject || '(nessun oggetto)'}
                  <span className="text-muted">
                    {' '}
                    - {entry.recipient_username ?? 'utente'}, {formatTimestamp(entry.processed_at)}
                  </span>
                </CListGroupItem>
              ))}
            </CListGroup>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default EmailAlertsConfig
