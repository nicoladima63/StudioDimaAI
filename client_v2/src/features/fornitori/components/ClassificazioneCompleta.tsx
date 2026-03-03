import React, { useState, useEffect } from 'react'
import {
  CRow, CCol, CFormSelect, CFormLabel, CButton, CSpinner, CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilTrash } from '@coreui/icons'
import toast from 'react-hot-toast'
import ContiSelect from '@/components/selects/ContiSelect'
import BrancheSelect from '@/components/selects/BrancheSelect'
import SottocontiSelect from '@/components/selects/SottocontiSelect'
import classificazioniService from '../services/classificazioni.service'
import type { ClassificazioneCosto, TipoDiCosto } from '../types'
import { TipoDiCostoLabels } from '../types'

interface ClassificazioneCompletaProps {
  codiceFornitore: string
  fornitoreNome?: string
  classificazione?: ClassificazioneCosto | null
  onClassificazioneChange?: (classificazione: ClassificazioneCosto | null) => void
  compact?: boolean
}

const ClassificazioneCompleta: React.FC<ClassificazioneCompletaProps> = ({
  codiceFornitore,
  fornitoreNome,
  classificazione: classificazioneProp,
  onClassificazioneChange,
  compact = false,
}) => {
  const [tipoDiCosto, setTipoDiCosto] = useState<TipoDiCosto | null>(null)
  const [contoId, setContoId] = useState<number | null>(null)
  const [brancaId, setBrancaId] = useState<number | null>(null)
  const [sottocontoId, setSottocontoId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [classificazione, setClassificazione] = useState<ClassificazioneCosto | null>(null)

  // Carica classificazione esistente (da prop o da API)
  useEffect(() => {
    if (classificazioneProp !== undefined) {
      applyClassificazione(classificazioneProp)
    } else if (codiceFornitore) {
      loadClassificazione()
    }
  }, [codiceFornitore, classificazioneProp])

  const loadClassificazione = async () => {
    setLoading(true)
    try {
      const res = await classificazioniService.getClassificazioneFornitore(codiceFornitore)
      if (res.success && res.data) {
        applyClassificazione(res.data)
      } else {
        applyClassificazione(null)
      }
    } catch {
      applyClassificazione(null)
    } finally {
      setLoading(false)
    }
  }

  const applyClassificazione = (c: ClassificazioneCosto | null) => {
    setClassificazione(c)
    setTipoDiCosto(c?.tipo_di_costo || null)
    setContoId(c?.contoid || null)
    setBrancaId(c?.brancaid || null)
    setSottocontoId(c?.sottocontoid || null)
  }

  const handleContoChange = (newContoId: number | null) => {
    setContoId(newContoId)
    setBrancaId(null)
    setSottocontoId(null)
  }

  const handleBrancaChange = (newBrancaId: number | null) => {
    setBrancaId(newBrancaId)
    setSottocontoId(null)
  }

  const handleSave = async () => {
    if (!tipoDiCosto) {
      toast.error('Seleziona un tipo di costo')
      return
    }

    setSaving(true)
    try {
      const res = await classificazioniService.salvaClassificazioneFornitoreCompleta(codiceFornitore, {
        tipo_di_costo: tipoDiCosto,
        contoid: contoId || 0,
        brancaid: brancaId || 0,
        sottocontoid: sottocontoId || 0,
        fornitore_nome: fornitoreNome || '',
      })

      if (res.success) {
        toast.success('Classificazione salvata')
        const nuova: ClassificazioneCosto = {
          ...classificazione,
          tipo_di_costo: tipoDiCosto,
          contoid: contoId || 0,
          brancaid: brancaId || 0,
          sottocontoid: sottocontoId || 0,
          data_modifica: new Date().toISOString(),
        }
        setClassificazione(nuova)
        onClassificazioneChange?.(nuova)
      } else {
        toast.error(res.error || 'Errore salvataggio')
      }
    } catch {
      toast.error('Errore salvataggio classificazione')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Rimuovere la classificazione di questo fornitore?')) return

    setSaving(true)
    try {
      const res = await classificazioniService.rimuoviClassificazioneFornitore(codiceFornitore)
      if (res.success) {
        toast.success('Classificazione rimossa')
        applyClassificazione(null)
        onClassificazioneChange?.(null)
      } else {
        toast.error(res.error || 'Errore rimozione')
      }
    } catch {
      toast.error('Errore rimozione classificazione')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-2">
        <CSpinner size="sm" />
      </div>
    )
  }

  const hasChanges =
    tipoDiCosto !== (classificazione?.tipo_di_costo || null) ||
    contoId !== (classificazione?.contoid || null) ||
    brancaId !== (classificazione?.brancaid || null) ||
    sottocontoId !== (classificazione?.sottocontoid || null)

  const isClassificato = classificazione?.tipo_di_costo != null

  return (
    <div className={compact ? '' : 'p-2'}>
      <CRow className="g-2">
        {/* Tipo di costo */}
        <CCol xs={12} md={compact ? 12 : 6} lg={compact ? 12 : 3}>
          {!compact && <CFormLabel className="mb-1 small fw-semibold">Tipo Costo</CFormLabel>}
          <CFormSelect
            size="sm"
            value={tipoDiCosto || ''}
            onChange={(e) => setTipoDiCosto(e.target.value ? Number(e.target.value) as TipoDiCosto : null)}
          >
            <option value="">-- Seleziona tipo --</option>
            {Object.entries(TipoDiCostoLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </CFormSelect>
        </CCol>

        {/* Conto */}
        <CCol xs={12} md={compact ? 12 : 6} lg={compact ? 12 : 3}>
          {!compact && <CFormLabel className="mb-1 small fw-semibold">Conto</CFormLabel>}
          <ContiSelect
            value={contoId}
            onChange={handleContoChange}
            autoSelectIfSingle
          />
        </CCol>

        {/* Branca */}
        {contoId && (
          <CCol xs={12} md={compact ? 12 : 6} lg={compact ? 12 : 3}>
            {!compact && <CFormLabel className="mb-1 small fw-semibold">Branca</CFormLabel>}
            <BrancheSelect
              contoId={contoId}
              value={brancaId}
              onChange={handleBrancaChange}
              autoSelectIfSingle
            />
          </CCol>
        )}

        {/* Sottoconto */}
        {brancaId && brancaId > 0 && (
          <CCol xs={12} md={compact ? 12 : 6} lg={compact ? 12 : 3}>
            {!compact && <CFormLabel className="mb-1 small fw-semibold">Sottoconto</CFormLabel>}
            <SottocontiSelect
              brancaId={brancaId}
              value={sottocontoId}
              onChange={setSottocontoId}
              autoSelectIfSingle
            />
          </CCol>
        )}
      </CRow>

      {/* Azioni */}
      <div className="d-flex gap-2 align-items-center mt-2">
        <CButton
          color="primary"
          size="sm"
          disabled={!tipoDiCosto || saving || !hasChanges}
          onClick={handleSave}
        >
          {saving ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilSave} size="sm" className="me-1" />}
          Salva
        </CButton>

        {isClassificato && (
          <CButton
            color="danger"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={handleRemove}
          >
            <CIcon icon={cilTrash} size="sm" className="me-1" />
            Rimuovi
          </CButton>
        )}

        {/* Badge stato */}
        {isClassificato && !hasChanges && (
          <CBadge color="success" className="ms-auto">
            Classificato: {TipoDiCostoLabels[classificazione!.tipo_di_costo!]}
          </CBadge>
        )}
        {hasChanges && tipoDiCosto && (
          <CBadge color="warning" className="ms-auto">
            Modifiche non salvate
          </CBadge>
        )}
      </div>
    </div>
  )
}

export default ClassificazioneCompleta
