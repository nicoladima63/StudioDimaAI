import React from 'react'
import { CCard, CCardBody } from '@coreui/react'

interface KpiCardProps {
  title: string
  value: number
  prefix?: string
  suffix?: string
  color?: string
  subtitle?: string
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, prefix = '', suffix = '', color = '#321fdb', subtitle }) => {
  return (
    <CCard className="mb-3">
      <CCardBody className="text-center py-3">
        <div className="text-body-secondary small text-uppercase fw-semibold mb-1">{title}</div>
        <div className="fs-4 fw-bold" style={{ color }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString('it-IT') : value}{suffix}
        </div>
        {subtitle && <div className="text-body-secondary small mt-1">{subtitle}</div>}
      </CCardBody>
    </CCard>
  )
}

export default KpiCard
