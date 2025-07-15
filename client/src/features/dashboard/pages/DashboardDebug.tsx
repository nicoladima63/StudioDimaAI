import React, { useEffect, useState } from 'react';
import { 
  getPazientiStats
} from '@/api/services/pazienti.service';
import { 
  getAppuntamentiStats, 
  getPrimeVisiteStats, 
  getAppuntamentiPerAnno,
  getAppuntamentiTotali
} from '@/api/services/calendar.service';

const DashboardDebug: React.FC = () => {
  const [data, setData] = useState({
    pazientiStats: null,
    appuntamentiStats: null,
    primeVisite: null,
    appuntamentiAnno: null,
    appuntamentiTotali: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch pazienti stats
        const pazientiData = await getPazientiStats();
        console.log('Pazienti Stats Raw:', pazientiData);

        // Fetch appuntamenti stats
        const appuntamentiData = await getAppuntamentiStats();
        console.log('Appuntamenti Stats Raw:', appuntamentiData);

        // Fetch prime visite
        const primeVisiteData = await getPrimeVisiteStats();
        console.log('Prime Visite Raw:', primeVisiteData);

        // Fetch appuntamenti per anno
        const appuntamentiAnnoData = await getAppuntamentiPerAnno();
        console.log('Appuntamenti Anno Raw:', appuntamentiAnnoData);

        // Fetch appuntamenti totali
        const appuntamentiTotaliData = await getAppuntamentiTotali();
        console.log('Appuntamenti Totali Raw:', appuntamentiTotaliData);

        setData({
          pazientiStats: pazientiData,
          appuntamentiStats: appuntamentiData,
          primeVisite: primeVisiteData,
          appuntamentiAnno: appuntamentiAnnoData,
          appuntamentiTotali: appuntamentiTotaliData
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard Debug</h1>
      
      <h2>Pazienti Stats</h2>
      <pre>{JSON.stringify(data.pazientiStats, null, 2)}</pre>

      <h2>Appuntamenti Stats</h2>
      <p>Formato atteso: &#123; meseCorrente: number, mesePrecedente: number, meseProssimo: number, crescita: number &#125;</p>
      <pre>{JSON.stringify(data.appuntamentiStats, null, 2)}</pre>

      <h2>Prime Visite</h2>
      <p>Formato atteso: number (solo il numero delle prime visite)</p>
      <pre>{JSON.stringify(data.primeVisite, null, 2)}</pre>

      <h2>Appuntamenti per Anno</h2>
      <p>Formato atteso per AppuntamentiChart: &#123; [anno: string]: &#123; month: number, count: number &#125;[] &#125;</p>
      <pre>{JSON.stringify(data.appuntamentiAnno, null, 2)}</pre>

      <h2>Appuntamenti Totali</h2>
      <p>Formato atteso per AppuntamentiTotaliBar: Array&#60;&#123; anno: string, totale: number, colore: string, progressivo: number &#125;&#62;</p>
      <pre>{JSON.stringify(data.appuntamentiTotali, null, 2)}</pre>
    </div>
  );
};

export default DashboardDebug;
