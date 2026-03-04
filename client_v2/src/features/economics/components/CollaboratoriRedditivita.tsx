import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader, CRow, CCol, CSpinner,
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CBadge, CProgress, CButton, CCollapse, CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilChevronBottom, cilChevronRight } from '@coreui/icons'
import toast from 'react-hot-toast'

import { economicsService } from '../services/economics.service'
import type { CollaboratoriRedditivitaData, CollaboratoreRedditivita } from '../types'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)

function getMarginColor(pct: number): string {
  if (pct > 40) return '#2eb85c'
  if (pct > 20) return '#3399ff'
  if (pct > 0) return '#f9b115'
  return '#e55353'
}

function getMarginBadge(pct: number): { color: string; text: string } {
  if (pct > 40) return { color: 'success', text: 'Ottimo' }
  if (pct > 20) return { color: 'info', text: 'Buono' }
  if (pct > 0) return { color: 'warning', text: 'Attenzione' }
  return { color: 'danger', text: 'Intervieni' }
}

function getTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'titolare': return 'Titolare'
    case 'percentuale': return 'A percentuale'
    case 'per_intervento': return 'Per intervento'
    default: return tipo
  }
}

const CollaboratoreCard: React.FC<{ collab: CollaboratoreRedditivita }> = ({ collab }) => {
  const [expanded, setExpanded] = useState(false)
  const badge = getMarginBadge(collab.margine_pct)
  const marginColor = getMarginColor(collab.margine_pct)

  return (
    <CCard className="mb-3">
      <CCardBody className="py-3">
        {/* Header con nome e badge */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 className="mb-0 fw-bold">{collab.medico_nome}</h6>
            <small className="text-body-secondary">{getTipoLabel(collab.tipo_compenso)}</small>
          </div>
          <CBadge color={badge.color} shape="rounded-pill">
            {badge.text}
          </CBadge>
        </div>

        {/* Barra margine */}
        <div className="mb-3">
          <div className="d-flex justify-content-between small mb-1">
            <span>Margine studio</span>
            <strong style={{ color: marginColor }}>{collab.margine_pct}%</strong>
          </div>
          <CProgress
            value={Math.max(0, Math.min(100, collab.margine_pct))}
            color={badge.color}
            style={{ height: '8px' }}
          />
        </div>

        {/* Numeri principali */}
        <CRow className="text-center mb-2">
          <CCol xs={4}>
            <div className="text-body-secondary small">Produzione</div>
            <div className="fw-bold" style={{ color: '#321fdb' }}>{formatCurrency(collab.produzione)}</div>
          </CCol>
          <CCol xs={4}>
            <div className="text-body-secondary small">Compenso</div>
            <div className="fw-bold" style={{ color: '#e55353' }}>{formatCurrency(collab.compenso)}</div>
          </CCol>
          <CCol xs={4}>
            <div className="text-body-secondary small">Resta allo studio</div>
            <div className="fw-bold" style={{ color: marginColor }}>{formatCurrency(collab.margine_studio)}</div>
          </CCol>
        </CRow>

        {/* Dettaglio compenso */}
        {collab.tipo_compenso !== 'titolare' && (
          <div className="text-body-secondary small text-center mb-2">
            {collab.dettaglio_compenso}
          </div>
        )}

        {/* Espandi branche */}
        {collab.branche.length > 0 && (
          <>
            <div className="text-center">
              <CButton
                color="link"
                size="sm"
                className="p-0 text-body-secondary"
                onClick={() => setExpanded(!expanded)}
              >
                <CIcon icon={expanded ? cilChevronBottom : cilChevronRight} size="sm" className="me-1" />
                {collab.num_prestazioni} prestazioni in {collab.branche.length} branche
              </CButton>
            </div>
            <CCollapse visible={expanded}>
              <CTable small hover borderless className="mt-2 mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell className="small">Branca</CTableHeaderCell>
                    <CTableHeaderCell className="small text-end">Importo</CTableHeaderCell>
                    <CTableHeaderCell className="small text-end">N.</CTableHeaderCell>
                    <CTableHeaderCell className="small text-end">%</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {collab.branche.map((b) => (
                    <CTableRow key={b.branca}>
                      <CTableDataCell className="small">{b.branca}</CTableDataCell>
                      <CTableDataCell className="small text-end fw-semibold">{formatCurrency(b.importo)}</CTableDataCell>
                      <CTableDataCell className="small text-end">{b.count}</CTableDataCell>
                      <CTableDataCell className="small text-end text-body-secondary">{b.percentuale}%</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCollapse>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

const ANNI_DISPONIBILI = (() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
})()

const CollaboratoriRedditivita: React.FC<{ anno?: number }> = ({ anno }) => {
  const [selectedAnno, setSelectedAnno] = useState(anno || new Date().getFullYear())
  const [data, setData] = useState<CollaboratoriRedditivitaData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await economicsService.apiGetCollaboratoriRedditivita(selectedAnno)
      if (res.state === 'success') {
        setData(res.data)
      } else {
        toast.error(res.error || 'Errore caricamento redditivita')
      }
    } catch {
      toast.error('Errore caricamento redditivita collaboratori')
    } finally {
      setLoading(false)
    }
  }, [selectedAnno])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Redditivita Collaboratori</strong>
        <div className="d-flex align-items-center gap-2">
          <CFormSelect
            size="sm"
            style={{ width: '100px' }}
            value={selectedAnno}
            onChange={(e) => setSelectedAnno(Number(e.target.value))}
          >
            {ANNI_DISPONIBILI.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </CFormSelect>
          <CButton color="primary" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="sm" />}
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
            <div className="mt-2 text-body-secondary">Caricamento...</div>
          </div>
        ) : data ? (
          <>
            {/* Totali studio */}
            <CCard className="mb-3 border-0" style={{ background: '#f8f9fa' }}>
              <CCardBody className="py-3">
                <CRow className="text-center">
                  <CCol xs={6} md={3}>
                    <div className="text-body-secondary small">Produzione Totale</div>
                    <div className="fs-5 fw-bold" style={{ color: '#321fdb' }}>{formatCurrency(data.totali.produzione)}</div>
                  </CCol>
                  <CCol xs={6} md={3}>
                    <div className="text-body-secondary small">Compensi Totali</div>
                    <div className="fs-5 fw-bold" style={{ color: '#e55353' }}>{formatCurrency(data.totali.compensi)}</div>
                  </CCol>
                  <CCol xs={6} md={3}>
                    <div className="text-body-secondary small">Margine Studio</div>
                    <div className="fs-5 fw-bold" style={{ color: getMarginColor(data.totali.margine_pct) }}>
                      {formatCurrency(data.totali.margine_studio)}
                    </div>
                  </CCol>
                  <CCol xs={6} md={3}>
                    <div className="text-body-secondary small">Margine %</div>
                    <div className="fs-5 fw-bold" style={{ color: getMarginColor(data.totali.margine_pct) }}>
                      {data.totali.margine_pct}%
                    </div>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Card per collaboratore */}
            <CRow>
              {data.collaboratori.map((collab) => (
                <CCol key={collab.medico_id} xs={12} md={6} xl={4}>
                  <CollaboratoreCard collab={collab} />
                </CCol>
              ))}
            </CRow>
          </>
        ) : null}
      </CCardBody>
    </CCard>
  )
}

export default CollaboratoriRedditivita
