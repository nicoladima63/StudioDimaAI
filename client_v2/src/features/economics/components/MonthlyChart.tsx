import React from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { KpiMeseItem } from '../types'

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

interface MonthlyChartProps {
  data: KpiMeseItem[]
  title?: string
}

const MonthlyChart: React.FC<MonthlyChartProps> = ({ data, title = 'Produzione vs Costi Mensile' }) => {
  const chartData = data.map((m) => ({
    nome_mese: MESI_NOMI[m.mese - 1] || `M${m.mese}`,
    produzione: m.produzione,
    costi_diretti: m.costi_diretti || 0,
    costi_indiretti: m.costi_indiretti || 0,
    costi_non_deducibili: m.costi_non_deducibili || 0,
  }))

  const formatCurrency = (value: number) => `${value.toLocaleString('it-IT')} EUR`

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome_mese" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="produzione" name="Produzione" fill="#2eb85c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="costi_diretti" name="Costi Diretti" stackId="costi" fill="#f9b115" />
            <Bar dataKey="costi_indiretti" name="Costi Indiretti" stackId="costi" fill="#321fdb" />
            <Bar dataKey="costi_non_deducibili" name="Non Deducibili" stackId="costi" fill="#e55353" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  )
}

export default MonthlyChart
