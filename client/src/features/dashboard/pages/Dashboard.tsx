import React, { useState, useEffect } from 'react';
import { CCol, CRow, CButton, CToast, CToastBody, CToastHeader, CSpinner } from '@coreui/react';
import {
  AppuntamentiChart,
  AppuntamentiCoreUICard,
  AppuntamentiTotaliBar,
  ServicesStatusSection
} from '../components';
import { Card } from '@/components/ui';
import { getPazientiStats } from '@/api/services/pazienti.service'; 
import { 
  getAppuntamentiStats, 
  getPrimeVisiteStats, 
  getAppuntamentiPerAnno,
  getAppuntamentiTotali
} from '@/api/services/calendar.service';
import { useDashboardLoader } from '@/store/dashboardLoaderStore';
import CIcon from '@coreui/icons-react';
import { cilReload } from '@coreui/icons';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    pazienti: { totale: 0, inCura: 0 },
    appuntamenti: { corrente: 0, crescita: 0, prossimo: 0 },
    primeVisite: 0
  });
  const [datiGrafico, setDatiGrafico] = useState<{ [anno: string]: { count: number; month: number }[] }>({});
  const [totali, setTotali] = useState<{ anno: string; totale: number; colore: string; progressivo: number }[]>([]);
  
  const { refreshKey, triggerRefresh, loadingMessage, setLoadingMessage, isLoading, setLoading } = useDashboardLoader();
  const [toastVisible, setToastVisible] = useState(false);

  // Effetto per il caricamento iniziale
  useEffect(() => {
    setLoading(true);
    setLoadingMessage('Caricamento dati in corso...');
  }, [setLoading, setLoadingMessage]);

  useEffect(() => {
    async function fetchData() {
      try {
        setToastVisible(true);
        
        setLoadingMessage('Caricamento statistiche pazienti...');
        const pazientiData = await getPazientiStats();
        
        setLoadingMessage('Caricamento statistiche appuntamenti...');
        const appuntamentiData = await getAppuntamentiStats();
        
        setLoadingMessage('Caricamento prime visite...');
        const primeVisite = await getPrimeVisiteStats();
        
        setLoadingMessage('Caricamento grafico appuntamenti...');
        const datiGraficoData = await getAppuntamentiPerAnno();
        
        setLoadingMessage('Caricamento totali annuali...');
        const totaliData = await getAppuntamentiTotali();

        setStats({
          pazienti: {
            totale: pazientiData.data.totale_pazienti,
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

        setLoadingMessage('Completato!');
        setLoading(false);
        
        setTimeout(() => setToastVisible(false), 1000);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoadingMessage('Si è verificato un errore');
        setLoading(false);
        setToastVisible(false);
      }
    }

    if (isLoading) {
      fetchData();
    }
  }, [refreshKey, setLoading, setLoadingMessage, isLoading]);

  return (
    <div>
      <CToast
        visible={toastVisible && isLoading}
        className="position-fixed"
        style={{ 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000,
          backgroundColor: '#e6f3ff',
          border: '1px solid #99ccff',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          minWidth: '300px'
        }}
        autohide={false}
      >
        <CToastHeader style={{ backgroundColor: '#cce6ff', borderBottom: '1px solid #99ccff' }}>
          <CSpinner size="sm" className="me-2" style={{ color: '#0066cc' }} />
          <strong>Caricamento dati</strong>
        </CToastHeader>
        <CToastBody>
          {loadingMessage}
        </CToastBody>
      </CToast>

      <CRow>
        <CCol xs={12}>
          <Card title="Dashboard">
            <div className="d-flex justify-content-end mb-3">
              <CButton 
                color="primary" 
                onClick={triggerRefresh}
                className="d-flex align-items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={cilReload} size="lg" />
                )}
                {isLoading ? 'Aggiornamento...' : 'Aggiorna'}
              </CButton>
            </div>

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

            <CRow className="mt-4">
              <CCol xs={12}>
                <ServicesStatusSection />
              </CCol>
            </CRow>
          </Card>
        </CCol>
      </CRow>
    </div>
  );
};

export default Dashboard;
