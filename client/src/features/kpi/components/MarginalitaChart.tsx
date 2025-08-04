import React from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KPIMarginalita } from '../services/kpi.service';

interface MarginalitaChartProps {
  data: KPIMarginalita[];
  title?: string;
}

const MarginalitaChart: React.FC<MarginalitaChartProps> = ({ 
  data, 
  title = "Marginalità per Prestazione" 
}) => {
  return (
    <CCard>
      <CCardHeader>
        <strong>{title}</strong>
      </CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tipo_nome" />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === 'ricavo_totale' 
                  ? `€${value.toLocaleString()}` 
                  : value.toLocaleString(),
                name === 'ricavo_totale' ? 'Ricavo Totale' : 'N. Prestazioni'
              ]}
            />
            <Bar dataKey="ricavo_totale" fill="#8884d8" name="ricavo_totale" />
            <Bar dataKey="numero_prestazioni" fill="#82ca9d" name="numero_prestazioni" />
          </BarChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  );
};

export default MarginalitaChart;