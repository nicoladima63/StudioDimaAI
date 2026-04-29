import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CButton, CSpinner, CAlert, CRow, CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilCalendar, cilPhone, cilClock, cilChevronBottom, cilChevronTop } from '@coreui/icons'
import PageLayout from '@/components/layout/PageLayout'
import richiami from '../services/richiami.service'
import type { PazienteCandidato, SlotPerPaziente } from '../services/richiami.service'

const TIPO_COLORS: Record<string, string> = {
  '1': '#808080',
  '2': '#800080',
  '3': '#FF00FF',
  '4': '#ADD8E6',
  '5': '#FF00FF',
  '6': '#FFC0CB',
}

function formatData(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('it-IT')
}

function parseSlotDate(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

const SlotLiberiPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const slotData = searchParams.get('data') || ''
  const slotOra = searchParams.get('ora') || ''

  const [candidati, setCandidati] = useState<PazienteCandidato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per ogni paziente: stato apertura e dati slot caricati
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({})
  const [slotData2, setSlotData2] = useState<Record<string, SlotPerPaziente>>({})
  const [slotError, setSlotError] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const carica = async () => {
      setLoading(true)
      setError(null)
      const res = await richiami.apiGetCandidatiSlot(10)
      if (cancelled) return
      if (res.success && res.pazienti) {
        setCandidati(res.pazienti)
      } else {
        setError(res.error || 'Errore caricamento candidati')
      }
      setLoading(false)
    }
    carica()
    return () => { cancelled = true }
  }, [])

  const togglePaziente = async (dbCode: string) => {
    const isOpen = expanded[dbCode]
    setExpanded(prev => ({ ...prev, [dbCode]: !isOpen }))

    if (!isOpen && !slotData2[dbCode] && !slotLoading[dbCode]) {
      setSlotLoading(prev => ({ ...prev, [dbCode]: true }))
      setSlotError(prev => ({ ...prev, [dbCode]: '' }))
      const res = await richiami.apiGetSlotPerPaziente(dbCode)
      setSlotLoading(prev => ({ ...prev, [dbCode]: false }))
      if (res.success && res.data) {
        setSlotData2(prev => ({ ...prev, [dbCode]: res.data! }))
      } else {
        setSlotError(prev => ({ ...prev, [dbCode]: res.error || 'Errore' }))
      }
    }
  }

  const slotHeader = slotData && slotOra
    ? `${parseSlotDate(slotData)} ore ${slotOra}`
    : slotData || 'Slot non specificato'

  return (
    <PageLayout>
      <PageLayout.Header title="Slot libero — Candidati" />
      <PageLayout.ContentBody>

        <CRow className="mb-3">
          <CCol>
            <CButton color="ghost" size="sm" onClick={() => navigate(-1)} className="d-flex align-items-center gap-1">
              <CIcon icon={cilArrowLeft} size="sm" />
              Indietro
            </CButton>
          </CCol>
        </CRow>

        {/* Slot cancellato */}
        <CAlert color="warning" className="d-flex align-items-center gap-2 mb-4">
          <CIcon icon={cilCalendar} />
          <div>
            <strong>Appuntamento cancellato:</strong> {slotHeader}
            {slotData && slotOra && (
              <span className="text-muted ms-2 small">
                — Seleziona un paziente da richiamare per occupare questo orario
              </span>
            )}
          </div>
        </CAlert>

        {/* Candidati */}
        <CCard>
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Pazienti da richiamare (scaduti)</span>
            {!loading && <CBadge color="primary">{candidati.length}</CBadge>}
          </CCardHeader>
          <CCardBody className="p-0">
            {loading && (
              <div className="text-center py-5">
                <CSpinner color="primary" />
                <div className="text-muted mt-2 small">Caricamento candidati...</div>
              </div>
            )}

            {!loading && error && (
              <div className="p-3">
                <CAlert color="danger">{error}</CAlert>
              </div>
            )}

            {!loading && !error && candidati.length === 0 && (
              <div className="text-center text-muted py-5">Nessun paziente scaduto trovato</div>
            )}

            {!loading && !error && candidati.length > 0 && (
              <CTable hover responsive striped small className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Nome</CTableHeaderCell>
                    <CTableHeaderCell>Cellulare</CTableHeaderCell>
                    <CTableHeaderCell>Tipo richiamo</CTableHeaderCell>
                    <CTableHeaderCell>Ultima visita</CTableHeaderCell>
                    <CTableHeaderCell>Ritardo</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {candidati.map(p => (
                    <React.Fragment key={p.id}>
                      <CTableRow>
                        <CTableDataCell>
                          <strong>{p.nome}</strong>
                        </CTableDataCell>
                        <CTableDataCell>
                          {p.cellulare ? (
                            <span>
                              <CIcon icon={cilPhone} size="sm" className="me-1 text-success" />
                              {p.cellulare}
                            </span>
                          ) : '—'}
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex flex-wrap gap-1">
                            {p.tipo_richiamo_nomi.length > 0
                              ? p.tipo_richiamo_nomi.map((nome, i) => (
                                <CBadge
                                  key={i}
                                  style={{
                                    backgroundColor: TIPO_COLORS[p.tipo_richiamo[i]] ?? '#808080',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  {nome}
                                </CBadge>
                              ))
                              : <span className="text-muted small">{p.tipo_richiamo || '—'}</span>
                            }
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>{formatData(p.ultima_visita)}</CTableDataCell>
                        <CTableDataCell>
                          {p.scaduto && p.giorni_ritardo > 0 ? (
                            <span className="text-danger fw-bold">
                              <CIcon icon={cilClock} size="sm" className="me-1" />
                              {p.giorni_ritardo}gg
                            </span>
                          ) : '—'}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="primary"
                            size="sm"
                            variant="outline"
                            onClick={() => togglePaziente(p.id)}
                            className="d-flex align-items-center gap-1"
                          >
                            <CIcon icon={expanded[p.id] ? cilChevronTop : cilChevronBottom} size="sm" />
                            {expanded[p.id] ? 'Chiudi' : 'Vedi slot'}
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>

                      {/* Riga espansa: slot disponibili */}
                      {expanded[p.id] && (
                        <CTableRow>
                          <CTableDataCell colSpan={6} className="bg-light">
                            {slotLoading[p.id] && (
                              <div className="py-2 text-center">
                                <CSpinner size="sm" className="me-2" />
                                <span className="text-muted small">Caricamento slot...</span>
                              </div>
                            )}
                            {slotError[p.id] && (
                              <CAlert color="danger" className="mb-0 py-2 small">{slotError[p.id]}</CAlert>
                            )}
                            {slotData2[p.id] && (
                              <SlotList
                                data={slotData2[p.id]}
                                pazienteCellulare={p.cellulare}
                              />
                            )}
                          </CTableDataCell>
                        </CTableRow>
                      )}
                    </React.Fragment>
                  ))}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>

      </PageLayout.ContentBody>
    </PageLayout>
  )
}

interface SlotListProps {
  data: SlotPerPaziente
  pazienteCellulare: string
}

const SlotList: React.FC<SlotListProps> = ({ data, pazienteCellulare }) => {
  const { slots, operatore_suggerito, ultima_igiene } = data

  return (
    <div className="p-2">
      <div className="d-flex align-items-center gap-3 mb-2">
        <small className="text-muted">
          Operatore suggerito: <strong className="text-dark">{operatore_suggerito}</strong>
        </small>
        {ultima_igiene?.data && (
          <small className="text-muted">
            Ultima igiene: <strong className="text-dark">{formatData(ultima_igiene.data)}</strong>
          </small>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="text-muted small">Nessuno slot disponibile nei prossimi giorni</div>
      ) : (
        <div className="d-flex flex-wrap gap-2">
          {slots.map((slot, i) => (
            <CCard key={i} style={{ minWidth: 180, border: '1px solid #ccc' }}>
              <CCardBody className="p-2">
                <div className="fw-bold small text-capitalize">{slot.giorno_nome}</div>
                <div className="text-primary small">{slot.inizio} — {slot.fine}</div>
                <div className="text-muted small">{slot.operatore}</div>
                {pazienteCellulare && (
                  <a
                    href={`tel:${pazienteCellulare}`}
                    className="btn btn-sm btn-success mt-1 w-100 d-flex align-items-center justify-content-center gap-1"
                  >
                    <CIcon icon={cilPhone} size="sm" />
                    Chiama
                  </a>
                )}
              </CCardBody>
            </CCard>
          ))}
        </div>
      )}
    </div>
  )
}

export default SlotLiberiPage
