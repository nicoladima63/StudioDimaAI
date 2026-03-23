import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash, cilCalculator } from '@coreui/icons'
import toast from 'react-hot-toast'
import { economicsService } from '../services/economics.service'
import KpiCard from '../components/KpiCard'

interface Collaboratore {
  id: number
  nome: string
  tipo: string
}

interface OperatoreEntry {
  collaboratore_id: number | null
  nome: string
  ore_annue: number
  stipendio_annuo: number
}

const CentroCostoPage: React.FC = () => {
  // Dati struttura
  const [numRiuniti, setNumRiuniti] = useState<number>(3)
  const [oreAperturaSettimanali, setOreAperturaSettimanali] = useState<number>(40)
  const [settimaneAnno, setSettimaneAnno] = useState<number>(46)

  // Collaboratori dal BE
  const [collaboratoriDisponibili, setCollaboratoriDisponibili] = useState<Collaboratore[]>([])
  const [loadingCollab, setLoadingCollab] = useState(true)

  // Operatori aggiunti
  const [operatori, setOperatori] = useState<OperatoreEntry[]>([])
  const [selectedCollaboratore, setSelectedCollaboratore] = useState<number | ''>('')

  useEffect(() => {
    loadCollaboratori()
  }, [])

  const loadCollaboratori = async () => {
    setLoadingCollab(true)
    try {
      const res = await economicsService.apiGetCollaboratoriLista()
      if (res.state === 'success') {
        setCollaboratoriDisponibili(res.data)
      } else {
        toast.error(res.error || 'Errore caricamento collaboratori')
      }
    } catch {
      toast.error('Errore caricamento collaboratori')
    } finally {
      setLoadingCollab(false)
    }
  }

  // Ore totali disponibili della struttura
  const oreTotaliStruttura = useMemo(() => {
    return oreAperturaSettimanali * settimaneAnno
  }, [oreAperturaSettimanali, settimaneAnno])

  // Ore totali poltrona (struttura * riuniti)
  const oreTotaliPoltrona = useMemo(() => {
    return oreTotaliStruttura * numRiuniti
  }, [oreTotaliStruttura, numRiuniti])

  // Costo orario struttura
  const costoOrarioStruttura = useMemo(() => {
    if (oreTotaliStruttura === 0) return 0
    const costiTotaliStipendi = operatori.reduce((sum, op) => sum + op.stipendio_annuo, 0)
    return costiTotaliStipendi / oreTotaliStruttura
  }, [operatori, oreTotaliStruttura])

  // Calcoli per operatore
  const operatoriCalcolati = useMemo(() => {
    return operatori.map((op) => {
      const costoOrario = op.ore_annue > 0 ? op.stipendio_annuo / op.ore_annue : 0
      const utilizzoStruttura = oreTotaliStruttura > 0 ? (op.ore_annue / oreTotaliStruttura) * 100 : 0
      const utilizzoPoltrona = oreTotaliPoltrona > 0 ? (op.ore_annue / oreTotaliPoltrona) * 100 : 0

      return {
        ...op,
        costoOrario,
        utilizzoStruttura: Math.min(utilizzoStruttura, 100),
        utilizzoPoltrona: Math.min(utilizzoPoltrona, 100),
      }
    })
  }, [operatori, oreTotaliStruttura, oreTotaliPoltrona])

  // Totali
  const totali = useMemo(() => {
    const totOre = operatori.reduce((sum, op) => sum + op.ore_annue, 0)
    const totStipendi = operatori.reduce((sum, op) => sum + op.stipendio_annuo, 0)
    const costoOrarioMedio = totOre > 0 ? totStipendi / totOre : 0
    const utilizzoStruttura = oreTotaliStruttura > 0 ? (totOre / oreTotaliStruttura) * 100 : 0
    const utilizzoPoltrona = oreTotaliPoltrona > 0 ? (totOre / oreTotaliPoltrona) * 100 : 0

    return {
      ore: totOre,
      stipendi: totStipendi,
      costoOrarioMedio,
      utilizzoStruttura: Math.min(utilizzoStruttura, 100),
      utilizzoPoltrona: Math.min(utilizzoPoltrona, 100),
    }
  }, [operatori, oreTotaliStruttura, oreTotaliPoltrona])

  // Collaboratori gia' aggiunti (per escluderli dalla select)
  const collaboratoriAggiunti = useMemo(() => {
    return new Set(operatori.map((op) => op.collaboratore_id).filter(Boolean))
  }, [operatori])

  const handleAggiungiOperatore = useCallback(() => {
    if (selectedCollaboratore === '') return

    const collab = collaboratoriDisponibili.find((c) => c.id === Number(selectedCollaboratore))
    if (!collab) return

    setOperatori((prev) => [
      ...prev,
      {
        collaboratore_id: collab.id,
        nome: collab.nome,
        ore_annue: 1600,
        stipendio_annuo: 0,
      },
    ])
    setSelectedCollaboratore('')
  }, [selectedCollaboratore, collaboratoriDisponibili])

  const handleRimuoviOperatore = useCallback((index: number) => {
    setOperatori((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateOperatore = useCallback((index: number, field: keyof OperatoreEntry, value: number) => {
    setOperatori((prev) =>
      prev.map((op, i) => (i === index ? { ...op, [field]: value } : op)),
    )
  }, [])

  const formatEuro = (val: number) => val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <CCard>
      <CCardHeader>
        <strong>
          <CIcon icon={cilCalculator} className="me-2" />
          Calcolatore Centro di Costo
        </strong>
      </CCardHeader>
      <CCardBody>
        {/* Sezione 1: Dati Struttura */}
        <CCard className="mb-4 border-primary">
          <CCardHeader className="bg-primary bg-opacity-10">
            <strong>Dati Struttura</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3">
              <CCol xs={12} md={4}>
                <CFormLabel>Numero Riuniti</CFormLabel>
                <CFormInput
                  type="number"
                  min={1}
                  max={20}
                  value={numRiuniti}
                  onChange={(e) => setNumRiuniti(Number(e.target.value) || 1)}
                />
              </CCol>
              <CCol xs={12} md={4}>
                <CFormLabel>Ore Apertura Settimanali</CFormLabel>
                <CFormInput
                  type="number"
                  min={1}
                  max={80}
                  value={oreAperturaSettimanali}
                  onChange={(e) => setOreAperturaSettimanali(Number(e.target.value) || 1)}
                />
              </CCol>
              <CCol xs={12} md={4}>
                <CFormLabel>Settimane Lavorative / Anno</CFormLabel>
                <CFormInput
                  type="number"
                  min={1}
                  max={52}
                  value={settimaneAnno}
                  onChange={(e) => setSettimaneAnno(Number(e.target.value) || 1)}
                />
              </CCol>
            </CRow>
            <CRow className="mt-3">
              <CCol xs={12} md={4}>
                <div className="text-body-secondary small">Ore Totali Struttura / Anno</div>
                <div className="fs-5 fw-bold text-primary">{oreTotaliStruttura.toLocaleString('it-IT')} h</div>
              </CCol>
              <CCol xs={12} md={4}>
                <div className="text-body-secondary small">Ore Totali Poltrona / Anno (struttura x riuniti)</div>
                <div className="fs-5 fw-bold text-primary">{oreTotaliPoltrona.toLocaleString('it-IT')} h</div>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {/* Sezione 2: Operatori */}
        <CCard className="mb-4 border-success">
          <CCardHeader className="bg-success bg-opacity-10">
            <div className="d-flex justify-content-between align-items-center">
              <strong>Operatori</strong>
              <div className="d-flex gap-2 align-items-center">
                {loadingCollab ? (
                  <CSpinner size="sm" />
                ) : (
                  <>
                    <CFormSelect
                      size="sm"
                      style={{ width: '250px' }}
                      value={selectedCollaboratore}
                      onChange={(e) => setSelectedCollaboratore(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">-- Seleziona collaboratore --</option>
                      {collaboratoriDisponibili
                        .filter((c) => !collaboratoriAggiunti.has(c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome} {c.tipo === 'titolare' ? '(Titolare)' : ''}
                          </option>
                        ))}
                    </CFormSelect>
                    <CButton
                      color="success"
                      size="sm"
                      onClick={handleAggiungiOperatore}
                      disabled={selectedCollaboratore === ''}
                    >
                      <CIcon icon={cilPlus} className="me-1" />
                      Aggiungi
                    </CButton>
                  </>
                )}
              </div>
            </div>
          </CCardHeader>
          <CCardBody>
            {operatori.length === 0 ? (
              <CAlert color="info" className="mb-0">
                Nessun operatore aggiunto. Seleziona un collaboratore e clicca "Aggiungi".
              </CAlert>
            ) : (
              <CTable hover responsive striped>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Operatore</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '150px' }}>Ore Lavoro / Anno</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '180px' }}>Stipendio Annuo (EUR)</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '60px' }}></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {operatori.map((op, idx) => (
                    <CTableRow key={idx}>
                      <CTableDataCell className="align-middle fw-semibold">{op.nome}</CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number"
                          size="sm"
                          min={0}
                          max={3000}
                          value={op.ore_annue}
                          onChange={(e) => handleUpdateOperatore(idx, 'ore_annue', Number(e.target.value) || 0)}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number"
                          size="sm"
                          min={0}
                          step={100}
                          value={op.stipendio_annuo}
                          onChange={(e) =>
                            handleUpdateOperatore(idx, 'stipendio_annuo', Number(e.target.value) || 0)
                          }
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton color="danger" variant="ghost" size="sm" onClick={() => handleRimuoviOperatore(idx)}>
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

        {/* Sezione 3: Risultati per operatore */}
        {operatori.length > 0 && (
          <>
            {/* KPI riepilogative */}
            <CRow className="mb-4">
              <CCol xs={6} lg>
                <KpiCard
                  title="Costo Orario Struttura"
                  value={Number(costoOrarioStruttura.toFixed(2))}
                  suffix=" EUR"
                  color="#321fdb"
                  subtitle="Stipendi totali / Ore struttura"
                />
              </CCol>
              <CCol xs={6} lg>
                <KpiCard
                  title="Totale Stipendi"
                  value={Number(totali.stipendi.toFixed(2))}
                  suffix=" EUR"
                  color="#e55353"
                />
              </CCol>
              <CCol xs={6} lg>
                <KpiCard
                  title="Ore Operative Totali"
                  value={totali.ore}
                  suffix=" h"
                  color="#3399ff"
                />
              </CCol>
              <CCol xs={6} lg>
                <KpiCard
                  title="Costo Orario Medio"
                  value={Number(totali.costoOrarioMedio.toFixed(2))}
                  suffix=" EUR"
                  color="#f9b115"
                  subtitle="Stipendi totali / Ore operative totali"
                />
              </CCol>
              <CCol xs={6} lg>
                <KpiCard
                  title="Utilizzo Struttura"
                  value={Number(totali.utilizzoStruttura.toFixed(1))}
                  suffix="%"
                  color={totali.utilizzoStruttura > 80 ? '#2eb85c' : totali.utilizzoStruttura > 50 ? '#f9b115' : '#e55353'}
                />
              </CCol>
            </CRow>

            {/* Card per operatore */}
            <h5 className="mb-3">Dettaglio per Operatore</h5>
            <CRow className="g-3">
              {operatoriCalcolati.map((op, idx) => (
                <CCol xs={12} md={6} xl={4} key={idx}>
                  <CCard className="h-100">
                    <CCardHeader className="fw-semibold">{op.nome}</CCardHeader>
                    <CCardBody>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-body-secondary">Costo Orario</span>
                        <span className="fw-bold text-primary">{formatEuro(op.costoOrario)} EUR</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-body-secondary">Stipendio Annuo</span>
                        <span className="fw-semibold">{formatEuro(op.stipendio_annuo)} EUR</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-body-secondary">Ore Operative</span>
                        <span className="fw-semibold">{op.ore_annue.toLocaleString('it-IT')} h</span>
                      </div>
                      <hr />
                      <div className="mb-2">
                        <div className="d-flex justify-content-between mb-1">
                          <small className="text-body-secondary">Utilizzo Struttura</small>
                          <small className="fw-semibold">{op.utilizzoStruttura.toFixed(1)}%</small>
                        </div>
                        <CProgress
                          value={op.utilizzoStruttura}
                          color={op.utilizzoStruttura > 80 ? 'success' : op.utilizzoStruttura > 50 ? 'warning' : 'danger'}
                          className="mb-2"
                          style={{ height: '8px' }}
                        />
                      </div>
                      <div>
                        <div className="d-flex justify-content-between mb-1">
                          <small className="text-body-secondary">Utilizzo Poltrona</small>
                          <small className="fw-semibold">{op.utilizzoPoltrona.toFixed(1)}%</small>
                        </div>
                        <CProgress
                          value={op.utilizzoPoltrona}
                          color={op.utilizzoPoltrona > 80 ? 'success' : op.utilizzoPoltrona > 50 ? 'warning' : 'danger'}
                          className="mb-2"
                          style={{ height: '8px' }}
                        />
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
              ))}
            </CRow>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default CentroCostoPage
