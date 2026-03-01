import React from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { ForecastMese } from '../types';

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

interface ForecastChartProps {
  data: ForecastMese[];
  title?: string;
}

const ForecastChart: React.FC<ForecastChartProps> = ({ data, title = 'Previsione Mensile' }) => {
  const chartData = data.map((m) => ({
    nome_mese: MESI_NOMI[m.mese - 1] || `M${m.mese}`,
    reale: m.reale,
    previsto: m.previsto,
    valore: m.reale ?? m.previsto ?? 0,
  }));

  const formatCurrency = (value: number) => `${value.toLocaleString('it-IT')} EUR`;

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome_mese" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="reale" name="Reale" fill="#321fdb" radius={[4, 4, 0, 0]} />
            <Area dataKey="previsto" name="Previsto" fill="#f9b11533" stroke="#f9b115" strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  );
};

export default ForecastChart;
