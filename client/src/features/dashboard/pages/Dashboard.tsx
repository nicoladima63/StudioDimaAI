import React, { useState, useEffect } from 'react';
import { CCol, CRow } from '@coreui/react';
import {
  AppuntamentiChart,
  AppuntamentiCoreUICard,
  AppuntamentiTotaliBar
} from '../components';
import { getPazientiStats } from '@/api/services/pazienti.service'; 
import { 
  getAppuntamentiStats, 
  getPrimeVisiteStats, 
  getAppuntamentiPerAnno,
  getAppuntamentiTotali
} from '@/api/services/calendar.service'; 

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    pazienti: { totale: 0, inCura: 0 },
    appuntamenti: { corrente: 0, crescita: 0, prossimo: 0 },
    primeVisite: 0
  });
  const [datiGrafico, setDatiGrafico] = useState<{ [anno: string]: { count: number; month: number }[] }>({});
  const [totali, setTotali] = useState<{ anno: string; totale: number; colore: string; progressivo: number }[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch pazienti stats
        const pazientiData = await getPazientiStats();
        
        // Fetch appuntamenti stats
        const appuntamentiData = await getAppuntamentiStats();
        
        // Fetch prime visite
        const primeVisite = await getPrimeVisiteStats();
        
        // Fetch dati grafico
        const datiGraficoData = await getAppuntamentiPerAnno();
        
        // Fetch totali
        const totaliData = await getAppuntamentiTotali();

        // Aggiorna lo stato con tutti i dati
        setStats({
          pazienti: {
            totale: pazientiData.data.totale,
            inCura: pazientiData.data.in_cura
          },
          appuntamenti: {
            corrente: appuntamentiData.meseCorrente,
            crescita: appuntamentiData.crescita,
            prossimo: appuntamentiData.meseProssimo
          },
          primeVisite
        });

        setDatiGrafico(datiGraficoData);
        setTotali(totaliData);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    }

    fetchData();
  }, []);

  return (
    <div>
      <CRow>
        <CCol xs={12} sm={6} lg={3}>
          <AppuntamentiCoreUICard
            title="Pazienti totali"
            value={stats.pazienti.totale}
            crescita={0}
            color="#3399ff"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <AppuntamentiCoreUICard
            title="Appuntamenti del mese"
            value={stats.appuntamenti.corrente}
            crescita={stats.appuntamenti.crescita}
            color="#4be38a"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <AppuntamentiCoreUICard
            title="Prime visite"
            value={stats.primeVisite}
            crescita={0}
            color="#ff7676"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <AppuntamentiCoreUICard
            title="Pazienti in cura"
            value={stats.pazienti.inCura}
            crescita={0}
            color="#8884d8"
          />
        </CCol>
      </CRow>

      <CRow className="mt-4">
        <CCol xs={12}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8 }}>
            <h4>Appuntamenti per mese</h4>
            <AppuntamentiChart data={datiGrafico} />
          </div>
        </CCol>
      </CRow>

      <CRow className="mt-4">
        <CCol xs={12}>
          <AppuntamentiTotaliBar totali={totali} />
        </CCol>
      </CRow>
    </div>
  );
};

export default Dashboard;
