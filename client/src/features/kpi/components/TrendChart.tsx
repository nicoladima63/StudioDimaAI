import React from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KPITrend } from '../services/kpi.service';

interface TrendChartProps {
  data: KPITrend;
  title?: string;
}

const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  title = "Trend Ricavi Temporali" 
}) => {
  return (
    <CCard>
      <CCardHeader>
        <strong>{title}</strong>
        <div className="small text-medium-emphasis">
          Crescita media: {data.statistiche.crescita_media}%
        </div>
      </CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data.trend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="periodo" />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === 'ricavo' 
                  ? `€${value.toLocaleString()}` 
                  : value.toLocaleString(),
                name === 'ricavo' ? 'Ricavo' : 'N. Fatture'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="ricavo" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="ricavo"
            />
            <Line 
              type="monotone" 
              dataKey="num_fatture" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="num_fatture"
            />
          </LineChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  );
};

export default TrendChart;