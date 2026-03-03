import React, { useState, useEffect } from 'react'
import {
  CRow, CCol, CSpinner, CAlert, CCard, CCardBody, CCardHeader,
  CProgress, CButtonGroup, CButton,
} from '@coreui/react'
import toast from 'react-hot-toast'
import KpiCard from './KpiCard'
import ForecastChart from './ForecastChart'
import { economicsService } from '../services/economics.service'
import type { ForecastData } from '../types'

type ScenarioType = 'conservativo' | 'realistico' | 'ottimistico'

const ForecastTab: React.FC = () => {
  const currentYear = new Date().getFullYear()
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<ScenarioType>('realistico')

  useEffect(() => {
    loadForecast()
  }, [])

  const loadForecast = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await economicsService.apiGetForecast(currentYear)
      if (res.state === 'success') {
        setData(res.data)
      } else {
        toast.error(res.error || 'Errore caricamento forecast')
      }
    } catch (err: any) {
      setError(err.message || 'Errore caricamento forecast')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-body-secondary">Calcolo previsioni...</div>
      </div>
    )
  }

  if (error) return <CAlert color="danger">{error}</CAlert>
  if (!data) return <CAlert color="warning">Nessun dato disponibile</CAlert>

  const scenarioData = data[`scenario_${scenario}`]
  const obiettivo = scenarioData.produzione
  const produzioneReale = data.mesi
    .filter((m) => m.reale !== null)
    .reduce((sum, m) => sum + (m.reale ?? 0), 0)
  const progressPct = obiettivo > 0 ? Math.min((produzioneReale / obiettivo) * 100, 100) : 0

  return (
    <>
      {/* Selettore scenario */}
      <CRow className="mb-4">
        <CCol xs={12} className="d-flex justify-content-center">
          <CButtonGroup>
            <CButton
              color={scenario === 'conservativo' ? 'warning' : 'outline-warning'}
              onClick={() => setScenario('conservativo')}
            >
              Conservativo
            </CButton>
            <CButton
              color={scenario === 'realistico' ? 'primary' : 'outline-primary'}
              onClick={() => setScenario('realistico')}
            >
              Realistico
            </CButton>
            <CButton
              color={scenario === 'ottimistico' ? 'success' : 'outline-success'}
              onClick={() => setScenario('ottimistico')}
            >
              Ottimistico
            </CButton>
          </CButtonGroup>
        </CCol>
      </CRow>

      {/* KPI forecast */}
      <CRow className="mb-4">
        <CCol xs={6} md={3}>
          <KpiCard title="Produzione Stimata" value={scenarioData.produzione} suffix=" EUR" color="#321fdb" />
        </CCol>
        <CCol xs={6} md={3}>
          <KpiCard
            title="Margine Stimato"
            value={scenarioData.margine}
            suffix=" EUR"
            color={scenarioData.margine >= 0 ? '#2eb85c' : '#e55353'}
          />
        </CCol>
        <CCol xs={6} md={3}>
          <KpiCard title="Forecast Produzione" value={data.forecast_produzione} suffix=" EUR" color="#3399ff" />
        </CCol>
        <CCol xs={6} md={3}>
          <KpiCard
            title="Forecast Margine"
            value={data.forecast_margine}
            suffix=" EUR"
            color={data.forecast_margine >= 0 ? '#2eb85c' : '#e55353'}
          />
        </CCol>
      </CRow>

      {/* Barra progresso */}
      <CCard className="mb-4">
        <CCardHeader><strong>Progresso verso obiettivo ({scenario})</strong></CCardHeader>
        <CCardBody>
          <div className="d-flex justify-content-between mb-2">
            <span>Realizzato: <strong>{produzioneReale.toLocaleString('it-IT')} EUR</strong></span>
            <span>Obiettivo: <strong>{obiettivo.toLocaleString('it-IT')} EUR</strong></span>
          </div>
          <CProgress
            value={progressPct}
            color={progressPct >= 100 ? 'success' : progressPct > 60 ? 'primary' : 'warning'}
            style={{ height: '24px' }}
          />
          <div className="text-center mt-2 text-body-secondary">
            {progressPct.toFixed(1)}% completato
          </div>
        </CCardBody>
      </CCard>

      {/* Grafico forecast */}
      <ForecastChart data={data.mesi} title={`Previsione ${data.anno} - Scenario ${scenario}`} />
    </>
  )
}

export default ForecastTab
