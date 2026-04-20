import React, { useEffect, useState } from 'react'
import {
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CButton, CFormInput, CFormTextarea, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilTrash, cilPlus } from '@coreui/icons'
import type { StudioInfoItem } from '../types/bot.types'
import botService from '../services/botService'

const TEXTAREA_KEYS = ['orari_lun_ven', 'orari_sabato', 'orari_domenica', 'servizi', 'prompt_ruolo', 'prompt_can_answer', 'prompt_needs_human', 'prompt_emergency', 'prompt_regole_risposta']

const isTextarea = (chiave: string, valore: string) =>
  TEXTAREA_KEYS.includes(chiave) || valore.includes('\n') || valore.length > 60

interface Props {
  onToast: (msg: string, state: 'success' | 'warning' | 'error') => void
}

const StudioInfoTab: React.FC<Props> = ({ onToast }) => {
  const [items, setItems] = useState<StudioInfoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showModal, setShowModal] = useState(false)
  const [newChiave, setNewChiave] = useState('')
  const [newValore, setNewValore] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await botService.apiGetStudioInfo()
      if (res.success) {
        setItems(res.data.items)
        const map: Record<string, string> = {}
        res.data.items.forEach(i => { map[i.chiave] = i.valore })
        setEdits(map)
      }
    } catch {
      setError('Impossibile connettersi al database del bot. Verificare BOT_DB_HOST nel .env del server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (chiave: string) => {
    setSaving(chiave)
    try {
      await botService.apiUpdateStudioInfo(chiave, edits[chiave] ?? '')
      setItems(prev => prev.map(i => i.chiave === chiave ? { ...i, valore: edits[chiave] ?? '' } : i))
      onToast(`"${chiave}" aggiornato`, 'success')
    } catch {
      onToast(`Errore aggiornamento "${chiave}"`, 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (chiave: string) => {
    if (!confirm(`Eliminare la chiave "${chiave}"?`)) return
    try {
      await botService.apiDeleteStudioInfo(chiave)
      setItems(prev => prev.filter(i => i.chiave !== chiave))
      onToast(`"${chiave}" eliminato`, 'success')
    } catch {
      onToast(`Errore eliminazione "${chiave}"`, 'error')
    }
  }

  const handleCreate = async () => {
    if (!newChiave.trim()) return
    try {
      await botService.apiCreateStudioInfo(newChiave.trim(), newValore.trim())
      setShowModal(false)
      setNewChiave('')
      setNewValore('')
      onToast(`"${newChiave}" creato`, 'success')
      load()
    } catch {
      onToast('Errore creazione chiave', 'error')
    }
  }

  if (loading) return <div className="d-flex justify-content-center py-4"><CSpinner color="primary" /></div>

  if (error) return <CAlert color="danger">{error}</CAlert>

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted">Configurazione dati dello studio (usati dal bot WhatsApp)</span>
        <CButton color="primary" size="sm" onClick={() => setShowModal(true)}>
          <CIcon icon={cilPlus} className="me-1" />
          Aggiungi chiave
        </CButton>
      </div>

      <CTable striped hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell style={{ width: '30%' }}>Chiave</CTableHeaderCell>
            <CTableHeaderCell>Valore</CTableHeaderCell>
            <CTableHeaderCell style={{ width: '120px' }}>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {items.map((item) => (
            <CTableRow key={item.chiave}>
              <CTableDataCell>
                <code>{item.chiave}</code>
              </CTableDataCell>
              <CTableDataCell>
                {isTextarea(item.chiave, edits[item.chiave] ?? '') ? (
                  <CFormTextarea
                    value={edits[item.chiave] ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [item.chiave]: e.target.value }))}
                    rows={3}
                    style={{ fontSize: '0.875rem' }}
                  />
                ) : (
                  <CFormInput
                    value={edits[item.chiave] ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [item.chiave]: e.target.value }))}
                    size="sm"
                  />
                )}
              </CTableDataCell>
              <CTableDataCell>
                <CButton
                  color="success"
                  size="sm"
                  className="me-1"
                  onClick={() => handleSave(item.chiave)}
                  disabled={saving === item.chiave || edits[item.chiave] === item.valore}
                >
                  {saving === item.chiave
                    ? <CSpinner size="sm" />
                    : <CIcon icon={cilSave} />
                  }
                </CButton>
                <CButton
                  color="danger"
                  size="sm"
                  onClick={() => handleDelete(item.chiave)}
                >
                  <CIcon icon={cilTrash} />
                </CButton>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>

      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>Nuova chiave</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormInput
            className="mb-2"
            placeholder="Chiave (es. nome_studio)"
            value={newChiave}
            onChange={e => setNewChiave(e.target.value)}
          />
          <CFormInput
            placeholder="Valore"
            value={newValore}
            onChange={e => setNewValore(e.target.value)}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>Annulla</CButton>
          <CButton color="primary" onClick={handleCreate} disabled={!newChiave.trim()}>Crea</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default StudioInfoTab
