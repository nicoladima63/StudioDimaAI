import React from 'react'
import { CCard, CCardBody } from '@coreui/react'
import { BarChart, Bar, ResponsiveContainer } from 'recharts'


interface Props {
  value: number
  percent: number
  data: { month: number, count: number }[]
  color?: string
}

const AppuntamentiCoreUICard: React.FC<Props> = ({ value, percent, data, color = '#ef4444' }) => {
  console.log(data)
  const isPositive = percent >= 0
  // Prepara i dati per la mini-barra (ultimi 12 mesi)
  const chartData = data.slice(-12).map(d => ({ value: d.count }))
  return (
    <CCard className="mb-4" style={{ background: color, color: '#fff', minWidth: 220, border: 'none' }}>
      <CCardBody style={{ position: 'relative', paddingBottom: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {value}{' '}
          <span style={{ fontSize: 16, color: isPositive ? '#4be38a' : '#ff7676', fontWeight: 500 }}>
            ({isPositive ? '+' : ''}{percent}% {isPositive ? '↑' : '↓'})
          </span>
        </div>
        <div style={{ fontSize: 15, opacity: 0.9, marginTop: 2, marginBottom: 8 }}>Appuntamentixxx</div>
        <div style={{ width: '100%', height: 40, position: 'absolute', left: 0, bottom: 0, opacity: 0.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart width={150} height={40} data={data}>
              <Bar dataKey="value" fill="#fff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default AppuntamentiCoreUICard 