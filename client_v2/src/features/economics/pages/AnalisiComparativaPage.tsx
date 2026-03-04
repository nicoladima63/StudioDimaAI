import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader, CRow, CCol, CSpinner, CAlert,
  CFormCheck, CButton, CButtonGroup, CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilChartLine } from '@coreui/icons'
import toast from 'react-hot-toast'

import MultiYearChart from '../components/MultiYearChart'
import TrimesterForecastCard from '../components/TrimesterForecastCard'
import KpiCard from '../components/KpiCard'
import HealthPulse from '../components/HealthPulse'
import CollaboratoriRedditivita from '../components/CollaboratoriRedditivita'
import { economicsService } from '../services/economics.service'
import type { MultiYearComparison, TrimesterForecast } from '../types'

type Metrica = 'produzione' | 'costi' | 'margine'

const ANNI_DISPONIBILI = (() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
})()

const AnalisiComparativaPage: React.FC = () => {
  const currentYear = new Date().getFullYear()

  // Stato anni selezionati (default: ultimi 3)
  const [anniSelezionati, setAnniSelezionati] = useState<number[]>([
    currentYear - 2, currentYear - 1, currentYear,
  ])

  // Dati
  const [comparisonData, setComparisonData] = useState<MultiYearComparison | null>(null)
  const [trimesterData, setTrimesterData] = useState<TrimesterForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [trimesterLoading, setTrimesterLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Metrica visualizzata nel grafico
  const [metrica, setMetrica] = useState<Metrica>('produzione')

  // Mostra/nascondi forecast nel grafico
  const [showForecast, setShowForecast] = useState(true)

  const loadData = useCallback(async () => {
    if (anniSelezionati.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const res = await economicsService.apiGetMultiYearComparison(anniSelezionati)
      if (res.state === 'success') {
        setComparisonData(res.data)
      } else {
        toast.error(res.error || 'Errore caricamento dati comparativi')
        setError(res.error || 'Errore caricamento')
      }
    } catch (err: any) {
      setError(err.message || 'Errore caricamento dati')
      toast.error('Errore caricamento dati comparativi')
    } finally {
      setLoading(false)
    }
  }, [anniSelezionati])

  const loadTrimester = useCallback(async () => {
    setTrimesterLoading(true)
    try {
      const res = await economicsService.apiGetTrimesterForecast(currentYear)
      if (res.state === 'success') {
        setTrimesterData(res.data)
      }
    } catch {
      // silenzioso, i dati trimestri sono secondari
    } finally {
      setTrimesterLoading(false)
    }
  }, [currentYear])

  useEffect(() => {
    loadData()
    loadTrimester()
  }, [])

  const handleToggleAnno = (anno: number) => {
    setAnniSelezionati(prev => {
      if (prev.includes(anno)) {
        return prev.filter(a => a !== anno)
      }
      return [...prev, anno].sort()
    })
  }

  const handleCarica = () => {
    loadData()
  }

  const handleClearCache = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await economicsService.apiInvalidateCache()
      if (res.state === 'success') {

      }
    } catch {

    } finally {
      setLoading(false)
    }
  }


  if (error && !comparisonData) {
    return (
      <CCard>
        <CCardHeader><strong>Analisi Comparativa</strong></CCardHeader>
        <CCardBody>
          <CAlert color="danger">{error}</CAlert>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>
          <CIcon icon={cilChartLine} className="me-2" />
          Analisi Comparativa Multi-Anno
        </strong>
        <CButton
          color="primary"
          size="sm"
          onClick={handleCarica}
          disabled={loading || anniSelezionati.length === 0}
        >
          {loading ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilReload} className="me-1" />}
          Aggiorna
        </CButton>
        <CButton
          color="success"
          size="sm"
          onClick={handleClearCache}
          disabled={loading || anniSelezionati.length === 0}
        >
          {loading ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilReload} className="me-1" />}
          Clear Cache
        </CButton>
      </CCardHeader>
      <CCardBody>
        {/* Selettore anni */}
        <CCard className="mb-4 border-light">
          <CCardBody className="py-3">
            <CRow className="align-items-center">
              <CCol xs={12} md={8}>
                <div className="fw-semibold mb-2">Seleziona gli anni da confrontare:</div>
                <div className="d-flex flex-wrap gap-3">
                  {ANNI_DISPONIBILI.map(anno => (
                    <CFormCheck
                      key={anno}
                      id={`anno-${anno}`}
                      label={String(anno)}
                      checked={anniSelezionati.includes(anno)}
                      onChange={() => handleToggleAnno(anno)}
                    />
                  ))}
                </div>
              </CCol>
              <CCol xs={12} md={4} className="text-md-end mt-2 mt-md-0">
                <CBadge color="info" shape="rounded-pill" className="me-2">
                  {anniSelezionati.length} anni selezionati
                </CBadge>
                <CButton
                  color="primary"
                  size="sm"
                  onClick={handleCarica}
                  disabled={loading || anniSelezionati.length === 0}
                >
                  Carica
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {loading ? (
          <div className="text-center py-5">
            <CSpinner color="primary" />
            <div className="mt-2 text-body-secondary">Caricamento dati comparativi...</div>
          </div>
        ) : comparisonData ? (
          <>
            {/* Indici di salute */}
            <HealthPulse data={comparisonData} />

            {/* Statistiche rapide */}
            {comparisonData.statistiche && (
              <CRow className="mb-4">
                <CCol xs={6} md={3}>
                  <KpiCard
                    title="Crescita Media"
                    value={comparisonData.statistiche.crescita_media_pct}
                    suffix="%"
                    color={comparisonData.statistiche.crescita_media_pct >= 0 ? '#2eb85c' : '#e55353'}
                    subtitle="anno su anno"
                  />
                </CCol>
                <CCol xs={6} md={3}>
                  <KpiCard
                    title="Anno Migliore"
                    value={comparisonData.statistiche.anno_migliore}
                    color="#321fdb"
                    subtitle="per produzione"
                  />
                </CCol>
                <CCol xs={6} md={3}>
                  <KpiCard
                    title="Media Mensile"
                    value={comparisonData.statistiche.media_mensile_globale}
                    suffix=" EUR"
                    color="#3399ff"
                    subtitle="tutti gli anni"
                  />
                </CCol>
                <CCol xs={6} md={3}>
                  <KpiCard
                    title="Forecast {currentYear}"
                    value={comparisonData.forecast.totale_previsto}
                    suffix=" EUR"
                    color="#e55353"
                    subtitle="produzione stimata"
                  />
                </CCol>
              </CRow>
            )}

            {/* Totali per anno */}
            <CCard className="mb-4">
              <CCardHeader>
                <strong>Riepilogo Annuale</strong>
              </CCardHeader>
              <CCardBody className="py-2">
                <CRow>
                  {[...anniSelezionati].sort().map(anno => {
                    const dati = comparisonData.dati_per_anno[String(anno)]
                    if (!dati) return null
                    const crescita = comparisonData.statistiche.crescite_annuali?.find(c => c.a === anno)
                    return (
                      <CCol key={anno} xs={12} md={Math.max(3, Math.floor(12 / anniSelezionati.length))}>
                        <div className="text-center border-end py-2">
                          <div className="fw-bold fs-5 mb-1">{anno}</div>
                          <div>
                            <span className="text-body-secondary small">Produzione: </span>
                            <strong style={{ color: '#321fdb' }}>
                              {dati.totale_produzione.toLocaleString('it-IT')} EUR
                            </strong>
                          </div>
                          <div>
                            <span className="text-body-secondary small">Costi: </span>
                            <strong style={{ color: '#e55353' }}>
                              {dati.totale_costi.toLocaleString('it-IT')} EUR
                            </strong>
                          </div>
                          <div>
                            <span className="text-body-secondary small">Margine: </span>
                            <strong style={{ color: dati.totale_margine >= 0 ? '#2eb85c' : '#e55353' }}>
                              {dati.totale_margine.toLocaleString('it-IT')} EUR
                            </strong>
                          </div>
                          {crescita && (
                            <div className="mt-1">
                              <CBadge color={crescita.delta_pct >= 0 ? 'success' : 'danger'} shape="rounded-pill">
                                {crescita.delta_pct >= 0 ? '+' : ''}{crescita.delta_pct.toFixed(1)}% vs {crescita.da}
                              </CBadge>
                            </div>
                          )}
                        </div>
                      </CCol>
                    )
                  })}
                </CRow>
              </CCardBody>
            </CCard>

            {/* Selettore metrica + toggle forecast */}
            <CRow className="mb-3 align-items-center">
              <CCol xs={12} md={6}>
                <CButtonGroup size="sm">
                  <CButton
                    color={metrica === 'produzione' ? 'primary' : 'outline-primary'}
                    onClick={() => setMetrica('produzione')}
                  >
                    Produzione
                  </CButton>
                  <CButton
                    color={metrica === 'costi' ? 'danger' : 'outline-danger'}
                    onClick={() => setMetrica('costi')}
                  >
                    Costi
                  </CButton>
                  <CButton
                    color={metrica === 'margine' ? 'success' : 'outline-success'}
                    onClick={() => setMetrica('margine')}
                  >
                    Margine
                  </CButton>
                </CButtonGroup>
              </CCol>
              <CCol xs={12} md={6} className="text-md-end mt-2 mt-md-0">
                <CFormCheck
                  id="show-forecast"
                  label={`Mostra previsione ${currentYear}`}
                  checked={showForecast}
                  onChange={() => setShowForecast(!showForecast)}
                  inline
                />
              </CCol>
            </CRow>

            {/* Grafico multi-anno */}
            <MultiYearChart
              datiPerAnno={comparisonData.dati_per_anno}
              anni={anniSelezionati}
              forecast={showForecast && metrica === 'produzione' ? comparisonData.forecast : null}
              metrica={metrica}
            />

            {/* Crescite anno su anno */}
            {comparisonData.statistiche.crescite_annuali && comparisonData.statistiche.crescite_annuali.length > 0 && (
              <CCard className="mb-4">
                <CCardHeader><strong>Variazioni Anno su Anno</strong></CCardHeader>
                <CCardBody>
                  <CRow>
                    {comparisonData.statistiche.crescite_annuali.map((c) => (
                      <CCol key={`${c.da}-${c.a}`} xs={6} md={4} lg={3} className="text-center mb-3">
                        <div className="text-body-secondary small">{c.da} &rarr; {c.a}</div>
                        <div className="fw-bold fs-5" style={{ color: c.delta_pct >= 0 ? '#2eb85c' : '#e55353' }}>
                          {c.delta_pct >= 0 ? '+' : ''}{c.delta_pct.toFixed(1)}%
                        </div>
                        <div className="small" style={{ color: c.delta >= 0 ? '#2eb85c' : '#e55353' }}>
                          {c.delta >= 0 ? '+' : ''}{c.delta.toLocaleString('it-IT')} EUR
                        </div>
                      </CCol>
                    ))}
                  </CRow>
                </CCardBody>
              </CCard>
            )}

            {/* Previsione trimestrale */}
            {trimesterLoading ? (
              <div className="text-center py-4">
                <CSpinner color="primary" size="sm" />
                <span className="ms-2 text-body-secondary">Caricamento previsione trimestrale...</span>
              </div>
            ) : trimesterData ? (
              <TrimesterForecastCard data={trimesterData} />
            ) : null}

            {/* Redditivita collaboratori */}
            <CollaboratoriRedditivita anno={currentYear} />
          </>
        ) : (
          <CAlert color="info">Seleziona almeno un anno e clicca "Carica" per visualizzare i dati.</CAlert>
        )}
      </CCardBody>
    </CCard>
  )
}

export default AnalisiComparativaPage
