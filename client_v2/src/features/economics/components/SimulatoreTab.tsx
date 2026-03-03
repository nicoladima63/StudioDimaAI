import React, { useState, useEffect, useRef } from 'react'
import {
  CRow, CCol, CSpinner, CAlert, CCard, CCardBody, CCardHeader,
  CFormRange, CFormLabel, CFormSwitch, CFormInput,
} from '@coreui/react'
import toast from 'react-hot-toast'
import KpiCard from './KpiCard'
import { economicsService } from '../services/economics.service'
import type { SimulazioneResult } from '../types'

const SimulatoreTab: React.FC = () => {
  const [aumentoTariffa, setAumentoTariffa] = useState(0)
  const [aumentoSaturazione, setAumentoSaturazione] = useState(0)
  const [nuovoOperatore, setNuovoOperatore] = useState(false)
  const [costoOperatore, setCostoOperatore] = useState(40000)
  const [riduzioneCosti, setRiduzioneCosti] = useState(0)
  const [aumentoOre, setAumentoOre] = useState(0)

  const [result, setResult] = useState<SimulazioneResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSimulation()
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [aumentoTariffa, aumentoSaturazione, nuovoOperatore, costoOperatore, riduzioneCosti, aumentoOre])

  const runSimulation = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await economicsService.apiSimulateScenario({
        aumento_tariffa_pct: aumentoTariffa,
        aumento_saturazione_pct: aumentoSaturazione,
        nuovo_operatore: nuovoOperatore,
        costo_nuovo_operatore: costoOperatore,
        riduzione_costi_pct: riduzioneCosti,
        aumento_ore_cliniche: aumentoOre,
      })
      if (res.state === 'success') {
        setResult(res.data)
      } else {
        toast.error(res.error || 'Errore simulazione')
      }
    } catch (err: any) {
      setError(err.message || 'Errore simulazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CRow>
        {/* Colonna parametri */}
        <CCol xs={12} lg={5}>
          <CCard className="mb-4">
            <CCardHeader><strong>Parametri Simulazione</strong></CCardHeader>
            <CCardBody>
              <div className="mb-4">
                <CFormLabel>Aumento tariffa: <strong>{aumentoTariffa}%</strong></CFormLabel>
                <CFormRange
                  min={0} max={50} step={1}
                  value={aumentoTariffa}
                  onChange={(e) => setAumentoTariffa(Number(e.target.value))}
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Aumento saturazione: <strong>{aumentoSaturazione}%</strong></CFormLabel>
                <CFormRange
                  min={0} max={30} step={1}
                  value={aumentoSaturazione}
                  onChange={(e) => setAumentoSaturazione(Number(e.target.value))}
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Riduzione costi: <strong>{riduzioneCosti}%</strong></CFormLabel>
                <CFormRange
                  min={0} max={30} step={1}
                  value={riduzioneCosti}
                  onChange={(e) => setRiduzioneCosti(Number(e.target.value))}
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Ore cliniche aggiuntive/mese: <strong>{aumentoOre}h</strong></CFormLabel>
                <CFormRange
                  min={0} max={40} step={2}
                  value={aumentoOre}
                  onChange={(e) => setAumentoOre(Number(e.target.value))}
                />
              </div>

              <div className="mb-4">
                <CFormSwitch
                  label="Nuovo collaboratore"
                  checked={nuovoOperatore}
                  onChange={(e) => setNuovoOperatore(e.target.checked)}
                />
                {nuovoOperatore && (
                  <CFormInput
                    type="number"
                    className="mt-2"
                    label="Costo annuale operatore"
                    value={costoOperatore}
                    onChange={(e) => setCostoOperatore(Number(e.target.value))}
                  />
                )}
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Colonna risultati */}
        <CCol xs={12} lg={7}>
          {loading && (
            <div className="text-center py-5">
              <CSpinner color="primary" size="sm" />
              <span className="ms-2 text-body-secondary">Simulazione in corso...</span>
            </div>
          )}

          {error && <CAlert color="danger">{error}</CAlert>}

          {result && !loading && (
            <>
              <CRow className="mb-4">
                <CCol xs={6}>
                  <KpiCard title="Nuova Produzione" value={result.simulato.produzione} suffix=" EUR" color="#321fdb" />
                </CCol>
                <CCol xs={6}>
                  <KpiCard
                    title="Nuovo Margine"
                    value={result.simulato.margine}
                    suffix=" EUR"
                    color={result.simulato.margine >= 0 ? '#2eb85c' : '#e55353'}
                    subtitle={`${result.simulato.margine_pct}%`}
                  />
                </CCol>
              </CRow>

              <CRow className="mb-4">
                <CCol xs={4}>
                  <KpiCard
                    title="Delta Produzione"
                    value={result.delta.produzione}
                    prefix={result.delta.produzione >= 0 ? '+' : ''}
                    suffix=" EUR"
                    color={result.delta.produzione >= 0 ? '#2eb85c' : '#e55353'}
                  />
                </CCol>
                <CCol xs={4}>
                  <KpiCard
                    title="Delta Margine"
                    value={result.delta.margine}
                    prefix={result.delta.margine >= 0 ? '+' : ''}
                    suffix=" EUR"
                    color={result.delta.margine >= 0 ? '#2eb85c' : '#e55353'}
                  />
                </CCol>
                <CCol xs={4}>
                  <KpiCard
                    title="Variazione %"
                    value={result.delta.produzione_pct}
                    prefix={result.delta.produzione_pct >= 0 ? '+' : ''}
                    suffix="%"
                    color={result.delta.produzione_pct >= 0 ? '#2eb85c' : '#e55353'}
                  />
                </CCol>
              </CRow>

              <CCard className="mb-4">
                <CCardHeader><strong>Dettaglio Impatti</strong></CCardHeader>
                <CCardBody>
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Fattore</th>
                        <th className="text-end">Impatto (EUR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.dettaglio_impatti).map(([key, val]) => (
                        <tr key={key}>
                          <td>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                          <td className={`text-end ${val >= 0 ? 'text-success' : 'text-danger'}`}>
                            {val >= 0 ? '+' : ''}{val.toLocaleString('it-IT')} EUR
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CCardBody>
              </CCard>

              <CCard>
                <CCardHeader><strong>Base vs Simulato</strong></CCardHeader>
                <CCardBody>
                  <CRow>
                    <CCol xs={6}>
                      <div className="text-body-secondary small mb-1">Scenario Base</div>
                      <div>Produzione: <strong>{result.base.produzione.toLocaleString('it-IT')} EUR</strong></div>
                      <div>Costi: <strong>{result.base.costi.toLocaleString('it-IT')} EUR</strong></div>
                      <div>Margine: <strong>{result.base.margine.toLocaleString('it-IT')} EUR</strong></div>
                    </CCol>
                    <CCol xs={6}>
                      <div className="text-body-secondary small mb-1">Scenario Simulato</div>
                      <div>Produzione: <strong>{result.simulato.produzione.toLocaleString('it-IT')} EUR</strong></div>
                      <div>Costi: <strong>{result.simulato.costi.toLocaleString('it-IT')} EUR</strong></div>
                      <div>Margine: <strong>{result.simulato.margine.toLocaleString('it-IT')} EUR</strong></div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            </>
          )}
        </CCol>
      </CRow>
    </>
  )
}

export default SimulatoreTab
