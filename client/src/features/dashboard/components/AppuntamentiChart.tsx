import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Nuovo tipo dati: oggetto con chiave anno e array di {month, count}
type Props = {
  data?: { [anno: string]: { count: number; month: number }[] };
};

const mesi = [
  '', // per avere mesi[1] = "Gen"
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const colori = ['#3399ff', '#8884d8', '#b0b0b0'];

const AppuntamentiChart: React.FC<Props> = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return <div style={{height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Nessun dato disponibile</div>;
  }
  // Ricostruisco i dati per mese: [{mese, anno1, anno2, anno3}]
  const anni = Object.keys(data).sort();
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const mese = mesi[i + 1];
    const entry: Record<string, number | string> = { mese };
    anni.forEach((anno) => {
      entry[anno] = data[anno][i]?.count || 0;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis dataKey="mese" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        {anni.map((anno, idx) => (
          <Bar key={anno} dataKey={anno} fill={colori[idx % colori.length]} name={anno} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AppuntamentiChart;
