import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormSelect,
  CSpinner,
  CAlert
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSettings, cilTrash, cilPlus } from '@coreui/icons'
import prestazioneWorkMappingService, { PrestazioneWorkMapping } from '@/services/api/prestazioneWorkMapping.service'
import { usePrestazioniStore, Prestazione } from '@/store/prestazioni.store'
import worksService, { Work } from '@/services/api/works.service'
import Select from 'react-select'
import toast from 'react-hot-toast'

const MappingPrestazioniCard: React.FC = () => {
  const [mappings, setMappings] = useState<PrestazioneWorkMapping[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null)
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null)
  const [editingMapping, setEditingMapping] = useState<PrestazioneWorkMapping | null>(null)

  const { categorieList, loadPrestazioni, isLoading: prestazioniLoading } = usePrestazioniStore()

  useEffect(() => {
    loadData()
    loadPrestazioni()
    loadWorks()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await prestazioneWorkMappingService.apiGetAll()
      setMappings(data)
    } catch (error: any) {
      toast.error('Errore caricamento mapping')
    } finally {
      setLoading(false)
    }
  }

  const loadWorks = async () => {
    try {
      const data = await worksService.apiGetAll()
      setWorks(data || [])
    } catch (error) {
      console.error('Failed to fetch works', error)
      toast.error('Errore caricamento work templates')
    }
  }

  const handleOpenModal = (mapping?: PrestazioneWorkMapping) => {
    if (mapping) {
      setEditingMapping(mapping)
      setSelectedWorkId(mapping.work_id)
      // Trova la prestazione corrispondente
      const prestazione = findPrestazioneByCode(mapping.codice_prestazione)
      setSelectedPrestazione(prestazione)
    } else {
      setEditingMapping(null)
      setSelectedPrestazione(null)
      setSelectedWorkId(null)
    }
    setModalOpen(true)
  }

  const findPrestazioneByCode = (codice: string): Prestazione | null => {
    for (const categoria of categorieList) {
      const prestazione = categoria.prestazioni.find((p) => p.id === codice)
      if (prestazione) return prestazione
    }
    return null
  }

  const handleSave = async () => {
    if (!selectedPrestazione || !selectedWorkId) {
      toast.error('Seleziona prestazione e work template')
      return
    }

    try {
      setLoading(true)
      await prestazioneWorkMappingService.apiUpsert(selectedPrestazione.id, selectedWorkId)
      toast.success('Mapping salvato')
      setModalOpen(false)
      loadData()
    } catch (error: any) {
      toast.error('Errore salvataggio mapping')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (codice: string) => {
    if (!confirm('Eliminare questo mapping?')) return

    try {
      setLoading(true)
      await prestazioneWorkMappingService.apiDelete(codice)
      toast.success('Mapping eliminato')
      loadData()
    } catch (error: any) {
      toast.error('Errore eliminazione mapping')
    } finally {
      setLoading(false)
    }
  }

  // Opzioni per react-select
  const allPrestazioni = categorieList.flatMap((cat) => cat.prestazioni)
  const prestazioniOptions = allPrestazioni.map((p) => ({
    value: p.id,
    label: `${p.codice_breve} ${p.nome}`,
    prestazione: p
  }))

  const selectedPrestazioneOption = selectedPrestazione
    ? {
      value: selectedPrestazione.id,
      label: `${selectedPrestazione.codice_breve} ${selectedPrestazione.nome}`,
      prestazione: selectedPrestazione
    }
    : null

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <CIcon icon={cilSettings} className="me-2" />
            Mapping Prestazioni → Work Templates
          </h5>
          <CButton color="primary" size="sm" onClick={() => handleOpenModal()}>
            <CIcon icon={cilPlus} className="me-1" /> Aggiungi Mapping
          </CButton>
        </CCardHeader>
        <CCardBody>
          {loading && !modalOpen ? (
            <div className="text-center p-4">
              <CSpinner size="sm" />
            </div>
          ) : mappings.length === 0 ? (
            <CAlert color="info">
              Nessun mapping configurato. Aggiungi un mapping per associare automaticamente prestazioni a work
              templates.
            </CAlert>
          ) : (
            <CTable hover responsive small>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Codice Prestazione</CTableHeaderCell>
                  <CTableHeaderCell>Nome Prestazione</CTableHeaderCell>
                  <CTableHeaderCell>Work Template</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {mappings.map((mapping) => {
                  const work = works.find((w) => w.id === mapping.work_id)
                  const prestazione = findPrestazioneByCode(mapping.codice_prestazione)
                  return (
                    <CTableRow key={mapping.id}>
                      <CTableDataCell>{prestazione ? prestazione.codice_breve : mapping.codice_prestazione}</CTableDataCell>
                      <CTableDataCell>{prestazione?.nome}</CTableDataCell>
                      <CTableDataCell>{work?.name || `ID ${mapping.work_id}`}</CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          color="info"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenModal(mapping)}
                          className="me-1"
                        >
                          <CIcon icon={cilSettings} />
                        </CButton>
                        <CButton
                          color="danger"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(mapping.codice_prestazione)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} backdrop="static" size="lg">
        <CModalHeader>{editingMapping ? 'Modifica Mapping' : 'Nuovo Mapping'}</CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Prestazione</CFormLabel>
            <Select
              options={prestazioniOptions}
              value={selectedPrestazioneOption}
              onChange={(option) => setSelectedPrestazione(option?.prestazione || null)}
              isClearable
              placeholder="Cerca prestazione..."
              isDisabled={prestazioniLoading || !!editingMapping}
              noOptionsMessage={() => 'Nessuna prestazione trovata'}
              filterOption={(option, inputValue) => {
                if (!inputValue) return true
                return option.label.toLowerCase().startsWith(inputValue.toLowerCase())
              }}
            />
            {editingMapping && (
              <small className="text-muted">Il codice prestazione non può essere modificato in edit mode</small>
            )}
          </div>

          <div className="mb-3">
            <CFormLabel>Work Template</CFormLabel>
            <CFormSelect
              value={selectedWorkId || ''}
              onChange={(e) => setSelectedWorkId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- Seleziona work template --</option>
              {works.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.name}
                </option>
              ))}
            </CFormSelect>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalOpen(false)} disabled={loading}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Salvataggio...' : 'Salva'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default MappingPrestazioniCard
