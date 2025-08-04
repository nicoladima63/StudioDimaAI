import React, { useMemo } from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { KPITrend } from '../services/kpi.service';

interface TrendChartProps {
  data: KPITrend;
  title?: string;
}

// Colori per le linee degli anni
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff7f', 
  '#dc143c', '#00ced1', '#ff69b4', '#ffd700', '#8b4513'
];

// Nomi dei mesi per l'asse X (costante fuori dal componente)
const MESI_NOMI = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu','Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  title = "Trend Ricavi Temporali" 
}) => {

  // Processa i dati per avere mesi come asse X e anni come linee separate
  const processedData = useMemo(() => {
    // Crea struttura con tutti i mesi
    const mesiData = MESI_NOMI.map((nome, index) => ({
      mese: nome,
      meseNumero: index + 1
    }));

    // Raggruppa dati per anno e mese
    const ricaviPerAnnoMese: Record<number, Record<number, number>> = {};
    
    data.trend.forEach(item => {
      if (!ricaviPerAnnoMese[item.anno]) {
        ricaviPerAnnoMese[item.anno] = {};
      }
      
      // Estrai il mese dal periodo (assumendo formato "2024-01" o simile)
      const mese = item.mese || parseInt(item.periodo.split('-')[1]) || 1;
      ricaviPerAnnoMese[item.anno][mese] = item.ricavo / 1000; // Converti in k€
    });

    // Aggiungi i ricavi ai mesi
    mesiData.forEach(meseObj => {
      Object.keys(ricaviPerAnnoMese).forEach(anno => {
        const ricavo = ricaviPerAnnoMese[parseInt(anno)][meseObj.meseNumero];
        if (ricavo !== undefined) {
          meseObj[`ricavo_${anno}`] = ricavo;
        }
      });
    });

    return mesiData;
  }, [data.trend]);

  // Ottieni gli anni unici per creare le linee
  const anniUnici = useMemo(() => {
    return [...new Set(data.trend.map(item => item.anno))].sort();
  }, [data.trend]);

  return (
    <CCard>
      <CCardHeader>
        <strong>{title}</strong>
        <div className="small text-medium-emphasis">
          Ricavi mensili per anno (in migliaia di euro)
        </div>
      </CCardHeader>
      <CCardBody>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mese" />
            <YAxis 
              label={{ value: 'Ricavi (k€)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                const anno = name.replace('ricavo_', '');
                return [`${value.toFixed(1)}k€`, `Anno ${anno}`];
              }}
            />
            <Legend />
            
            {/* Una linea per ogni anno - solo ricavi */}
            {anniUnici.map((anno, index) => (
              <Line 
                key={`ricavo_${anno}`}
                type="monotone" 
                dataKey={`ricavo_${anno}`}
                stroke={COLORS[index % COLORS.length]} 
                strokeWidth={2}
                name={`${anno}`}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CCardBody>
    </CCard>
  );
};

export default TrendChart;