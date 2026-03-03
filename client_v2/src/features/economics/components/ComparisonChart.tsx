import React from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ConfrontoMese } from '../types'

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

interface ComparisonChartProps {
  data: ConfrontoMese[]
  annoCorrente: number
  annoPrecedente: number
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, annoCorrente, annoPrecedente }) => {
  const chartData = data.map((m) => ({
    nome_mese: MESI_NOMI[m.mese - 1] || `M${m.mese}`,
    [annoCorrente]: m.produzione_corrente,
    [annoPrecedente]: m.produzione_precedente,
  }))

  const formatCurrency = (value: number) => `${value.toLocaleString('it-IT')} EUR`

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>Confronto {annoPrecedente} vs {annoCorrente}</strong></CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome_mese" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey={annoPrecedente} name={`${annoPrecedente}`} fill="#9da5b1" radius={[4, 4, 0, 0]} />
            <Bar dataKey={annoCorrente} name={`${annoCorrente}`} fill="#321fdb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  )
}

export default ComparisonChart
