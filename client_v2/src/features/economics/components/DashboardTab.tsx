import React, { useState, useEffect } from 'react'
import { CRow, CCol, CSpinner, CAlert, CFormSelect } from '@coreui/react'
import toast from 'react-hot-toast'
import KpiCard from './KpiCard'
import MonthlyChart from './MonthlyChart'
import BreakEvenIndicator from './BreakEvenIndicator'
import ComparisonChart from './ComparisonChart'
import { economicsService } from '../services/economics.service'
import type { KpiCurrent, KpiMonthly, KpiComparison } from '../types'

const DashboardTab: React.FC = () => {
  const currentYear = new Date().getFullYear()
  const [anno, setAnno] = useState(currentYear)
  const [kpiCurrent, setKpiCurrent] = useState<KpiCurrent | null>(null)
  const [kpiMonthly, setKpiMonthly] = useState<KpiMonthly | null>(null)
  const [kpiComparison, setKpiComparison] = useState<KpiComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [anno])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [resCurrent, resMonthly, resComparison] = await Promise.all([
        economicsService.apiGetKpiCurrent(anno),
        economicsService.apiGetKpiMonthly(anno),
        economicsService.apiGetKpiComparison(anno),
      ])

      if (resCurrent.state === 'success') setKpiCurrent(resCurrent.data)
      else toast.error(resCurrent.error || 'Errore caricamento KPI')

      if (resMonthly.state === 'success') setKpiMonthly(resMonthly.data)
      if (resComparison.state === 'success') setKpiComparison(resComparison.data)
    } catch (err: any) {
      setError(err.message || 'Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-body-secondary">Caricamento dati economici...</div>
      </div>
    )
  }

  if (error) return <CAlert color="danger">{error}</CAlert>

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <>
      {/* Selettore anno */}
      <CRow className="mb-4">
        <CCol xs={12} md={3}>
          <CFormSelect value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>

      {/* KPI Cards */}
      {kpiCurrent && (
        <>
          <CRow className="mb-4">
            <CCol xs={6} lg>
              <KpiCard title="Produzione YTD" value={kpiCurrent.produzione_ytd} suffix=" EUR" color="#321fdb" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard
                title="Margine YTD"
                value={kpiCurrent.margine_ytd}
                suffix=" EUR"
                color={kpiCurrent.margine_ytd >= 0 ? '#2eb85c' : '#e55353'}
              />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Ricavo/Ora" value={kpiCurrent.ricavo_medio_ora} suffix=" EUR" color="#f9b115" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard
                title="Margine %"
                value={kpiCurrent.margine_pct}
                suffix="%"
                color={kpiCurrent.margine_pct >= 0 ? '#2eb85c' : '#e55353'}
              />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Ore Cliniche" value={kpiCurrent.ore_cliniche_ytd} suffix="h" color="#3399ff" />
            </CCol>
          </CRow>

          {/* Breakdown Costi */}
          <CRow className="mb-4">
            <CCol xs={6} lg>
              <KpiCard title="Costi Totali" value={kpiCurrent.costi_totali_ytd} suffix=" EUR" color="#e55353" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Costi Diretti" value={kpiCurrent.costi_diretti_ytd} suffix=" EUR" color="#e55353" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Costi Indiretti" value={kpiCurrent.costi_indiretti_ytd} suffix=" EUR" color="#f9b115" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Non Deducibili" value={kpiCurrent.costi_non_deducibili_ytd} suffix=" EUR" color="#636f83" />
            </CCol>
            <CCol xs={6} lg>
              <KpiCard title="Non Classificati" value={kpiCurrent.costi_non_classificati_ytd} suffix=" EUR" color="#9da5b1" />
            </CCol>
          </CRow>
        </>
      )}

      {/* Grafico mensile */}
      {kpiMonthly && <MonthlyChart data={kpiMonthly.mesi} />}

      {/* Break-even */}
      {kpiCurrent && (
        <BreakEvenIndicator
          produzioneYtd={kpiCurrent.produzione_ytd}
          breakEvenMensile={kpiCurrent.break_even_mensile}
          mesiAnalizzati={kpiCurrent.mesi_con_dati}
        />
      )}

      {/* Confronto anno precedente */}
      {kpiComparison && kpiComparison.confronto.length > 0 && (
        <ComparisonChart
          data={kpiComparison.confronto}
          annoCorrente={kpiComparison.anno_corrente}
          annoPrecedente={kpiComparison.anno_precedente}
        />
      )}
    </>
  )
}

export default DashboardTab
