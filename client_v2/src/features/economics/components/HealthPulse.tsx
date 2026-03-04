import React from 'react'
import { CCard, CCardBody, CCardHeader, CRow, CCol } from '@coreui/react'
import type { MultiYearComparison } from '../types'

interface HealthIndex {
  label: string
  value: number
  description: string
  thresholds: { ok: number; warn: number }
}

function computeIndices(data: MultiYearComparison): HealthIndex[] {
  const anni = [...data.anni].sort()
  const ultimoAnno = anni[anni.length - 1]
  const penultimoAnno = anni.length > 1 ? anni[anni.length - 2] : null

  const datiUltimo = data.dati_per_anno[String(ultimoAnno)]
  const datiPenultimo = penultimoAnno ? data.dati_per_anno[String(penultimoAnno)] : null

  const indices: HealthIndex[] = []

  // 1. Indice Crescita: crescita media annua produzione
  indices.push({
    label: 'Crescita',
    value: Math.round(data.statistiche.crescita_media_pct * 10) / 10,
    description: 'Crescita media annua produzione',
    thresholds: { ok: 1, warn: -1 },
  })

  // 2. MOL %: Margine Operativo Lordo (margine/produzione ultimo anno)
  // Gli ammortamenti non sono nei costi del gestionale, quindi margine ≈ MOL
  const molPct = datiUltimo && datiUltimo.totale_produzione > 0
    ? Math.round((datiUltimo.totale_margine / datiUltimo.totale_produzione) * 1000) / 10
    : 0
  indices.push({
    label: 'MOL %',
    value: molPct,
    description: `Margine Operativo Lordo (${ultimoAnno})`,
    thresholds: { ok: 20, warn: 10 },
  })

  // 3. Indice Tendenza: variazione margine % tra ultimi 2 anni
  if (datiPenultimo && datiPenultimo.totale_produzione > 0) {
    const molPctPenultimo = Math.round(
      (datiPenultimo.totale_margine / datiPenultimo.totale_produzione) * 1000
    ) / 10
    indices.push({
      label: 'Tendenza',
      value: Math.round((molPct - molPctPenultimo) * 10) / 10,
      description: `Variazione MOL % (${penultimoAnno} > ${ultimoAnno})`,
      thresholds: { ok: 1, warn: -1 },
    })
  }

  // 4. Indice Efficienza Costi: crescita produzione - crescita costi
  if (datiPenultimo && datiUltimo
    && datiPenultimo.totale_produzione > 0
    && datiPenultimo.totale_costi > 0
  ) {
    const crescitaProd = (
      (datiUltimo.totale_produzione - datiPenultimo.totale_produzione)
      / datiPenultimo.totale_produzione
    ) * 100
    const crescitaCosti = (
      (datiUltimo.totale_costi - datiPenultimo.totale_costi)
      / datiPenultimo.totale_costi
    ) * 100
    indices.push({
      label: 'Efficienza Costi',
      value: Math.round((crescitaProd - crescitaCosti) * 10) / 10,
      description: 'Crescita ricavi meno crescita costi',
      thresholds: { ok: 1, warn: -1 },
    })
  }

  return indices
}

function getColor(value: number, t: { ok: number; warn: number }): string {
  if (value >= t.ok) return '#2eb85c'
  if (value >= t.warn) return '#f9b115'
  return '#e55353'
}

function getStatusLabel(value: number, t: { ok: number; warn: number }): { text: string; bg: string } {
  if (value >= t.ok) return { text: 'OK', bg: '#d4edda' }
  if (value >= t.warn) return { text: 'ATTENZIONE', bg: '#fff3cd' }
  return { text: 'INTERVIENI', bg: '#f8d7da' }
}

const HealthPulse: React.FC<{ data: MultiYearComparison }> = ({ data }) => {
  const indices = computeIndices(data)

  return (
    <CCard className="mb-4 border-0" style={{ background: '#f8f9fa' }}>
      <CCardHeader className="bg-transparent border-0 pb-0">
        <div className="d-flex justify-content-between align-items-center">
          <strong>Indici di Salute</strong>
          <span className="text-body-secondary small">
            {'> 0 ok  |  ~ 0 attenzione  |  < 0 intervieni'}
          </span>
        </div>
      </CCardHeader>
      <CCardBody className="pt-2 pb-3">
        <CRow>
          {indices.map((idx) => {
            const color = getColor(idx.value, idx.thresholds)
            const status = getStatusLabel(idx.value, idx.thresholds)
            return (
              <CCol key={idx.label} xs={6} md={3}>
                <div
                  className="text-center py-3 px-2 rounded"
                  style={{ background: '#fff', border: `2px solid ${color}` }}
                >
                  <div
                    className="text-uppercase fw-bold small mb-2"
                    style={{ color, letterSpacing: '0.05em' }}
                  >
                    {idx.label}
                  </div>
                  <div className="fs-2 fw-bold mb-1" style={{ color }}>
                    {idx.value > 0 ? '+' : ''}{idx.value}%
                  </div>
                  <div
                    className="d-inline-block px-2 py-0 rounded-pill small fw-semibold mb-1"
                    style={{ background: status.bg, color }}
                  >
                    {status.text}
                  </div>
                  <div className="text-body-secondary mt-1" style={{ fontSize: '0.75rem' }}>
                    {idx.description}
                  </div>
                </div>
              </CCol>
            )
          })}
        </CRow>
      </CCardBody>
    </CCard>
  )
}

export default HealthPulse
