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
  CFormTextarea,
  CFormSwitch,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilReload } from '@coreui/icons'
import { emailService } from '../services/emailService'
import type { EmailScope } from '../types/email.types'
import { useEmailStore } from '../store/email.store'

const EmailScopesManager: React.FC = () => {
  const { scopes, fetchScopes } = useEmailStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EmailScope | null>(null)
  const [form, setForm] = useState({
    name: '',
    label: '',
    description: '',
    color: '#3399ff',
    active: 1,
  })

  useEffect(() => {
    fetchScopes()
  }, [fetchScopes])

  const handleRefresh = useCallback(async () => {
    await fetchScopes(true)
  }, [fetchScopes])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', label: '', description: '', color: '#3399ff', active: 1 })
    setShowModal(true)
  }

  const openEdit = (scope: EmailScope) => {
    setEditing(scope)
    setForm({
      name: scope.name,
      label: scope.label,
      description: scope.description || '',
      color: scope.color,
      active: scope.active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      if (editing) {
        const result = await emailService.apiUpdateScope(editing.id, form)
        if (!result.success) {
          setError(result.error || 'Errore aggiornamento')
          setLoading(false)
          return
        }
      } else {
        const result = await emailService.apiCreateScope(form)
        if (!result.success) {
          setError(result.error || 'Errore creazione')
          setLoading(false)
          return
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
    if (!confirm('Eliminare questo scopo? Le regole associate verranno rimosse.')) return
    try {
      await emailService.apiDeleteScope(id)
      handleRefresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Scopi / Categorie Email</strong>
          <div className="d-flex gap-2">
            <CButton color="outline-secondary" size="sm" onClick={handleRefresh}>
              <CIcon icon={cilReload} />
            </CButton>
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              Nuovo Scopo
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Colore</CTableHeaderCell>
                <CTableHeaderCell>Label</CTableHeaderCell>
                <CTableHeaderCell>Nome</CTableHeaderCell>
                <CTableHeaderCell>Descrizione</CTableHeaderCell>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell>Stato</CTableHeaderCell>
                <CTableHeaderCell style={{ width: '100px' }}>Azioni</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {scopes.map((scope) => (
                <CTableRow key={scope.id}>
                  <CTableDataCell>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: scope.color,
                      }}
                    />
                  </CTableDataCell>
                  <CTableDataCell>{scope.label}</CTableDataCell>
                  <CTableDataCell><code>{scope.name}</code></CTableDataCell>
                  <CTableDataCell className="text-muted">{scope.description}</CTableDataCell>
                  <CTableDataCell>
                    {scope.is_default ? (
                      <CBadge color="info">Predefinito</CBadge>
                    ) : (
                      <CBadge color="secondary">Custom</CBadge>
                    )}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={scope.active ? 'success' : 'secondary'}>
                      {scope.active ? 'Attivo' : 'Disattivo'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      color="outline-primary"
                      size="sm"
                      className="me-1"
                      onClick={() => openEdit(scope)}
                    >
                      <CIcon icon={cilPencil} />
                    </CButton>
                    <CButton
                      color="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(scope.id)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal create/edit */}
      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>{editing ? 'Modifica Scopo' : 'Nuovo Scopo'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Nome (identificativo)</CFormLabel>
            <CFormInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="es. fatture_fornitori"
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Label (visualizzata)</CFormLabel>
            <CFormInput
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="es. Fatture Fornitori"
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Descrizione</CFormLabel>
            <CFormTextarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrizione dello scopo..."
              rows={2}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Colore</CFormLabel>
            <CFormInput
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormSwitch
              label="Attivo"
              checked={form.active === 1}
              onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={loading || !form.name || !form.label}>
            {loading ? <CSpinner size="sm" /> : editing ? 'Salva' : 'Crea'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default EmailScopesManager
