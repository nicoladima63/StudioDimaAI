import React from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DatiAnno, ForecastMultiYear } from '../types'

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

// Colori per ogni anno (fino a 6 anni supportati)
const COLORI_ANNI = [
  '#9da5b1', // grigio (anno piu vecchio)
  '#f9b115', // giallo
  '#321fdb', // blu
  '#2eb85c', // verde
  '#e55353', // rosso
  '#3399ff', // azzurro
]

interface MultiYearChartProps {
  datiPerAnno: Record<string, DatiAnno>
  anni: number[]
  forecast?: ForecastMultiYear | null
  metrica?: 'produzione' | 'costi' | 'margine'
}

const MultiYearChart: React.FC<MultiYearChartProps> = ({
  datiPerAnno,
  anni,
  forecast = null,
  metrica = 'produzione',
}) => {
  const anniOrdinati = [...anni].sort()

  // Costruisci dati per il grafico: ogni punto ha il mese + un valore per anno
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const mese = i + 1
    const point: Record<string, any> = { nome_mese: MESI_NOMI[i] }

    anniOrdinati.forEach(anno => {
      const key = String(anno)
      const dati = datiPerAnno[key]
      if (dati) {
        const meseData = dati.mesi.find(m => m.mese === mese)
        const val = meseData ? meseData[metrica] : 0
        point[key] = val > 0 ? val : null
      }
    })

    // Aggiunge linea forecast se presente
    if (forecast) {
      const fMese = forecast.mesi.find(m => m.mese === mese)
      if (fMese && fMese.tipo === 'previsto') {
        point['forecast'] = fMese.produzione > 0 ? fMese.produzione : null
      }
    }

    return point
  })

  const formatCurrency = (value: number) => `${value.toLocaleString('it-IT')} EUR`

  const titoli: Record<string, string> = {
    produzione: 'Produzione',
    costi: 'Costi',
    margine: 'Margine',
  }

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>Confronto {titoli[metrica]} - {anniOrdinati.join(' vs ')}</strong>
      </CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome_mese" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            {anniOrdinati.map((anno, idx) => (
              <Line
                key={anno}
                type="monotone"
                dataKey={String(anno)}
                name={String(anno)}
                stroke={COLORI_ANNI[idx % COLORI_ANNI.length]}
                strokeWidth={anno === anniOrdinati[anniOrdinati.length - 1] ? 3 : 2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
            {forecast && (
              <Line
                type="monotone"
                dataKey="forecast"
                name={`${forecast.anno} (previsione)`}
                stroke="#e55353"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={{ r: 3, strokeDasharray: '' }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  )
}

export default MultiYearChart
