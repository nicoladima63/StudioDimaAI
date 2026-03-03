import React from 'react'
import { CCard, CCardBody, CCardHeader, CProgress } from '@coreui/react'

interface BreakEvenIndicatorProps {
  produzioneYtd: number
  breakEvenMensile: number
  mesiAnalizzati: number
}

const safe = (v: number) => (Number.isFinite(v) ? v : 0)

const BreakEvenIndicator: React.FC<BreakEvenIndicatorProps> = ({ produzioneYtd, breakEvenMensile, mesiAnalizzati }) => {
  const prod = safe(produzioneYtd)
  const be = safe(breakEvenMensile)
  const mesi = safe(mesiAnalizzati)
  const breakEvenYtd = be * mesi
  const percentuale = breakEvenYtd > 0 ? Math.min((prod / breakEvenYtd) * 100, 150) : 0
  const superato = prod >= breakEvenYtd
  const differenza = prod - breakEvenYtd

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>Break-Even YTD</strong></CCardHeader>
      <CCardBody>
        <div className="d-flex justify-content-between mb-2">
          <span>Produzione: <strong>{prod.toLocaleString('it-IT')} EUR</strong></span>
          <span>Target: <strong>{breakEvenYtd.toLocaleString('it-IT')} EUR</strong></span>
        </div>
        <CProgress
          value={percentuale}
          color={superato ? 'success' : percentuale > 80 ? 'warning' : 'danger'}
          className="mb-2"
          style={{ height: '20px' }}
        />
        <div className={`text-center fw-semibold ${superato ? 'text-success' : 'text-danger'}`}>
          {superato ? '+' : ''}{differenza.toLocaleString('it-IT')} EUR ({percentuale.toFixed(1)}%)
        </div>
      </CCardBody>
    </CCard>
  )
}

export default BreakEvenIndicator
