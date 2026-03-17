import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardHeader,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CModalTitle,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilReload, cilCheckAlt, cilX } from '@coreui/icons'
import { emailService } from '../services/emailService'
import type { EmailFilterRule } from '../types/email.types'
import { useEmailStore } from '../store/email.store'
import TagInput from './TagInput'

const SCOPE_COLORS = [
  '#2196F3', '#4CAF50', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#795548', '#607D8B',
]

const FIELD_OPTIONS = [
  { value: 'from', label: 'Mittente (from)' },
  { value: 'subject', label: 'Oggetto (subject)' },
  { value: 'body', label: 'Corpo (body + snippet)' },
  { value: 'snippet', label: 'Anteprima (snippet)' },
  { value: 'to', label: 'Destinatario (to)' },
]

const OPERATOR_OPTIONS = [
  { value: 'contains', label: 'Contiene' },
  { value: 'equals', label: 'Uguale a' },
  { value: 'starts_with', label: 'Inizia con' },
  { value: 'ends_with', label: 'Finisce con' },
  { value: 'regex', label: 'Regex' },
]

interface RulePreset {
  field: string
  operator: string
  value: string
}

interface EmailRulesManagerProps {
  preset?: RulePreset | null
  onPresetConsumed?: () => void
}

const EmailRulesManager: React.FC<EmailRulesManagerProps> = ({ preset, onPresetConsumed }) => {
  const { scopes, rules, fetchRules, fetchScopes } = useEmailStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EmailFilterRule | null>(null)
  const [form, setForm] = useState({
    scope_id: 0,
    field: 'subject',
    operator: 'contains',
    value: '',
    priority: 0,
    active: 1,
  })
  const [showInlineScope, setShowInlineScope] = useState(false)
  const [inlineScopeLabel, setInlineScopeLabel] = useState('')
  const [inlineScopeColor, setInlineScopeColor] = useState(SCOPE_COLORS[0])
  const [creatingScopeLoading, setCreatingScopeLoading] = useState(false)

  useEffect(() => {
    fetchScopes()
    fetchRules()
  }, [fetchScopes, fetchRules])

  // Open modal pre-filled when preset arrives from EmailDetail
  useEffect(() => {
    if (preset) {
      setEditing(null)
      setForm({
        scope_id: scopes.length > 0 ? scopes[0].id : 0,
        field: preset.field,
        operator: preset.operator,
        value: preset.value,
        priority: 0,
        active: 1,
      })
      setShowModal(true)
      if (onPresetConsumed) onPresetConsumed()
    }
  }, [preset])

  const handleCreateScopeInline = async () => {
    if (!inlineScopeLabel.trim()) return
    setCreatingScopeLoading(true)
    try {
      const result = await emailService.apiCreateScope({
        name: inlineScopeLabel.trim().toLowerCase().replace(/\s+/g, '_'),
        label: inlineScopeLabel.trim(),
        color: inlineScopeColor,
        active: 1,
      })
      if (result.success && result.data) {
        const newScopeId = result.data.id
        await fetchScopes(true)
        setForm((prev) => ({ ...prev, scope_id: newScopeId }))
        setShowInlineScope(false)
        setInlineScopeLabel('')
        setInlineScopeColor(SCOPE_COLORS[0])
      } else {
        setError(result.error || 'Errore creazione scope')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingScopeLoading(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    await fetchRules()
  }, [fetchRules])

  const openCreate = () => {
    setEditing(null)
    setForm({
      scope_id: scopes.length > 0 ? scopes[0].id : 0,
      field: 'subject',
      operator: 'contains',
      value: '',
      priority: 0,
      active: 1,
    })
    setShowModal(true)
  }

  const openEdit = (rule: EmailFilterRule) => {
    setEditing(rule)
    setForm({
      scope_id: rule.scope_id,
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
      priority: rule.priority,
      active: rule.active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      if (editing) {
        const result = await emailService.apiUpdateRule(editing.id, form)
        if (!result.success) {
          setError(result.error || 'Errore aggiornamento')
          setLoading(false)
          return
        }
      } else {
        // Check if a compatible rule already exists (same scope + field + operator)
        const existingRule = rules.find(
          (r) =>
            r.scope_id === form.scope_id &&
            r.field === form.field &&
            r.operator === form.operator &&
            form.operator !== 'regex'
        )

        if (existingRule) {
          // Merge new tags into existing rule
          const existingTags = existingRule.value.split(',').map((v) => v.trim().toLowerCase())
          const newTags = form.value.split(',').map((v) => v.trim()).filter(Boolean)
          const tagsToAdd = newTags.filter((t) => !existingTags.includes(t.toLowerCase()))

          if (tagsToAdd.length === 0) {
            setError('Tutti i valori sono gia\' presenti nella regola esistente')
            setLoading(false)
            return
          }

          const mergedValue = [...existingRule.value.split(',').map((v) => v.trim()), ...tagsToAdd].join(',')
          const result = await emailService.apiUpdateRule(existingRule.id, {
            ...form,
            value: mergedValue,
          })
          if (!result.success) {
            setError(result.error || 'Errore aggiornamento regola esistente')
            setLoading(false)
            return
          }
        } else {
          const result = await emailService.apiCreateRule(form)
          if (!result.success) {
            setError(result.error || 'Errore creazione')
            setLoading(false)
            return
          }
        }
      }
      setShowModal(false)
      handleRefresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminare questa regola?')) return
    try {
      await emailService.apiDeleteRule(id)
      handleRefresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getScopeLabel = (scopeId: number) => {
    const scope = scopes.find((s) => s.id === scopeId)
    return scope ? scope.label : `ID ${scopeId}`
  }

  const getScopeColor = (scopeId: number) => {
    const scope = scopes.find((s) => s.id === scopeId)
    return scope?.color || '#999'
  }

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Regole di Filtro</strong>
          <div className="d-flex gap-2">
            <CButton color="outline-secondary" size="sm" onClick={handleRefresh}>
              <CIcon icon={cilReload} />
            </CButton>
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              Nuova Regola
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          {rules.length === 0 ? (
            <div className="text-center py-4 text-muted">
              Nessuna regola configurata. Crea una regola per iniziare a filtrare le email.
            </div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Scopo</CTableHeaderCell>
                  <CTableHeaderCell>Campo</CTableHeaderCell>
                  <CTableHeaderCell>Operatore</CTableHeaderCell>
                  <CTableHeaderCell>Valore</CTableHeaderCell>
                  <CTableHeaderCell>Priorita'</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '100px' }}>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rules.map((rule) => (
                  <CTableRow key={rule.id}>
                    <CTableDataCell>
                      <CBadge style={{ backgroundColor: getScopeColor(rule.scope_id) }}>
                        {rule.scope_label || getScopeLabel(rule.scope_id)}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {FIELD_OPTIONS.find((f) => f.value === rule.field)?.label || rule.field}
                    </CTableDataCell>
                    <CTableDataCell>
                      {OPERATOR_OPTIONS.find((o) => o.value === rule.operator)?.label || rule.operator}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex flex-wrap gap-1">
                        {rule.value.split(',').map((v, i) => (
                          <CBadge key={i} color="light" textColor="dark" shape="rounded-pill" className="border">
                            {v.trim()}
                          </CBadge>
                        ))}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>{rule.priority}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={rule.active ? 'success' : 'secondary'}>
                        {rule.active ? 'Attiva' : 'Disattiva'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="outline-primary"
                        size="sm"
                        className="me-1"
                        onClick={() => openEdit(rule)}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton
                        color="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* Modal create/edit */}
      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>{editing ? 'Modifica Regola' : 'Nuova Regola'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Scopo / Categoria</CFormLabel>
            <div className="d-flex gap-2 align-items-start">
              <div className="flex-grow-1">
                <CFormSelect
                  value={form.scope_id}
                  onChange={(e) => setForm({ ...form, scope_id: Number(e.target.value) })}
                >
                  <option value={0}>-- Seleziona scopo --</option>
                  {scopes.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              <CButton
                color="outline-success"
                size="sm"
                title="Crea nuovo scopo al volo"
                onClick={() => setShowInlineScope(!showInlineScope)}
                style={{ minWidth: '36px', height: '38px' }}
              >
                <CIcon icon={cilPlus} />
              </CButton>
            </div>
            {showInlineScope && (
              <div className="mt-2 p-3 border rounded bg-light">
                <small className="text-muted d-block mb-2">Crea nuovo scopo</small>
                <div className="d-flex gap-2 align-items-center">
                  <CFormInput
                    size="sm"
                    placeholder="Nome scopo (es. Fatture)"
                    value={inlineScopeLabel}
                    onChange={(e) => setInlineScopeLabel(e.target.value)}
                    className="flex-grow-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateScopeInline()
                    }}
                  />
                  <input
                    type="color"
                    value={inlineScopeColor}
                    onChange={(e) => setInlineScopeColor(e.target.value)}
                    style={{ width: '36px', height: '30px', padding: '2px', cursor: 'pointer' }}
                    title="Colore scopo"
                  />
                  <CButton
                    color="success"
                    size="sm"
                    onClick={handleCreateScopeInline}
                    disabled={creatingScopeLoading || !inlineScopeLabel.trim()}
                  >
                    {creatingScopeLoading ? <CSpinner size="sm" /> : <CIcon icon={cilCheckAlt} />}
                  </CButton>
                  <CButton
                    color="outline-secondary"
                    size="sm"
                    onClick={() => {
                      setShowInlineScope(false)
                      setInlineScopeLabel('')
                    }}
                  >
                    <CIcon icon={cilX} />
                  </CButton>
                </div>
              </div>
            )}
          </div>
          <div className="mb-3">
            <CFormLabel>Campo email</CFormLabel>
            <CFormSelect
              value={form.field}
              onChange={(e) => setForm({ ...form, field: e.target.value })}
            >
              {FIELD_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="mb-3">
            <CFormLabel>Operatore</CFormLabel>
            <CFormSelect
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value })}
            >
              {OPERATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="mb-3">
            <CFormLabel>Valore{form.operator !== 'regex' && 'i'}</CFormLabel>
            {form.operator === 'regex' ? (
              <>
                <CFormInput
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="es. fattur[ae]|invoice"
                />
                <small className="text-muted">
                  Usa espressioni regolari Python (case-insensitive)
                </small>
              </>
            ) : (
              <>
                <TagInput
                  value={form.value}
                  onChange={(val) => setForm({ ...form, value: val })}
                  placeholder="Digita un valore e premi Invio..."
                />
                <small className="text-muted">
                  Premi Invio per aggiungere un valore. Basta che uno dei valori corrisponda.
                </small>
              </>
            )}
          </div>
          <div className="mb-3">
            <CFormLabel>Priorita' (piu' alta = valutata prima)</CFormLabel>
            <CFormInput
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            Annulla
          </CButton>
          <CButton
            color="primary"
            onClick={handleSave}
            disabled={loading || !form.scope_id || !form.value}
          >
            {loading ? <CSpinner size="sm" /> : editing ? 'Salva' : 'Crea'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default EmailRulesManager
