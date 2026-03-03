import React from 'react'
import {
  CCard, CCardBody, CCardHeader, CRow, CCol, CProgress, CBadge,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
} from '@coreui/react'
import type { TrimesterForecast, Trimestre } from '../types'

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const fmt = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 0 })

interface TrimesterForecastCardProps {
  data: TrimesterForecast
}

const StatoBadge: React.FC<{ stato: Trimestre['stato'] }> = ({ stato }) => {
  const colors: Record<string, string> = {
    completato: 'success',
    parziale: 'warning',
    previsto: 'info',
  }
  const labels: Record<string, string> = {
    completato: 'Completato',
    parziale: 'Parziale',
    previsto: 'Previsto',
  }
  return <CBadge color={colors[stato] || 'secondary'} shape="rounded-pill">{labels[stato] || stato}</CBadge>
}

const TrimesterForecastCard: React.FC<TrimesterForecastCardProps> = ({ data }) => {
  const { trimestri, totale_annuale, parametri } = data

  // Progress bar: produzione reale vs totale previsto
  const produzioneReale = trimestri.reduce((sum, t) => {
    return sum + t.dettaglio_mesi
      .filter(m => m.tipo === 'reale')
      .reduce((s, m) => s + m.produzione, 0)
  }, 0)
  const progressPct = totale_annuale.produzione > 0
    ? Math.min((produzioneReale / totale_annuale.produzione) * 100, 100)
    : 0

  return (
    <>
      {/* Totale annuale */}
      <CCard className="mb-4">
        <CCardHeader>
          <strong>Previsione Annuale {data.anno}</strong>
          <span className="float-end small text-body-secondary">
            Trend: {parametri.crescita_annuale_pct > 0 ? '+' : ''}{parametri.crescita_annuale_pct}%
            {' | '}Storico: {parametri.anni_storico} anni
          </span>
        </CCardHeader>
        <CCardBody>
          {/* KPI totali */}
          <CRow className="mb-3">
            <CCol xs={6} md={3} className="text-center">
              <div className="text-body-secondary small text-uppercase fw-semibold">Produzione</div>
              <div className="fs-5 fw-bold" style={{ color: '#321fdb' }}>{fmt(totale_annuale.produzione)} EUR</div>
            </CCol>
            <CCol xs={6} md={3} className="text-center">
              <div className="text-body-secondary small text-uppercase fw-semibold">Costi</div>
              <div className="fs-5 fw-bold" style={{ color: '#e55353' }}>{fmt(totale_annuale.costi)} EUR</div>
            </CCol>
            <CCol xs={6} md={3} className="text-center">
              <div className="text-body-secondary small text-uppercase fw-semibold">Margine</div>
              <div className="fs-5 fw-bold" style={{ color: totale_annuale.margine >= 0 ? '#2eb85c' : '#e55353' }}>
                {fmt(totale_annuale.margine)} EUR
              </div>
            </CCol>
            <CCol xs={6} md={3} className="text-center">
              <div className="text-body-secondary small text-uppercase fw-semibold">Margine %</div>
              <div className="fs-5 fw-bold" style={{ color: totale_annuale.margine_pct >= 0 ? '#2eb85c' : '#e55353' }}>
                {totale_annuale.margine_pct.toFixed(1)}%
              </div>
            </CCol>
          </CRow>

          {/* Progress */}
          <div className="mb-2 d-flex justify-content-between small">
            <span>Realizzato: <strong>{fmt(produzioneReale)} EUR</strong></span>
            <span>Obiettivo: <strong>{fmt(totale_annuale.produzione)} EUR</strong></span>
          </div>
          <CProgress
            value={progressPct}
            color={progressPct >= 100 ? 'success' : progressPct > 50 ? 'primary' : 'warning'}
            style={{ height: '20px' }}
          />
          <div className="text-center mt-1 text-body-secondary small">{progressPct.toFixed(1)}% completato</div>
        </CCardBody>
      </CCard>

      {/* Dettaglio trimestri */}
      <CRow className="mb-4">
        {trimestri.map((t) => (
          <CCol xs={12} md={6} lg={3} key={t.trimestre}>
            <CCard className="mb-3 h-100">
              <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                <strong>{t.nome} ({t.label})</strong>
                <StatoBadge stato={t.stato} />
              </CCardHeader>
              <CCardBody className="py-2">
                {/* Produzione con intervallo */}
                <div className="mb-2">
                  <div className="text-body-secondary small">Produzione</div>
                  <div className="fw-bold" style={{ color: '#321fdb' }}>{fmt(t.produzione)} EUR</div>
                  {t.stato !== 'completato' && t.produzione_min !== t.produzione_max && (
                    <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                      Range: {fmt(t.produzione_min)} - {fmt(t.produzione_max)}
                    </div>
                  )}
                </div>
                {/* Costi */}
                <div className="mb-2">
                  <div className="text-body-secondary small">Costi</div>
                  <div className="fw-bold" style={{ color: '#e55353' }}>{fmt(t.costi)} EUR</div>
                </div>
                {/* Margine */}
                <div className="mb-2">
                  <div className="text-body-secondary small">Margine</div>
                  <div className="fw-bold" style={{ color: t.margine >= 0 ? '#2eb85c' : '#e55353' }}>
                    {fmt(t.margine)} EUR ({t.margine_pct.toFixed(1)}%)
                  </div>
                </div>
                {/* Dettaglio mesi */}
                <CTable small borderless className="mb-0 mt-2" style={{ fontSize: '0.8rem' }}>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell className="py-0">Mese</CTableHeaderCell>
                      <CTableHeaderCell className="py-0 text-end">Prod.</CTableHeaderCell>
                      <CTableHeaderCell className="py-0 text-end">Tipo</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {t.dettaglio_mesi.map((m) => (
                      <CTableRow key={m.mese}>
                        <CTableDataCell className="py-0">{MESI_NOMI[m.mese - 1]}</CTableDataCell>
                        <CTableDataCell className="py-0 text-end">{fmt(m.produzione)}</CTableDataCell>
                        <CTableDataCell className="py-0 text-end">
                          <CBadge
                            color={m.tipo === 'reale' ? 'success' : 'info'}
                            shape="rounded-pill"
                            size="sm"
                          >
                            {m.tipo === 'reale' ? 'R' : 'P'}
                          </CBadge>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </>
  )
}

export default TrimesterForecastCard
